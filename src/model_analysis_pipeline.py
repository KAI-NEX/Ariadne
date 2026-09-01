"""Provider-independent Model API foundation, with deterministic local mock providers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_DIR = PROJECT_ROOT / "data" / "model_contracts"


@dataclass(frozen=True)
class ProviderResponse:
    provider_name: str
    model_name: str
    raw_output: str


def build_model_input(job: dict) -> dict:
    """Select relevant facts and provenance; deliberately exclude user-owned state."""
    return {
        field: job[field]
        for field in (
            "job_id", "title", "company", "location", "seniority", "responsibilities",
            "requirements", "external_source_name", "external_job_id", "raw_capture_path",
            "raw_capture_sha256", "last_successful_fetch_at",
        )
    }


def build_request(job: dict) -> dict:
    """Keep control instruction separate from the JD facts sent to a provider adapter."""
    instruction = json.loads((CONTRACT_DIR / "model_instruction_v0.json").read_text(encoding="utf-8"))
    return {
        "instruction_version": instruction["instruction_version"],
        "instruction": instruction["instruction"],
        "input": build_model_input(job),
        "output_contract_id": "jd_analysis_v0",
    }


class MockProvider:
    """A deterministic stand-in that exercises the same adapter return boundary."""

    provider_name = "mock"
    model_name = "deterministic-fixture-v0"

    def analyze(self, request: dict, scenario: str) -> ProviderResponse:
        if request["input"]["job_id"] != "JD-001":
            raise ValueError("mock_provider_has_no_fixture_for_job")
        fixture_names = {
            "compliant": "compliant_model_output.json",
            "invalid": "invalid_model_output.json",
            "misleading": "misleading_but_valid_model_output.json",
            "missing_capability_evidence": "capability_without_evidence_model_output.json",
        }
        if scenario not in fixture_names:
            raise ValueError("unknown_mock_scenario")
        raw_output = (CONTRACT_DIR / fixture_names[scenario]).read_text(encoding="utf-8")
        return ProviderResponse(self.provider_name, self.model_name, raw_output)


def get_provider(name: str) -> MockProvider:
    """One narrow adapter boundary; real providers can be added without changing product logic."""
    if name == "mock":
        return MockProvider()
    raise ValueError("provider_not_configured")
