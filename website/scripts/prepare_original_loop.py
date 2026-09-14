"""Keep the original scene, exclude its embedded cut, then blend a continuous span.
The provided 193-frame source contains a hard cut at frame 119 (4.958s).
This script retains all originals and refuses to overwrite previous renders.
"""
import argparse,json,subprocess
from pathlib import Path
import cv2
import numpy as np
import imageio_ffmpeg

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('work',type=Path)
parser.add_argument('--start-frame',type=int,default=0,help='First frame of the selected continuous shot')
parser.add_argument('--end-frame',type=int,default=119,help='Exclusive end before the source hard cut')
parser.add_argument('--overlap',type=int,default=24,help='Head/tail blend frame count')
args=parser.parse_args()
if not 0<=args.start_frame<args.end_frame<=119:raise ValueError('Selected span must stay before the known source cut at frame 119')
if not 2<args.overlap<(args.end_frame-args.start_frame)//2:raise ValueError('Overlap must fit inside the selected shot')
if args.output.exists() or args.output.resolve()==args.source.resolve():raise FileExistsError(args.output)
args.work.mkdir(parents=True,exist_ok=True)
cap=cv2.VideoCapture(str(args.source));fps=cap.get(cv2.CAP_PROP_FPS);frames=[]
for _ in range(args.end_frame):
 ok,frame=cap.read()
 if not ok:raise ValueError('Source is shorter than selected span')
 frames.append(frame)
cap.release();frames=frames[args.start_frame:];h,w=frames[0].shape[:2];n=len(frames);overlap=args.overlap
assert 2<overlap<n//2
command=[imageio_ffmpeg.get_ffmpeg_exe(),'-n','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','medium','-qp','17','-x264-params','ipratio=1:pbratio=1','-pix_fmt','yuv420p','-movflags','+faststart',str(args.output)]
with (args.work/'encode.log').open('w') as log:
 writer=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
 for i in range(overlap,n):
  result=frames[i]
  if i>=n-overlap:
   j=i-(n-overlap);t=j/(overlap-1);weight=t*t*(3-2*t)
   result=cv2.addWeighted(frames[i],1-weight,frames[j],weight,0)
   cv2.imwrite(str(args.work/f'blend-{j:03d}.png'),result)
  writer.stdin.write(result.tobytes())
 writer.stdin.close();writer.wait()
 if writer.returncode:raise RuntimeError('Encoding failed')
receipt={'source':str(args.source),'output':str(args.output),'fps':fps,'selected_source_frames':[args.start_frame,args.end_frame-1],'excluded_embedded_cut':119,'blend_frames':overlap,'output_frames':n-overlap,'duration':(n-overlap)/fps,'method':'smoothstep dissolve on original forward-moving frames; no geometric warp'}
(args.work/'receipt.json').write_text(json.dumps(receipt,indent=2));print(receipt)
