"""Optional real macOS Apple Vision smoke; excluded from ordinary contract evidence."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app  # noqa: E402


def main() -> None:
    if os.environ.get("ARIADNE_RUN_APPLE_VISION_SMOKE") != "1":
        print(json.dumps({"apple_vision_smoke": "skipped", "reason": "set_ARIADNE_RUN_APPLE_VISION_SMOKE=1"}))
        return
    if app.local_ocr_environment_capability() != "supported":
        print(json.dumps({"apple_vision_smoke": "skipped", "reason": "local_ocr_not_supported"}))
        return
    fixture = ROOT / "public" / "job-radar-multimodal-smoke.jpg"
    if not fixture.is_file():
        raise AssertionError("apple_vision_smoke_fixture_missing")
    result = app.run_apple_vision_ocr(fixture)
    assert isinstance(result["text"], str)
    assert isinstance(result["line_count"], int)
    print(json.dumps({"apple_vision_smoke": "pass", "provider_call_made": False, "line_count": result["line_count"]}))


if __name__ == "__main__":
    main()
