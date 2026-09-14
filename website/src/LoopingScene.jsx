import React, { useEffect, useRef } from 'react';
import videoSource from '../public/media/ariadne-original-blend-v2.mp4';

export default function LoopingScene() {
  const video = useRef(null);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible') video.current?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', resume);
    resume();
    return () => document.removeEventListener('visibilitychange', resume);
  }, []);
  return <div className="fish-scene"><video ref={video} src={videoSource}
    autoPlay muted loop playsInline preload="auto" disablePictureInPicture disableRemotePlayback
    aria-hidden="true" onPause={event => {
      // Recover an unsolicited foreground pause; never reset the playhead.
      if (document.visibilityState === 'visible' && event.currentTarget.isConnected) {
        event.currentTarget.play().catch(() => {});
      }
    }} /></div>;
}
