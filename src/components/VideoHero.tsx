'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './Providers';

/** Intro video. Browsers block unmuted autoplay, so we try with sound and fall back to muted with an "unmute" button. */
export default function VideoHero({ url, poster }: { url: string; poster: string }) {
  const { toast } = useAuth(), ref = useRef<HTMLVideoElement>(null), embed = /\/embed\//.test(url);
  const [playing, setPlaying] = useState(!!url), [muted, setMuted] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => setPlaying(false)); });
  }, [url]);
  if (!url || !playing) return (
    <div className="vframe">
      {poster && /* eslint-disable-next-line @next/next/no-img-element */ <img className="thumb" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', aspectRatio: 'auto' }} src={poster} alt="" fetchPriority="high" />}
      <button className="play" aria-label="Play introduction video" onClick={() => (url ? setPlaying(true) : toast('The introduction video is coming soon.'))} />
      <span className="vcap">How the platform works · 5 min</span>
    </div>
  );
  return (
    <div className="vframe">
      {embed ? <iframe src={url + (url.includes('?') ? '&' : '?') + 'autoplay=1'} allow="autoplay; fullscreen" title="Introduction video" />
        : <video ref={ref} src={url} poster={poster || undefined} controls playsInline preload="metadata" />}
      {muted && <button className="btn sm primary" style={{ position: 'absolute', left: 12, top: 12 }} onClick={() => { if (ref.current) ref.current.muted = false; setMuted(false); }}>Tap to unmute</button>}
    </div>
  );
}
