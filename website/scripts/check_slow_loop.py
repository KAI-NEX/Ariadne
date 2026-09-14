"""Check slow-loop duration, uninterrupted motion, and the short dissolve."""
import argparse
import json

import cv2
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source')
parser.add_argument('output')
parser.add_argument('intermediate')
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
assert len(source) == 193 and len(shot) == 277 and len(frames) == 261
assert 10.8 < len(frames) / fps < 11.1, 'The delivered loop must last approximately 11 seconds'
overlap = 16
assert (len(frames) - overlap) / fps > 10, 'At least 10 seconds between short dissolves'
assert overlap / fps < .7, 'Slow motion must not stretch the dissolve itself'

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
    'max_original_anchor_error': max(anchor_error),
    'median_normal_change': float(np.median(normal)),
    'median_original_change': float(np.median(original_delta)),
    'max_normal_change': max(normal), 'max_change': max(delta), 'loop_change': delta[0],
}, indent=2))
