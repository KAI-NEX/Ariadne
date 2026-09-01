# Ariadne Visual Stabilization Audit

Date: 2026-09-01
Scope: current Visual Stabilization acceptance decisions and atomic Fix #1 only.

## Confirmed intentional design

| Surface | Result | Decision |
|---|---|---|
| JD Import visible modes | PASS — USER-CONFIRMED INTENTIONAL DESIGN | The visible modes remain `图像` and `粘贴文本`. The underlying Document input may accept PDF/PNG/JPG/JPEG/DOCX; this phase does not require exposing that full format list. This item is not a Visual Stabilization FAIL or repair-queue item. |

## Atomic Fix #1

| Surface | Previous finding | Resolution | Acceptance state |
|---|---|---|---|
| Workspace → JD folder | Dark rest identity changed to the light palette on hover and keyboard `:focus-visible`. | The light palette is now limited to `.v1-object-folder.dark.v1-transition-light`; hover/focus retain the dark palette while their existing motion remains unchanged. | Implemented; pending human acceptance. |

No JD Import implementation was changed by this audit correction.
