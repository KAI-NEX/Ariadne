import React, { useEffect, useRef } from 'react';
import videoSource from '../public/media/ariadne-original-soft-loop-v2.mp4';

const LOOP_DURATION_SECONDS = 8.5;

function syncPlaybackRate(video) {
  if (video && Number.isFinite(video.duration) && video.duration > 0) {
    const rate = video.duration / LOOP_DURATION_SECONDS;
    video.defaultPlaybackRate = rate;
    video.playbackRate = rate;
  }
}

export default function LoopingScene() {
  const video = useRef(null);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible') {
        syncPlaybackRate(video.current);
        video.current?.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', resume);
    resume();
    return () => document.removeEventListener('visibilitychange', resume);
  }, []);
  return <div className="fish-scene"><video ref={video} src={videoSource}
    autoPlay muted loop playsInline preload="auto" disablePictureInPicture disableRemotePlayback
    onLoadedMetadata={event => syncPlaybackRate(event.currentTarget)}
    aria-hidden="true" onPause={event => {
      // Recover an unsolicited foreground pause; never reset the playhead.
      if (document.visibilityState === 'visible' && event.currentTarget.isConnected) {
        event.currentTarget.play().catch(() => {});
      }
    }} /></div>;
}
