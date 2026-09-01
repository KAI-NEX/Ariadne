"""Provider-specific request builders; no network call and no secret logging."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = PROJECT_ROOT / "data" / "model_contracts" / "structured_output_schema_v0.json"


@dataclass(frozen=True)
class ProviderSpec:
    name: str
    credential_env: str
    endpoint: str
    structured_output_mode: str
    notes: str


OPENAI = ProviderSpec(
    name="openai",
    credential_env="OPENAI_API_KEY",
    endpoint="https://api.openai.com/v1/responses",
    structured_output_mode="json_schema",
    notes="Use Responses structured output with strict JSON schema.",
)
DEEPSEEK = ProviderSpec(
    name="deepseek",
    credential_env="DEEPSEEK_API_KEY",
    endpoint="https://api.deepseek.com/chat/completions",
    structured_output_mode="json_object",
    notes="Use JSON Output plus local schema/boundary validation; empty content remains a handled failure.",
)
PROVIDERS = {spec.name: spec for spec in (OPENAI, DEEPSEEK)}


def output_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def instruction_text(request: dict) -> str:
    return "\n".join(request["instruction"])


def build_provider_payload(provider_name: str, request: dict, model: str) -> dict:
    """Translate one provider-independent request into one provider's API payload."""
    if provider_name == "openai":
        return {
            "model": model,
            "instructions": instruction_text(request),
            "input": json.dumps(request["input"], ensure_ascii=False),
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "jd_analysis_v0",
                    "strict": True,
                    "schema": output_schema(),
                }
            },
        }
    if provider_name == "deepseek":
        schema_instruction = json.dumps(output_schema(), ensure_ascii=False)
        return {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": f"{instruction_text(request)}\nReturn JSON matching this schema: {schema_instruction}",
                },
                {"role": "user", "content": json.dumps(request["input"], ensure_ascii=False)},
            ],
            "response_format": {"type": "json_object"},
        }
    raise ValueError("provider_not_configured")


def preflight(provider_name: str, request: dict, model: str) -> dict:
    """Report whether a real call could be attempted, without exposing a credential."""
    if provider_name not in PROVIDERS:
        raise ValueError("provider_not_configured")
    if not model.strip():
        raise ValueError("model_id_required")
    spec = PROVIDERS[provider_name]
    payload = build_provider_payload(provider_name, request, model)
    return {
        "provider": spec.name,
        "endpoint": spec.endpoint,
        "credential_env": spec.credential_env,
        "credential_present": bool(os.environ.get(spec.credential_env)),
        "ready_for_network_call": bool(os.environ.get(spec.credential_env)),
        "structured_output_mode": spec.structured_output_mode,
        "notes": spec.notes,
        "payload_top_level_keys": sorted(payload),
        "model": model,
        "network_call_made": False,
    }
