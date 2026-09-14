"""Create a non-destructive, muted-color loop from the user-supplied video.
Requires numpy, opencv-python-headless and imageio-ffmpeg; source is kept intact.
Usage: python prepare_hero.py SOURCE WORKDIR OUTPUT
"""
import sys, json, subprocess
from datetime import datetime, timezone
from pathlib import Path
import cv2
import numpy as np
import imageio_ffmpeg

source, work, output = map(Path, sys.argv[1:])
work.mkdir(parents=True, exist_ok=True)
output.parent.mkdir(parents=True, exist_ok=True)
if output.resolve() == source.resolve() or output.exists():
    raise FileExistsError("Choose a new output path; source and generated media are retained")
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
cap = cv2.VideoCapture(str(source))
fps = cap.get(cv2.CAP_PROP_FPS)
w, h = int(cap.get(3)), int(cap.get(4))
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
corrected = work / f'{output.stem}-study-{stamp}.mp4'
pipe = subprocess.Popen([ffmpeg, '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', str(corrected)], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
# Per-fish identities, seeded by image-space position and propagated by nearest
# centroid. The highlighted fish is the upper, central fish in the source.
tracks = {}; next_id=1; primary=0; records=[]; primary_masks=[]; primary_position=np.array([1428.,556.])
palette=[(92,60),(113,55),(142,50),(169,55),(23,55),(70,45)]
frame_index=0
while True:
    ok,frame=cap.read()
    if not ok: break
    hsv=cv2.cvtColor(frame,cv2.COLOR_BGR2HSV)
    hue,sat,val=cv2.split(hsv)
    luminance=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    mask=(((hue<38)|(hue>173))&(sat>55)&(val>35)).astype(np.uint8)*255
    mask[:int(h*.22)]=0;mask[int(h*.80):]=0;mask[:,:int(w*.60)]=0
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    count, labels, stats, centers=cv2.connectedComponentsWithStats(mask)
    components=[j for j in range(1,count) if stats[j,4]>32]
    selected_component=min(components,key=lambda j:np.linalg.norm(centers[j]-primary_position))
    primary_position=centers[selected_component].copy()
    assignments={selected_component:primary};used={primary}
    tracks[primary]={'pos':primary_position,'last':frame_index}
    for j in sorted((j for j in components if j!=selected_component),key=lambda j:stats[j,4],reverse=True):
        x,y=centers[j]
        candidates=[(np.linalg.norm(np.array([x,y])-t['pos']),tid) for tid,t in tracks.items() if tid not in used and frame_index-t['last']<8]
        dist,tid=min(candidates,default=(1e9,-1))
        if dist>65:
            tid=next_id;next_id+=1
        used.add(tid);assignments[j]=tid
        tracks[tid]={'pos':np.array([x,y]),'last':frame_index}
    output_hsv=hsv.copy()
    selected=[]
    for j,tid in assignments.items():
        region=labels==j
        x,y,bw,bh,area=stats[j]
        if tid==primary:
            selected.append([int(x),int(y),int(bw),int(bh)])
            primary_masks.append((region[y:y+bh,x:x+bw].astype(np.uint8)*255).copy())
            # Ivory body with two softly bounded vermilion patches. Preserve
            # source luminance, contour and swimming motion rather than recolor water.
            yy,xx=np.mgrid[y:y+bh,x:x+bw]
            u=(xx-x)/max(bw,1);v=(yy-y)/max(bh,1)
            patches=(((u-.35)/.19)**2+((v-.40)/.40)**2<1)|(((u-.76)/.13)**2+((v-.55)/.32)**2<1)
            local=region[y:y+bh,x:x+bw]
            sub=output_hsv[y:y+bh,x:x+bw]
            sub[:,:,0][local]=8
            sub[:,:,1][local]=20
            sub[:,:,2][local]=(luminance[y:y+bh,x:x+bw][local]*.65+val[y:y+bh,x:x+bw][local]*.35).astype(np.uint8)
            sub[:,:,1][local&patches]=185
        else:
            newh,news=palette[tid%len(palette)]
            output_hsv[:,:,0][region]=newh
            output_hsv[:,:,1][region]=np.clip(sat[region].astype(np.float32)*.28,15,news).astype(np.uint8)
            output_hsv[:,:,2][region]=(luminance[region].astype(np.float32)*.80+val[region].astype(np.float32)*.20).astype(np.uint8)
    changed=cv2.cvtColor(output_hsv,cv2.COLOR_HSV2BGR)
    # Feather only the warm subject mask, preserving the original background.
    alpha=cv2.GaussianBlur(mask,(5,5),0).astype(np.float32)/255
    frame=np.clip(frame*(1-alpha[:,:,None])+changed*alpha[:,:,None],0,255).astype(np.uint8)
    pipe.stdin.write(frame.tobytes())
    records.append({'frame':frame_index,'primary':selected,'subjects':len(assignments)})
    frame_index+=1
pipe.stdin.close();pipe.wait();cap.release()
if pipe.returncode: raise RuntimeError('Video encoding failed')
# Rotate the clip and dissolve its ending into its opening. Align the main
# fish during the dissolve so the seam never creates two red-white subjects.
overlap=1.5;duration=frame_index/fps; overlap_frames=round(overlap*fps)
main_capture=cv2.VideoCapture(str(corrected)); main_capture.set(cv2.CAP_PROP_POS_FRAMES,overlap_frames)
start_capture=cv2.VideoCapture(str(corrected))
writer=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
def subject_mask(index):
    mask=np.zeros((h,w),np.uint8)
    x,y,bw,bh=records[index]['primary'][0]
    mask[y:y+bh,x:x+bw]=primary_masks[index]
    return cv2.dilate(mask,np.ones((7,7),np.uint8)),np.array([x+bw/2,y+bh/2])
for index in range(overlap_frames,frame_index):
    ok,frame=main_capture.read()
    if not ok: raise RuntimeError('Incomplete corrected video')
    if index>=frame_index-overlap_frames:
        j=index-(frame_index-overlap_frames)
        ok,begin=start_capture.read()
        if not ok: raise RuntimeError('Incomplete loop head')
        amount=j/(overlap_frames-1);amount=amount*amount*(3-2*amount)
        mask_a,pos_a=subject_mask(index);mask_b,pos_b=subject_mask(j)
        center=pos_a*(1-amount)+pos_b*amount
        base_a=cv2.inpaint(frame,mask_a,7,cv2.INPAINT_TELEA)
        base_b=cv2.inpaint(begin,mask_b,7,cv2.INPAINT_TELEA)
        base=base_a.astype(np.float32)*(1-amount)+base_b.astype(np.float32)*amount
        layers=[]
        for pixels,mask,pos,weight in [(frame,mask_a,pos_a,1-amount),(begin,mask_b,pos_b,amount)]:
            matrix=np.float32([[1,0,center[0]-pos[0]],[0,1,center[1]-pos[1]]])
            warped=cv2.warpAffine(pixels,matrix,(w,h)).astype(np.float32)
            alpha=cv2.warpAffine(cv2.GaussianBlur(mask,(5,5),0),matrix,(w,h)).astype(np.float32)/255*weight
            layers.append((warped,alpha[:,:,None]))
        frame=np.clip(base*(1-layers[0][1]-layers[1][1])+sum(pixels*alpha for pixels,alpha in layers),0,255).astype(np.uint8)
    writer.stdin.write(frame.tobytes())
writer.stdin.close();writer.wait();main_capture.release();start_capture.release()
if writer.returncode: raise RuntimeError('Loop encoding failed')
(work/f'{output.stem}-receipt-{stamp}.json').write_text(json.dumps({'source':str(source),'fps':fps,'frames':frame_index,'duration':duration,'overlap':overlap,'output_frames':frame_index-overlap_frames,'primary_missing_frames':sum(not r['primary'] for r in records),'tracking':records},indent=2))
print(json.dumps({'output':str(output),'frames':frame_index-overlap_frames,'primary_missing_frames':sum(not r['primary'] for r in records)}))
