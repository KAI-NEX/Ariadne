"""Explicit live qualification with synthetic fixtures only; never run on import."""
import argparse
import base64
import contextlib
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys
import time
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Authorize synthetic DeepSeek API usage")
    parser.add_argument("--case", choices=["all", "job_pdf"], default="all", help="Retest only the revised PDF fixture when needed")
    args = parser.parse_args()
    if not args.live:
        parser.error("--live is required; this makes paid synthetic API calls")
    import app
    from src.model_updates import ModelUpdates, synthetic_pdf, catalog_entry
    from src.pdf_delivery import render_complete_pdf_pages
    from src.candidate_model_runtime import execute_candidate_model_request, candidate_model_operation_id, runtime_fingerprint
    from src.job_model_runtime import execute_job_model_request
    from src.candidate_conversation_runtime import execute_candidate_conversation_request
    from src.job_conversation_runtime import execute_job_conversation_request
    from src.personal_understanding_runtime import execute as personal
    from src.job_overview_runtime import execute as overview
    from concurrent.futures import ThreadPoolExecutor
    output = ROOT / ".cache" / "deepseek-v41-20260911" / str(time.time_ns())
    output.mkdir(parents=True)
    credential = app.read_deepseek_key()
    if not credential:
        raise RuntimeError("DeepSeek credential missing")
    usage = []
    def provider(key, payload):
        status, response = app.call_deepseek_chat_completions(key, payload, response_limit=3000000, timeout=180)
        usage.append({"model": response.get("model"), "usage": response.get("usage"), "status": status})
        return status, response
    check = ModelUpdates().verify("deepseek-flash", catalog_entry("deepseek-flash")["descriptor_revision"],
        app.deepseek_runtime_models, app.synthetic_multimodal_smoke_image_data_url(), lambda payload: provider(credential, payload)) if args.case == "all" else {"skipped": True}
    (output / "visual-check.json").write_text(json.dumps(check, indent=2))
    def fixture(name):
        with contextlib.redirect_stdout(io.StringIO()):
            return runpy.run_path(str(ROOT / "tests" / name))
    candidate = fixture("candidate_model_runtime_regression.py")["request"]()
    pdf = synthetic_pdf(("2024 Product Designer at Synthetic Studio", "Designed a documented product flow."))
    (output / "synthetic-candidate.pdf").write_bytes(pdf)
    digest = hashlib.sha256(pdf).hexdigest(); sid = "source-candidate-" + digest
    candidate["source_document"].update(source_document_id=sid, content_hash="sha256:" + digest)
    candidate["document_data_url"] = "data:application/pdf;base64," + base64.b64encode(pdf).decode()
    candidate["consent"]["source_document_id"] = sid
    op = candidate_model_operation_id(sid, runtime_fingerprint(candidate["runtime_snapshot"]), candidate["consent"]["consent_id"])
    candidate["operation_identity"].update(source_document_id=sid, operation_id=op)
    candidate["processing_run_id"] = "run-" + op
    job_pdf = synthetic_pdf(("Synthetic Labs seeks an AI Product Manager in Shanghai.", "Design evaluations; AI product experience required."))
    (output / "synthetic-job.pdf").write_bytes(job_pdf)
    jobs = fixture("codex_job_pdf_regression.py")["pdf_request"](job_pdf, provider="deepseek")
    cc = fixture("candidate_conversation_runtime_regression.py")["request_for"]()
    jc = fixture("job_conversation_runtime_regression.py")["request"]()
    pe = fixture("personal_understanding_runtime_regression.py")["request"]
    jo = fixture("job_overview_runtime_regression.py")["request"]
    cases = [("candidate_pdf", candidate, lambda value: execute_candidate_model_request(value, lambda: credential, render_complete_pdf_pages, provider)),
             ("job_pdf", jobs, lambda value: execute_job_model_request(value, lambda: credential, provider)),
             ("candidate_conversation", cc, lambda value: execute_candidate_conversation_request(value, lambda: credential, provider)),
             ("job_conversation", jc, lambda value: execute_job_conversation_request(value, lambda: credential, provider)),
             ("personal_understanding", pe, lambda value: personal(value, lambda: credential, provider)),
             ("job_overview", jo, lambda value: overview(value, lambda: credential, provider))]
    if args.case != "all":
        cases = [case for case in cases if case[0] == args.case]
    def run(case):
        name, value, execute = case
        started = time.monotonic()
        try:
            result = execute(value)
            (output / (name + ".json")).write_text(json.dumps(result, ensure_ascii=False, indent=2))
            return {"case": name, "ok": True, "seconds": round(time.monotonic() - started, 2)}
        except Exception as error:
            return {"case": name, "ok": False, "error": getattr(error, "code", str(error)), "seconds": round(time.monotonic() - started, 2)}
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(run, cases))
    (output / "results.json").write_text(json.dumps({"visual": check, "cases": results, "usage": usage}, ensure_ascii=False, indent=2))
    print(json.dumps({"output": str(output), "cases": results}, ensure_ascii=False))
    if not all(item["ok"] for item in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
