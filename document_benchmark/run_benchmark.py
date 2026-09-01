#!/usr/bin/env python3
"""Local-first document-understanding benchmark for Job Radar.

The harness never copies source documents and never calls an external model.
It produces measurements and normalized DocumentBlock JSON under outputs/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))
SOURCES_PATH = ROOT / "benchmark_sources.json"
TRUTH_PATH = ROOT / "truth_set_v1.json"
OUTPUTS = ROOT / "outputs"
CONTRACT_ID = "job-radar-document-block-v1"
SWIFT_OCR = PROJECT / "src" / "extraction" / "extract_pdf_visual_text.swift"
VISION_CONFIGS = [
    "VISION_V0_CURRENT",
    "VISION_V1_AUTO",
    "VISION_V2_EXPLICIT",
    "VISION_V3_CUSTOM",
    "VISION_V4_SMALL_TEXT",
]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    return "".join(ch for ch in value if ch.isalnum() or "\u4e00" <= ch <= "\u9fff")


def representative_pages(page_count: int, document_id: str) -> list[int]:
    fixed = {
        "portfolio-tencent": [1, 2, 3, 4, 5, 6, 7],
        # Page 9 is the method page containing the truth-set terms
        # AnyLogic/Schelling/Grasshopper. Keep the cover and three project
        # openings so this is still a layout sample rather than a keyword-only
        # sample.
        "portfolio-architecture-build": [1, 2, 9, 19, 24],
        "portfolio-kailong-comprehensive": [1, 2, 10, 20, 30],
        "resume-base-product-manager": [1, 2],
    }
    pages = fixed.get(document_id)
    if pages:
        return sorted({page for page in pages if 1 <= page <= page_count})
    if page_count <= 4:
        return list(range(1, page_count + 1))
    return sorted({1, 2, max(1, math.ceil(page_count / 2)), page_count})


def _native_page_stats(page: pdfplumber.page.Page) -> dict[str, Any]:
    try:
        text = page.extract_text() or ""
    except Exception:
        text = ""
    try:
        words = page.extract_words(keep_blank_chars=False, use_text_flow=False) or []
    except Exception:
        words = []
    return {
        "chars": len(normalized_text(text)),
        "word_blocks": len(words),
        "images": len(page.images or []),
    }


def inspect_source(source: dict[str, Any]) -> dict[str, Any]:
    path = Path(source["path"])
    record = {**source, "exists": path.is_file()}
    if not path.is_file():
        record["failure_layer"] = "Source"
        return record
    record.update({"size_bytes": path.stat().st_size, "sha256": sha256(path), "format": path.suffix.lower().lstrip(".")})
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(str(path))
        record["page_count"] = len(reader.pages)
        with pdfplumber.open(str(path)) as pdf:
            stats = [_native_page_stats(page) for page in pdf.pages]
        record["page_stats"] = stats
        native_pages = sum(item["chars"] >= 30 for item in stats)
        if native_pages == 0:
            record["text_mode"] = "image_only"
        elif native_pages == len(stats):
            record["text_mode"] = "native_text"
        else:
            record["text_mode"] = "mixed"
        record["native_text_chars"] = sum(item["chars"] for item in stats)
        record["representative_pages"] = representative_pages(len(stats), source["document_id"])
        word_counts = [item["word_blocks"] for item in stats]
        record["known_special_structure"] = "image_heavy_or_decorative" if sum(item["images"] for item in stats) > len(stats) else "text_dominant_or_unknown"
        record["layout_class"] = "multi_column_or_card" if source["document_type"] == "portfolio" or max(word_counts or [0]) > 100 else "single_column_or_compact"
    elif path.suffix.lower() == ".docx":
        from src.career_evidence import _docx_pages

        pages = _docx_pages(path.read_bytes())
        record["page_count"] = len(pages)
        record["text_mode"] = "native_text"
        record["native_text_chars"] = sum(len(normalized_text(" ".join(page.get("lines", [])))) for page in pages)
        record["representative_pages"] = list(range(1, len(pages) + 1))
        record["known_special_structure"] = "word_paragraph_and_table_order"
        record["layout_class"] = "source_xml_reading_order"
    else:
        record["page_count"] = 1
        record["text_mode"] = "native_text"
        record["native_text_chars"] = len(normalized_text(path.read_text(encoding="utf-8", errors="replace")))
        record["representative_pages"] = [1]
        record["known_special_structure"] = "plain_text"
        record["layout_class"] = "linear"
    return record


def inventory() -> dict[str, Any]:
    catalog = read_json(SOURCES_PATH)
    started = time.perf_counter()
    documents = [inspect_source(source) for source in catalog["sources"]]
    hashes: dict[str, list[str]] = defaultdict(list)
    for document in documents:
        if document.get("sha256"):
            hashes[document["sha256"]].append(document["document_id"])
    duplicate_groups = [ids for ids in hashes.values() if len(ids) > 1]
    families: dict[str, dict[str, Any]] = {}
    for document in documents:
        family = families.setdefault(document["document_family"], {"documents": 0, "formats": Counter(), "layouts": Counter(), "text_modes": Counter()})
        family["documents"] += 1
        family["formats"][document.get("format", "missing")] += 1
        family["layouts"][document.get("layout_class", "unknown")] += 1
        family["text_modes"][document.get("text_mode", "missing")] += 1
    serializable_families = {
        key: {name: dict(value) if isinstance(value, Counter) else value for name, value in family.items()}
        for key, family in families.items()
    }
    result = {
        "benchmark_id": catalog["benchmark_id"],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "privacy": catalog["privacy"],
        "source_copy_policy": catalog["copy_policy"],
        "documents": documents,
        "duplicate_groups": duplicate_groups,
        "macro_families": serializable_families,
        "non_document_assets": catalog.get("non_document_assets", []),
        "elapsed_seconds": round(time.perf_counter() - started, 3),
    }
    write_json(OUTPUTS / "corpus_inventory.json", result)
    return result


def make_block(document: dict[str, Any], page: int, text: str, bbox: tuple[float, float, float, float], confidence: float | None, source_method: str, engine_ref: str | None = None, layout_label: str | None = None, raw_engine: dict[str, Any] | None = None) -> dict[str, Any]:
    x, y, width, height = bbox
    identity = f"{document['document_id']}|{page}|{source_method}|{round(x, 5)}|{round(y, 5)}|{text}"
    return {
        "contract_id": CONTRACT_ID,
        "block_id": "block-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24],
        "page": page,
        "text": text.strip(),
        "bbox": {
            "x": max(0.0, min(1.0, x)),
            "y": max(0.0, min(1.0, y)),
            "width": max(0.0, min(1.0, width)),
            "height": max(0.0, min(1.0, height)),
            "coordinate_system": "normalized_top_left",
        },
        "confidence": confidence,
        "source_method": source_method,
        "layout_label": layout_label,
        "region": None,
        "column": None,
        "reading_order": 0,
        "source_ref": {
            "document_id": document["document_id"],
            "source_sha256": document["sha256"],
            "page": page,
            "engine_ref": engine_ref,
        },
        "raw_engine": raw_engine,
    }


def native_pdf_blocks(document: dict[str, Any], pages: Iterable[int] | None = None) -> list[dict[str, Any]]:
    page_filter = set(pages or [])
    output: list[dict[str, Any]] = []
    with pdfplumber.open(document["path"]) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            if page_filter and page_number not in page_filter:
                continue
            width, height = float(page.width), float(page.height)
            words = page.extract_words(keep_blank_chars=False, use_text_flow=False) or []
            lines: list[list[dict[str, Any]]] = []
            for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
                top = float(word["top"])
                target = next((line for line in reversed(lines[-4:]) if abs(float(line[0]["top"]) - top) <= max(2.5, height * 0.004)), None)
                if target is None:
                    lines.append([word])
                else:
                    target.append(word)
            for line in lines:
                line.sort(key=lambda item: float(item["x0"]))
                text = " ".join(str(word.get("text", "")).strip() for word in line if str(word.get("text", "")).strip())
                if not text:
                    continue
                x0, top = min(float(word["x0"]) for word in line), min(float(word["top"]) for word in line)
                x1, bottom = max(float(word["x1"]) for word in line), max(float(word["bottom"]) for word in line)
                output.append(make_block(
                    document,
                    page_number,
                    text,
                    (x0 / width, top / height, (x1 - x0) / width, (bottom - top) / height),
                    1.0,
                    "native_pdf",
                    engine_ref=f"pdfplumber-line-{page_number}",
                ))
    return output


def vision_blocks(document: dict[str, Any], config: str, pages: Iterable[int]) -> tuple[list[dict[str, Any]], float]:
    page_arg = ",".join(str(page) for page in pages)
    started = time.perf_counter()
    result = subprocess.run(
        ["swift", str(SWIFT_OCR), document["path"], config, page_arg],
        capture_output=True,
        text=True,
        check=True,
        timeout=max(180, 45 * len(list(pages))),
    )
    elapsed = time.perf_counter() - started
    payload = json.loads(result.stdout)
    blocks: list[dict[str, Any]] = []
    for page in payload["pages"]:
        for index, raw in enumerate(page.get("blocks", [])):
            # Vision coordinates use a bottom-left origin; DocumentBlock uses top-left.
            top = 1.0 - (float(raw["y"]) + float(raw["height"]))
            blocks.append(make_block(
                document,
                int(page["page"]),
                raw["text"],
                (float(raw["x"]), top, float(raw["width"]), float(raw["height"])),
                float(raw.get("confidence", 0.0)),
                "apple_vision",
                engine_ref=f"{config}-page-{page['page']}-observation-{index}",
                raw_engine=raw,
            ))
    return blocks, elapsed


def l0_sort(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = sorted(blocks, key=lambda block: (block["page"], round(block["bbox"]["y"] / 0.025), block["bbox"]["x"], block["bbox"]["y"]))
    for order, block in enumerate(ordered):
        block["reading_order"] = order
    return ordered


def _recursive_column_sort(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(blocks) < 4:
        return sorted(blocks, key=lambda block: (block["bbox"]["y"], block["bbox"]["x"]))
    centers = sorted((block["bbox"]["x"] + block["bbox"]["width"] / 2, index) for index, block in enumerate(blocks))
    gaps = [(centers[index + 1][0] - centers[index][0], index) for index in range(len(centers) - 1)]
    gap, gap_index = max(gaps, default=(0.0, 0))
    if gap < 0.12:
        return sorted(blocks, key=lambda block: (block["bbox"]["y"], block["bbox"]["x"]))
    split = (centers[gap_index][0] + centers[gap_index + 1][0]) / 2
    spanning = [block for block in blocks if block["bbox"]["x"] < split < block["bbox"]["x"] + block["bbox"]["width"]]
    if spanning and min(block["bbox"]["y"] for block in spanning) < 0.18:
        header_bottom = max(block["bbox"]["y"] + block["bbox"]["height"] for block in spanning)
        headers = [block for block in blocks if block["bbox"]["y"] <= header_bottom]
        body = [block for block in blocks if block not in headers]
        return sorted(headers, key=lambda block: (block["bbox"]["y"], block["bbox"]["x"])) + _recursive_column_sort(body)
    left = [block for block in blocks if block["bbox"]["x"] + block["bbox"]["width"] / 2 <= split]
    right = [block for block in blocks if block not in left]
    if not left or not right:
        return sorted(blocks, key=lambda block: (block["bbox"]["y"], block["bbox"]["x"]))
    for block in left:
        block["column"] = 0
    for block in right:
        block["column"] = 1
    return _recursive_column_sort(left) + _recursive_column_sort(right)


def gaptree_style_sort(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered: list[dict[str, Any]] = []
    for page in sorted({block["page"] for block in blocks}):
        ordered.extend(_recursive_column_sort([block for block in blocks if block["page"] == page]))
    for order, block in enumerate(ordered):
        block["reading_order"] = order
    return ordered


def hybrid_layout_sort(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Full-width headers and explicit CASE labels stay ahead of column content;
    # the remaining blocks use whitespace-tree ordering.
    ordered: list[dict[str, Any]] = []
    for page in sorted({block["page"] for block in blocks}):
        page_blocks = [block for block in blocks if block["page"] == page]
        anchors = [block for block in page_blocks if block["bbox"]["width"] >= 0.52 or re.match(r"(?i)^case\s*\d+", block["text"].strip())]
        body = [block for block in page_blocks if block not in anchors]
        merged = anchors + _recursive_column_sort(body)
        ordered.extend(sorted(merged, key=lambda block: (0 if block in anchors else 1, block["bbox"]["y"], block["bbox"]["x"])) if anchors and not body else merged)
    for order, block in enumerate(ordered):
        block["reading_order"] = order
    return ordered


def term_recall(blocks: list[dict[str, Any]], terms: list[str]) -> dict[str, Any]:
    joined = normalized_text(" ".join(block["text"] for block in sorted(blocks, key=lambda item: item["reading_order"])))
    hits = [term for term in terms if normalized_text(term) in joined]
    return {"expected": len(terms), "found": len(hits), "recall": round(len(hits) / len(terms), 4) if terms else None, "missing": [term for term in terms if term not in hits]}


def pairwise_order_accuracy(blocks: list[dict[str, Any]], ordered_terms: list[str]) -> dict[str, Any]:
    joined = normalized_text("\n".join(block["text"] for block in sorted(blocks, key=lambda item: item["reading_order"])))
    positions = {term: joined.find(normalized_text(term)) for term in ordered_terms}
    pairs = 0
    correct = 0
    for index, first in enumerate(ordered_terms):
        for second in ordered_terms[index + 1:]:
            if positions[first] < 0 or positions[second] < 0:
                continue
            pairs += 1
            correct += positions[first] < positions[second]
    return {"evaluated_pairs": pairs, "correct_pairs": correct, "accuracy": round(correct / pairs, 4) if pairs else None}


def blocks_to_pages(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pages: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for block in sorted(blocks, key=lambda item: item["reading_order"]):
        bbox = block["bbox"]
        pages[block["page"]].append({
            "text": block["text"],
            "confidence": block["confidence"] if block["confidence"] is not None else 1.0,
            "x": bbox["x"],
            "y": 1.0 - (bbox["y"] + bbox["height"]),
            "width": bbox["width"],
            "height": bbox["height"],
        })
    return [{"page": page, "lines": [block["text"] for block in data], "blocks": data} for page, data in sorted(pages.items())]


def structure_metrics(document: dict[str, Any], blocks: list[dict[str, Any]], truth: dict[str, Any]) -> dict[str, Any]:
    from src.career_evidence import propose_entities

    entities, warnings, status = propose_entities(blocks_to_pages(blocks), "benchmark-" + document["document_id"], document["document_type"])
    counts = Counter(entity["entity_type"] for entity in entities)
    expected = truth.get("expected_entity_counts", {})
    matched = sum(min(counts.get(key, 0), value) for key, value in expected.items())
    total = sum(expected.values())
    false_population = sum(1 for entity in entities for value in entity.get("data", {}).values() if value not in (None, "", []) and "unsupported" in entity.get("extraction", {}).get("warnings", []))
    return {
        "status": status,
        "warnings": warnings,
        "entity_counts": dict(counts),
        "expected_counts": expected,
        "grouping_recall": round(matched / total, 4) if total else None,
        "unsupported_field_false_population": false_population,
    }


def bbox_iou(first: dict[str, float], second: dict[str, float]) -> float:
    left = max(first["x"], second["x"])
    top = max(first["y"], second["y"])
    right = min(first["x"] + first["width"], second["x"] + second["width"])
    bottom = min(first["y"] + first["height"], second["y"] + second["height"])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    union = first["width"] * first["height"] + second["width"] * second["height"] - intersection
    return intersection / union if union > 0 else 0.0


def fuse_native_vision(native: list[dict[str, Any]], vision: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    fused = json.loads(json.dumps(native))
    duplicates = 0
    native_by_page: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for block in native:
        native_by_page[block["page"]].append(block)
    for ocr in vision:
        text = normalized_text(ocr["text"])
        if not text:
            continue
        page_native = native_by_page.get(ocr["page"], [])
        native_text = normalized_text(" ".join(block["text"] for block in page_native))
        overlap = max((bbox_iou(ocr["bbox"], block["bbox"]) for block in page_native), default=0.0)
        if text in native_text or (overlap >= 0.12 and all(token in native_text for token in re.findall(r"[a-z0-9]{3,}|[\u4e00-\u9fff]{2,}", text))):
            duplicates += 1
            continue
        fused.append(ocr)
    return fused, duplicates


def architecture_comparison(best_config: str, best_layout: str) -> dict[str, Any]:
    inv = read_json(OUTPUTS / "corpus_inventory.json")
    truth = read_json(TRUTH_PATH)["documents"]
    documents = {document["document_id"]: document for document in inv["documents"] if document.get("exists")}
    sorter = {"LAYOUT_L0": l0_sort, "LAYOUT_L1_GAPTREE_STYLE": gaptree_style_sort, "LAYOUT_L2_HYBRID": hybrid_layout_sort}[best_layout]
    results: dict[str, Any] = {"experiment": "Native PDF and OCR architecture", "best_vision_config": best_config, "best_layout": best_layout, "documents": {}}
    for identifier, doc_truth in truth.items():
        document = documents.get(identifier)
        if not document or document.get("format") != "pdf":
            continue
        pages = document["representative_pages"]
        native = native_pdf_blocks(document, pages)
        best_raw = OUTPUTS / "raw" / best_config / f"{identifier}.json"
        if best_raw.exists():
            vision = read_json(best_raw)["blocks"]
            vision_runtime = read_json(best_raw)["metrics"]["runtime_seconds"]
        else:
            vision, vision_runtime = vision_blocks(document, best_config, pages)
        current_raw = OUTPUTS / "raw" / "VISION_V0_CURRENT" / f"{identifier}.json"
        current_vision = read_json(current_raw)["blocks"] if current_raw.exists() else vision_blocks(document, "VISION_V0_CURRENT", pages)[0]
        current = native if document["text_mode"] == "native_text" else current_vision
        fused, duplicates = fuse_native_vision(native, vision)
        variants = {
            "CURRENT": current,
            "TUNED_VISION": vision,
            "HYBRID_VISION": fused,
        }
        results["documents"][identifier] = {}
        for name, source_blocks in variants.items():
            blocks = sorter(json.loads(json.dumps(source_blocks)))
            methods = Counter(block["source_method"] for block in blocks)
            metrics = {
                "pages": pages,
                "blocks": len(blocks),
                "source_methods": dict(methods),
                "critical_term_recall": term_recall(blocks, doc_truth.get("critical_terms", [])),
                "reading_order": pairwise_order_accuracy(blocks, doc_truth.get("critical_terms", [])),
                "structure": structure_metrics(document, blocks, doc_truth),
                "runtime_seconds": round(vision_runtime, 3) if name != "CURRENT" or document["text_mode"] != "native_text" else 0.0,
                "deduplicated_ocr_blocks": duplicates if name == "HYBRID_VISION" else 0,
                "bbox_coverage": round(sum(block["bbox"]["width"] * block["bbox"]["height"] for block in blocks), 4),
                "provenance_traceable": all(block.get("source_ref", {}).get("source_sha256") == document["sha256"] for block in blocks),
            }
            results["documents"][identifier][name] = metrics
            write_json(OUTPUTS / "architecture" / name / f"{identifier}.json", {"document": identifier, "blocks": blocks, "metrics": metrics})
    macro: dict[str, Any] = {}
    for name in ["CURRENT", "TUNED_VISION", "HYBRID_VISION"]:
        rows = [variants[name] for variants in results["documents"].values() if name in variants]
        recalls = [row["critical_term_recall"]["recall"] for row in rows if row["critical_term_recall"]["recall"] is not None]
        groups = [row["structure"]["grouping_recall"] for row in rows if row["structure"]["grouping_recall"] is not None]
        orders = [row["reading_order"]["accuracy"] for row in rows if row["reading_order"]["accuracy"] is not None]
        macro[name] = {
            "macro_term_recall": round(sum(recalls) / len(recalls), 4) if recalls else None,
            "macro_reading_order": round(sum(orders) / len(orders), 4) if orders else None,
            "macro_entity_grouping": round(sum(groups) / len(groups), 4) if groups else None,
        }
    results["macro"] = macro
    write_json(OUTPUTS / "architecture_comparison.json", results)
    return results


def run_vision_ablation() -> dict[str, Any]:
    inv = read_json(OUTPUTS / "corpus_inventory.json") if (OUTPUTS / "corpus_inventory.json").exists() else inventory()
    truth = read_json(TRUTH_PATH)["documents"]
    documents = {document["document_id"]: document for document in inv["documents"] if document.get("exists") and document.get("format") == "pdf"}
    selected_ids = [identifier for identifier in ["resume-base-product-manager", "resume-tencent-pdf", "portfolio-tencent", "portfolio-architecture-build", "portfolio-kailong-comprehensive", "resume-cv-compressed"] if identifier in documents]
    results: dict[str, Any] = {"experiment": "Apple Vision OCR ablation", "documents": {}, "configs": VISION_CONFIGS}
    for identifier in selected_ids:
        document = documents[identifier]
        pages = document["representative_pages"]
        doc_truth = truth.get(identifier, {})
        results["documents"][identifier] = {}
        for config in VISION_CONFIGS:
            blocks, elapsed = vision_blocks(document, config, pages)
            ordered = l0_sort(blocks)
            metrics = {
                "pages": pages,
                "blocks": len(blocks),
                "runtime_seconds": round(elapsed, 3),
                "runtime_seconds_per_page": round(elapsed / max(1, len(pages)), 3),
                "mean_confidence": round(sum(block["confidence"] or 0 for block in blocks) / max(1, len(blocks)), 4),
                "critical_term_recall": term_recall(ordered, doc_truth.get("critical_terms", [])),
            }
            results["documents"][identifier][config] = metrics
            write_json(OUTPUTS / "raw" / config / f"{identifier}.json", {"document": identifier, "blocks": ordered, "metrics": metrics})
    macro: dict[str, Any] = {}
    for config in VISION_CONFIGS:
        rows = [results["documents"][identifier][config] for identifier in selected_ids]
        recalls = [row["critical_term_recall"]["recall"] for row in rows if row["critical_term_recall"]["recall"] is not None]
        macro[config] = {
            "macro_critical_term_recall": round(sum(recalls) / len(recalls), 4) if recalls else None,
            "mean_runtime_seconds_per_page": round(sum(row["runtime_seconds_per_page"] for row in rows) / len(rows), 3),
            "mean_confidence": round(sum(row["mean_confidence"] for row in rows) / len(rows), 4),
        }
    results["macro"] = macro
    write_json(OUTPUTS / "vision_ablation.json", results)
    return results


def run_layout_ablation(best_config: str) -> dict[str, Any]:
    truth = read_json(TRUTH_PATH)["documents"]
    inv = read_json(OUTPUTS / "corpus_inventory.json")
    documents = {document["document_id"]: document for document in inv["documents"]}
    results: dict[str, Any] = {"experiment": "Layout reconstruction ablation", "ocr_config": best_config, "documents": {}}
    for identifier, doc_truth in truth.items():
        raw_path = OUTPUTS / "raw" / best_config / f"{identifier}.json"
        if not raw_path.exists():
            continue
        raw_blocks = read_json(raw_path)["blocks"]
        results["documents"][identifier] = {}
        for name, sorter in [("LAYOUT_L0", l0_sort), ("LAYOUT_L1_GAPTREE_STYLE", gaptree_style_sort), ("LAYOUT_L2_HYBRID", hybrid_layout_sort)]:
            blocks = sorter(json.loads(json.dumps(raw_blocks)))
            metrics = {
                "critical_term_recall": term_recall(blocks, doc_truth.get("critical_terms", [])),
                "reading_order": pairwise_order_accuracy(blocks, doc_truth.get("critical_terms", [])),
                "structure": structure_metrics(documents[identifier], blocks, doc_truth),
            }
            results["documents"][identifier][name] = metrics
            write_json(OUTPUTS / "layout" / name / f"{identifier}.json", {"document": identifier, "blocks": blocks, "metrics": metrics})
    write_json(OUTPUTS / "layout_ablation.json", results)
    return results


def run_full_corpus_acceptance() -> dict[str, Any]:
    """Run the selected production path on every inventoried real document."""
    from src.career_evidence import (
        _docx_pages,
        _document_blocks,
        _adaptive_resume_layout,
        _selective_pdf_pages,
        _text_pages,
        propose_entities,
    )

    catalog = read_json(SOURCES_PATH)
    truth = read_json(TRUTH_PATH)["documents"]
    results: list[dict[str, Any]] = []
    for source in catalog["sources"]:
        path = Path(source["path"])
        started = time.perf_counter()
        row: dict[str, Any] = {
            "document_id": source["document_id"],
            "document_family": source["document_family"],
            "document_type": source["document_type"],
            "owner_scope": source["owner_scope"],
        }
        try:
            content = path.read_bytes()
            digest = hashlib.sha256(content).hexdigest()
            source_id = "source-" + digest[:20]
            if path.suffix.lower() == ".pdf":
                pages, method, extraction_warnings = _selective_pdf_pages(content, PROJECT / "src" / "extraction" / "extract_pdf_text.swift", PROJECT / "src" / "extraction" / "extract_pdf_visual_text.swift")
                if source["document_type"] == "resume":
                    pages, changed = _adaptive_resume_layout(pages)
                    if changed:
                        method += "+adaptive_gaptree_resume"
                        extraction_warnings.append("adaptive_multicolumn_reading_order")
            elif path.suffix.lower() == ".docx":
                pages, method, extraction_warnings = _docx_pages(content), "docx_xml_text_v0", []
            else:
                pages, method, extraction_warnings = _text_pages(content), "utf8_text_v0", []
            entities, warnings, status = propose_entities(pages, source_id, source["document_type"])
            counts = Counter(entity["entity_type"] for entity in entities)
            blocks = _document_blocks(pages, source_id, digest)
            expected = truth.get(source["document_id"], {}).get("expected_entity_counts")
            truth_pass = None if expected is None else all(counts.get(kind, 0) == count for kind, count in expected.items())
            expected_empty_ok = all(
                not entity.get("data", {}).get(field, None)
                for entity in entities
                for field in ("outcomes",)
                if source["document_type"] in {"portfolio", "project_description"}
            )
            row.update({
                "status": status,
                "production_method": method,
                "warnings": extraction_warnings + warnings,
                "page_count": len(pages),
                "document_block_count": len(blocks),
                "document_block_methods": dict(Counter(block["source_method"] for block in blocks)),
                "entity_count": len(entities),
                "entity_counts": dict(counts),
                "entity_names": [entity.get("data", {}).get("name") or entity.get("data", {}).get("institution") for entity in entities],
                "truth_expected_counts": expected,
                "truth_pass": truth_pass,
                "unknown_outcomes_preserved": expected_empty_ok,
                "provenance_traceable": all(block["source_ref"]["source_sha256"] == digest for block in blocks),
                "runtime_seconds": round(time.perf_counter() - started, 3),
                "failure_layer": None if status == "needs_review" else "Document Structure",
            })
        except Exception as error:  # benchmark must retain per-file failures
            row.update({
                "status": "failed",
                "error": f"{type(error).__name__}: {error}",
                "runtime_seconds": round(time.perf_counter() - started, 3),
                "failure_layer": "Native Extraction" if path.suffix.lower() == ".pdf" else "Source",
            })
        results.append(row)
    truth_rows = [row for row in results if row.get("truth_pass") is not None]
    payload = {
        "experiment": "full real corpus production acceptance",
        "documents": results,
        "summary": {
            "documents": len(results),
            "completed": sum(row["status"] != "failed" for row in results),
            "reviewable": sum(row["status"] == "needs_review" for row in results),
            "manual_selection": sum(row["status"] == "needs_manual_selection" for row in results),
            "failed": sum(row["status"] == "failed" for row in results),
            "truth_documents": len(truth_rows),
            "truth_passed": sum(row["truth_pass"] is True for row in truth_rows),
            "external_documents_kept_benchmark_only": sum(row["owner_scope"] != "kai_career_model" for row in results),
        },
    }
    write_json(OUTPUTS / "full_corpus_acceptance.json", payload)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["inventory", "vision", "layout", "architecture", "corpus"])
    parser.add_argument("--best-config", default="VISION_V0_CURRENT")
    parser.add_argument("--best-layout", default="LAYOUT_L0")
    args = parser.parse_args()
    if args.command == "inventory":
        result = inventory()
    elif args.command == "vision":
        result = run_vision_ablation()
    elif args.command == "layout":
        result = run_layout_ablation(args.best_config)
    elif args.command == "architecture":
        result = architecture_comparison(args.best_config, args.best_layout)
    else:
        result = run_full_corpus_acceptance()
    print(json.dumps({"command": args.command, "output": str(OUTPUTS), "summary": result.get("macro", {"documents": len(result.get("documents", []))})}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
