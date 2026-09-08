"""Fixture-only provider protocol/capability routing regression."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.provider_runtime import (
    MULTIMODAL_VERIFIED, OPENAI_CHAT_COMPLETIONS, OPENAI_RESPONSES, ProviderRuntimeError,
    ModelDescriptor, TEXT, VISION, connection_request, deepseek_model_descriptors, descriptor_for, is_multimodal,
    multimodal_connection_request, multimodal_smoke_passed, normalize_response, v1_runtime_selector_descriptors,
    v1_selector_descriptors,
    resolve_credential_reference,
)

descriptors = deepseek_model_descriptors([
    "deepseek-v4-flash", "deepseek-v4-pro", "deepseek-v4-flash-vision-exp", "account-other",
])
flash, pro, vision, unknown = descriptors
assert flash.protocol == OPENAI_RESPONSES and flash.runtime_default
assert pro.protocol == OPENAI_CHAT_COMPLETIONS
assert pro.runtime_capability_basis == "adapter_verified"
assert pro.runtime_capabilities["ai_conversation"] == "unsupported"
assert pro.runtime_capabilities["candidate_model_structuring"] == "unsupported"
assert pro.adapter_version is None and pro.delivery_method is None  # adapter identity is resolved by product operation
assert vision.protocol == OPENAI_CHAT_COMPLETIONS and vision.capabilities == (TEXT, VISION)
assert vision.multimodal_readiness == MULTIMODAL_VERIFIED and vision.discovery_source == "qualification_2026-09-03" and is_multimodal(vision)
assert vision.runtime_capability_basis == "adapter_verified"
assert vision.runtime_capabilities["candidate_model_structuring"] == "supported"
assert vision.runtime_capabilities["job_model_structuring"] == "unsupported"
assert vision.runtime_capabilities["model_merge"] == "unsupported"
assert vision.runtime_capabilities["ai_conversation"] == "unsupported"
assert vision.adapter_version == "deepseek-candidate-multimodal-v2" and vision.delivery_method == "source_or_rendered_images"
assert not is_multimodal(flash) and not is_multimodal(pro)  # provider-level vision cannot leak into text models
assert not is_multimodal(unknown)
assert descriptor_for("deepseek-v4-pro", descriptors) == pro
assert resolve_credential_reference("keychain://synthetic", "keychain://synthetic", lambda: "synthetic-secret") == "synthetic-secret"
assert v1_selector_descriptors(descriptors) == [vision]  # only the model-level official vision model is visible
assert v1_runtime_selector_descriptors(descriptors) == [vision]
verified = ModelDescriptor("fixture", "verified-vision", "Fixture vision", OPENAI_CHAT_COMPLETIONS, (TEXT, VISION), "fixture", False, MULTIMODAL_VERIFIED)
assert v1_selector_descriptors([flash, verified]) == []  # image support without PDF/adapter evidence is insufficient

responses_request = connection_request(flash)
assert responses_request.endpoint.endswith("/responses")
assert responses_request.payload["reasoning"] == {"effort": "none"}
assert responses_request.payload["max_output_tokens"] == 16
chat_request = connection_request(pro)
assert chat_request.endpoint.endswith("/chat/completions")
assert chat_request.payload["thinking"] == {"type": "disabled"}
vision_request = multimodal_connection_request(vision, "data:image/jpeg;base64,ZmFrZQ==")
assert vision_request.endpoint.endswith("/chat/completions")
assert vision_request.payload["messages"][0]["content"][0]["text"] == "Read the text in this image. Reply only with the text you see."
assert vision_request.payload["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
assert vision_request.payload["max_tokens"] == 32
assert multimodal_smoke_passed(" JOB  RADAR\nTEST ")
assert not multimodal_smoke_passed("OK")
try:
    connection_request(vision)
    raise AssertionError("vision candidate must not receive the old text-only readiness ping")
except ProviderRuntimeError as error:
    assert error.code == "selected_model_requires_multimodal_smoke"

chat = normalize_response(OPENAI_CHAT_COMPLETIONS, {"id": "chat-1", "choices": [{"message": {"content": "OK"}}], "usage": {"prompt_tokens": 2, "completion_tokens": 1}})
assert chat.text == "OK" and chat.usage["prompt_tokens"] == 2
responses_direct = normalize_response(OPENAI_RESPONSES, {"id": "response-1", "output_text": "OK", "usage": {"input_tokens": 2, "output_tokens": 1}})
assert responses_direct.text == "OK" and responses_direct.usage["output_tokens"] == 1
responses_blocks = normalize_response(OPENAI_RESPONSES, {"output": [{"content": [{"type": "output_text", "text": "O"}, {"type": "output_text", "text": "K"}]}]})
assert responses_blocks.text == "OK"
for protocol, payload in ((OPENAI_CHAT_COMPLETIONS, {"choices": [{"message": {"content": ""}}]}), (OPENAI_RESPONSES, {"output": []})):
    try:
        normalize_response(protocol, payload)
        raise AssertionError("empty output must fail closed")
    except ProviderRuntimeError as error:
        assert error.failure_layer == "unexpected_response"

print("provider_runtime_protocol_capability_contract=pass")
