import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, SwitchCamera, RotateCcw, Check, Loader2, Camera } from 'lucide-react';

interface CameraCaptureProps {
  title?: string;
  /** Which camera to start with: 'user' = front (selfie), 'environment' = back. */
  initialFacing?: 'user' | 'environment';
  onCapture: (file: File) => void | Promise<void>;
  onClose: () => void;
}

/**
 * Full-screen camera: live preview, switch front/back, snap, retake, use photo.
 * Falls back to the phone's own camera app if live camera isn't available.
 */
const CameraCapture: React.FC<CameraCaptureProps> = ({ title = 'Take a photo', initialFacing = 'environment', onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>(initialFacing);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null);
  const [saving, setSaving] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startStream = useCallback(async (mode: 'user' | 'environment') => {
    stopStream();
    setStarting(true);
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live camera is not available in this browser.');
      setStarting(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow camera access in your browser settings, or use your device camera below.'
        : 'Could not open the camera.');
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!photo) startStream(facing);
    return stopStream;
  }, [facing, photo, startStream]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facing === 'user') {
      // Front camera preview is mirrored; save it the same way people see it.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopStream();
      setPhoto({ url: URL.createObjectURL(blob), blob });
    }, 'image/jpeg', 0.9);
  };

  const usePhoto = async (blob: Blob) => {
    setSaving(true);
    try {
      await onCapture(new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' }));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const onFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) usePhoto(file);
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={() => { stopStream(); onClose(); }} aria-label="Close camera" className="p-2 rounded-full bg-white/10 hover:bg-white/20">
          <X size={22} />
        </button>
        <span className="font-semibold">{title}</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {photo ? (
          <img src={photo.url} alt="Captured" className="max-w-full max-h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`max-w-full max-h-full object-contain ${facing === 'user' ? '-scale-x-100' : ''} ${error ? 'hidden' : ''}`}
          />
        )}
        {starting && !photo && <Loader2 className="absolute animate-spin text-white" size={40} />}
        {error && !photo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <Camera size={48} className="text-zinc-500" />
            <p className="text-zinc-300 text-sm max-w-xs">{error}</p>
            <button
              onClick={() => fallbackInputRef.current?.click()}
              className="px-5 py-3 rounded-full bg-white text-black font-bold active:scale-95"
            >
              Use device camera
            </button>
          </div>
        )}
        <input ref={fallbackInputRef} type="file" accept="image/*" capture={facing} className="hidden" onChange={onFallbackFile} />
      </div>

      <div className="flex items-center justify-around px-6 pt-4 pb-10">
        {photo ? (
          <>
            <button onClick={() => setPhoto(null)} disabled={saving} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
              <span className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><RotateCcw size={24} /></span>
              <span className="text-xs">Retake</span>
            </button>
            <button onClick={() => usePhoto(photo.blob)} disabled={saving} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
              <span className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/50">
                {saving ? <Loader2 className="animate-spin" size={28} /> : <Check size={30} />}
              </span>
              <span className="text-xs">Use photo</span>
            </button>
          </>
        ) : (
          <>
            <span className="w-14" />
            <button
              onClick={snap}
              disabled={starting || !!error}
              aria-label="Take photo"
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
            >
              <span className="w-16 h-16 rounded-full bg-white" />
            </button>
            {canSwitch ? (
              <button
                onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                aria-label="Switch camera"
                className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <SwitchCamera size={24} />
              </button>
            ) : <span className="w-14" />}
          </>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
