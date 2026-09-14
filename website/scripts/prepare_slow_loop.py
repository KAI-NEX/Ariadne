"""Slow the continuous original shot before applying a short, fixed-time dissolve.

Motion interpolation runs only between neighboring source frames, never across
the source's embedded cut or the loop dissolve. Earlier artifacts are retained.
"""
import argparse
import json
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('work', type=Path)
parser.add_argument('--intermediate', type=Path, help='Reuse a retained lossless slow shot from this recipe')
args = parser.parse_args()
shot = args.intermediate or args.work / 'slow-shot.mkv'
if args.output.exists() or (not args.intermediate and shot.exists()) or args.output.resolve() == args.source.resolve():
    raise FileExistsError('Keep existing outputs; choose a new output and work directory')
args.work.mkdir(parents=True, exist_ok=True)
args.output.parent.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
fps, slowdown, start, end, overlap = 24, 3, 25, 119, 16
# Reserve frame 118 as interpolation lookahead. The delivered shot ends at 117;
# 92 source-frame intervals become 276 intervals, without a held endpoint.
shot_frames = (end - start - 2) * slowdown + 1
filters = (
    f'trim=start_frame={start}:end_frame={end},setpts=PTS-STARTPTS,'
    'tpad=stop_mode=clone:stop_duration=0.125,'
    f'setpts={slowdown}*PTS,'
    f'minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:'
    'me=epzs:vsbmc=1:search_param=16,'
    f'trim=end_frame={shot_frames},setpts=PTS-STARTPTS'
)
if not args.intermediate:
    with (args.work / 'interpolate.log').open('w') as log:
        subprocess.run([
            ffmpeg, '-n', '-i', str(args.source), '-an', '-vf', filters,
            '-c:v', 'ffv1', '-threads', '2', str(shot),
        ], stderr=log, stdout=log, check=True)

capture = cv2.VideoCapture(str(shot))
width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
if capture.get(cv2.CAP_PROP_FPS) != fps:
    raise ValueError('Intermediate frame rate does not match the delivery clock')
command = [
    ffmpeg, '-n', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{width}x{height}',
    '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast',
    '-threads', '2', '-qp', '17', '-x264-params', 'ipratio=1:pbratio=1',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(args.output),
]
head = []
with (args.work / 'encode.log').open('w') as log:
    with subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log) as writer:
        try:
            for i in range(shot_frames):
                ok, frame = capture.read()
                if not ok:
                    raise ValueError(f'Intermediate ended early at frame {i}')
                if i < overlap:
                    head.append(frame)
                    continue
                if i >= shot_frames - overlap:
                    j = i - (shot_frames - overlap)
                    t = j / (overlap - 1)
                    weight = t * t * (3 - 2 * t)
                    frame = cv2.addWeighted(frame, 1 - weight, head[j], weight, 0)
                    cv2.imwrite(str(args.work / f'blend-{j:02d}.png'), frame)
                writer.stdin.write(frame.tobytes())
            # Matroska's reported frame count is duration-derived and can be
            # off by one; validate the actual decoded stream instead.
            if capture.read()[0]:
                raise ValueError('Intermediate is longer than this recipe')
        finally:
            capture.release()
            writer.stdin.close()
        if writer.wait():
            raise RuntimeError('Delivery encoding failed; inspect encode.log')

receipt = {
    'source': str(args.source), 'output': str(args.output),
    'source_frames': [start, end - 2], 'source_speed': 1 / slowdown,
    'intermediate': str(shot),
    'fps': fps, 'intermediate_frames': shot_frames,
    'output_frames': shot_frames - overlap, 'duration': (shot_frames - overlap) / fps,
    'blend_frames': overlap, 'blend_seconds': overlap / fps,
    'unblended_seconds': (shot_frames - 2 * overlap) / fps,
    'method': 'neighboring-frame motion interpolation, then whole-frame smoothstep dissolve',
}
(args.work / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
