"""Check slow-loop duration, uninterrupted motion, and dissolve timing."""
import argparse
import json

import cv2
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source')
parser.add_argument('output')
parser.add_argument('intermediate')
parser.add_argument('--overlap', type=int, default=16)
parser.add_argument('--loop-seconds', type=float, help='Effective browser loop duration')
parser.add_argument('--expected-blend-seconds', type=float, default=3.0)
args = parser.parse_args()


def decode(path):
    capture = cv2.VideoCapture(path)
    fps = capture.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frames.append(cv2.resize(frame[260:860,1200:1850], (165, 150)).astype(np.float32))
    capture.release()
    return fps, frames


source_fps, source = decode(args.source)
fps, frames = decode(args.output)
shot_fps, shot = decode(args.intermediate)
assert fps == source_fps == shot_fps == 24
overlap = args.overlap
assert len(source) == 193 and len(shot) == 277 and len(frames) == 277 - overlap
if args.loop_seconds is None:
    assert 10.8 < len(frames) / fps < 11.1, 'The delivered loop must last approximately 11 seconds'
    assert (len(frames) - overlap) / fps > 10, 'At least 10 seconds between short dissolves'
    assert overlap / fps < .7, 'Slow motion must not stretch the dissolve itself'
else:
    assert args.loop_seconds == 8.5
    effective_blend = args.loop_seconds * overlap / len(frames)
    assert abs(effective_blend - args.expected_blend_seconds) < args.loop_seconds / len(frames), 'Dissolve duration must match the requested duration within one output frame'

# Interpolation must keep the original frames on their expected timestamps.
anchor_error = [float(np.abs(shot[i * 3] - source[25 + i]).mean()) for i in range(93)]
assert max(anchor_error) < 1, 'Original motion anchors must be preserved while retiming'
delta = [float(np.abs(frames[i] - frames[i - 1]).mean()) for i in range(len(frames))]
original_delta = [float(np.abs(source[i] - source[i - 1]).mean()) for i in range(26,119)]
normal = delta[1:len(frames) - overlap]
assert min(normal) > .01, 'No held still frames during ordinary swimming'
assert np.median(normal) < np.median(original_delta) * .65, 'Swimming should visibly slow down'
assert max(normal) < max(original_delta), 'Slowdown must not introduce a motion spike'
assert max(delta) < 9, 'Dissolve must stay below the original hard-cut discontinuity'
assert delta[0] < max(normal), 'Native loop wrap must be an ordinary slow-motion step'
print(json.dumps({
    'passed': True, 'duration': len(frames) / fps,
    'unblended_seconds': (len(frames) - overlap) / fps,
    'blend_seconds': overlap / fps, 'frames': len(frames), 'fps': fps,
    'effective_loop_seconds': args.loop_seconds,
    'effective_blend_seconds': args.loop_seconds * overlap / len(frames) if args.loop_seconds else overlap / fps,
    'max_original_anchor_error': max(anchor_error),
    'median_normal_change': float(np.median(normal)),
    'median_original_change': float(np.median(original_delta)),
    'max_normal_change': max(normal), 'max_change': max(delta), 'loop_change': delta[0],
}, indent=2))
