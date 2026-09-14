"""Regression for the known embedded cut and the selected blended delivery file."""
import argparse,json
import cv2
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('source');parser.add_argument('output');args=parser.parse_args()
def inspect(path):
 cap=cv2.VideoCapture(path);fps=cap.get(cv2.CAP_PROP_FPS);frames=[]
 while True:
  ok,frame=cap.read()
  if not ok:break
  frames.append(cv2.resize(frame[260:860,1200:1850],(165,150)).astype(np.float32))
 cap.release()
 delta=[float(np.abs(frames[i]-frames[i-1]).mean()) for i in range(1,len(frames))]
 return {'frames':len(frames),'fps':fps,'largest_change_frame':int(np.argmax(delta))+1,'max_change':max(delta),'median_change':float(np.median(delta)),'loop_change':float(np.abs(frames[0]-frames[-1]).mean())}
source=inspect(args.source);output=inspect(args.output)
assert source['largest_change_frame']==119,'reinspect source if the embedded cut changes'
assert output['frames']==95 and output['fps']==24
assert output['max_change']<source['max_change']*.5,'embedded flash must be removed'
assert output['max_change']<output['median_change']*3,'no new abrupt frame discontinuity'
assert output['loop_change']<output['max_change'],'file wrap is a normal-size frame change'
print(json.dumps({'source':source,'output':output,'passed':True},indent=2))
