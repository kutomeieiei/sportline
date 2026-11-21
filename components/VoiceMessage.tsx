import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2, AlertCircle } from 'lucide-react';

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Chat voice message player: play/pause button, progress bar and length.
 * Built by hand because the browser's own audio controls look different on
 * every phone and can shrink to nothing inside a chat bubble.
 */
const VoiceMessage: React.FC<{ url: string; duration?: number; isMe: boolean }> = ({ url, duration, isMe }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState(0);
  // Recordings from some browsers don't say how long they are until fully
  // played, so we also save the length when sending.
  const [total, setTotal] = useState(duration && duration > 0 ? duration : 0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const readDuration = () => { if (Number.isFinite(el.duration) && el.duration > 0) setTotal(el.duration); };
    const onTime = () => setCurrent(el.currentTime);
    const onPlaying = () => { setPlaying(true); setLoading(false); };
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setCurrent(0); readDuration(); };
    const onError = () => { setError(true); setLoading(false); setPlaying(false); };
    el.addEventListener('loadedmetadata', readDuration);
    el.addEventListener('durationchange', readDuration);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('loadedmetadata', readDuration);
      el.removeEventListener('durationchange', readDuration);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); return; }
    // Only one voice message plays at a time.
    document.querySelectorAll<HTMLAudioElement>('audio[data-voice-message]').forEach((a) => { if (a !== el) a.pause(); });
    setError(false);
    setLoading(true);
    el.play().catch((e: DOMException) => {
      setLoading(false);
      if (e?.name !== 'AbortError') setError(true);
    });
  };

  const progress = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const shownTime = playing || current > 0 ? current : total;

  return (
    <div className="flex items-center gap-3 w-52 max-w-full py-0.5">
      <audio ref={audioRef} src={url} preload="metadata" data-voice-message className="hidden" />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`press shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isMe ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}
      >
        {loading ? <Loader2 size={18} className="animate-spin" />
          : playing ? <Pause size={18} fill="currentColor" />
          : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        {error ? (
          <p className={`flex items-center gap-1 text-xs ${isMe ? 'text-white' : 'text-gray-600'}`}>
            <AlertCircle size={14} className="shrink-0" />
            <span>
              Can't play here.{' '}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline font-medium">Open</a>
            </span>
          </p>
        ) : (
          <>
            <div className={`h-1 rounded-full overflow-hidden ${isMe ? 'bg-white/35' : 'bg-gray-300'}`}>
              <div
                className={`h-full rounded-full transition-[width] duration-200 ease-linear ${isMe ? 'bg-white' : 'bg-red-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={`mt-1.5 text-xs tabular-nums ${isMe ? 'text-white/90' : 'text-gray-600'}`}>
              {total > 0 || current > 0 ? formatTime(shownTime) : 'Voice message'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceMessage;
