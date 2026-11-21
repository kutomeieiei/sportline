import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera, Minimize2, Users, Loader2,
} from 'lucide-react';
import { db } from '../firebase';
import { User } from '../types';
import { fallbackAvatar } from '../utils/image';
import {
  CallDoc, CallSession, CallType, RemotePeer, MAX_CALL_SIZE, RING_TIMEOUT_MS,
  callAgeMs, callsRef, createCall, declineCall, endUnansweredCall, getLocalMedia, toCallDoc,
} from '../services/callService';
import { CallContext, StartCallOptions } from '../services/callContext';

interface Profile { name: string; avatar: string }

// ---------- small helpers ----------

const formatClock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ''}${h > 0 ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
};

/** Plays a soft repeating ring using the Web Audio API (no sound file needed). */
function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let ctx: AudioContext | null = null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
    } catch {
      return;
    }
    const ring = () => {
      if (!ctx) return;
      [0, 0.4].forEach((offset) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.frequency.value = 480;
        gain.gain.setValueAtTime(0.0001, ctx!.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx!.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + offset + 0.3);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(ctx!.currentTime + offset);
        osc.stop(ctx!.currentTime + offset + 0.32);
      });
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    };
    ring();
    const id = setInterval(ring, 2500);
    return () => { clearInterval(id); ctx?.close().catch(() => {}); };
  }, [active]);
}

const MediaTile: React.FC<{
  stream: MediaStream | null; muted?: boolean; mirrored?: boolean; showVideo: boolean;
  profile: Profile; label?: string; className?: string; status?: string;
}> = ({ stream, muted, mirrored, showVideo, profile, label, className = '', status }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
    if (audioRef.current && audioRef.current.srcObject !== stream) audioRef.current.srcObject = stream;
  }, [stream, showVideo]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 ${className}`}>
      {showVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={muted}
          className={`w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''}`} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
          <img src={profile.avatar} alt={profile.name} className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-zinc-700" />
          {!muted && <audio ref={audioRef} autoPlay />}
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
        <span className="px-2 py-1 rounded-lg bg-black/60 text-white text-xs font-semibold truncate">{label || profile.name}</span>
        {status && <span className="px-2 py-1 rounded-lg bg-black/60 text-amber-300 text-[10px] font-semibold">{status}</span>}
      </div>
    </div>
  );
};

const RoundButton: React.FC<{
  onClick: () => void; label: string; danger?: boolean; off?: boolean; children: React.ReactNode; disabled?: boolean;
}> = ({ onClick, label, danger, off, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40
      ${danger ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50'
        : off ? 'bg-white text-zinc-900 hover:bg-zinc-200'
        : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
  >
    {children}
  </button>
);

// ---------- provider ----------

const CallProvider: React.FC<{ currentUser: User; children: React.ReactNode }> = ({ currentUser, children }) => {
  const myUid = currentUser.uid;

  const [activeCalls, setActiveCalls] = useState<CallDoc[]>([]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const sessionRef = useRef<CallSession | null>(null);
  const lastCallRef = useRef<CallDoc | null>(null);

  // Calls that include me and are still going.
  useEffect(() => {
    if (!myUid) return;
    return callsRef().where('activeFor', 'array-contains', myUid).onSnapshot(
      (snap) => setActiveCalls(snap.docs.map(toCallDoc).filter((c) => c.status !== 'ended' && callAgeMs(c) < 4 * 3600_000)),
      (err) => console.error('Call listener failed', err),
    );
  }, [myUid]);

  // Live copy of the call I'm in (even after it ends, so I can show why).
  const [currentCall, setCurrentCall] = useState<CallDoc | null>(null);
  useEffect(() => {
    if (!currentCallId) { setCurrentCall(null); return; }
    return callsRef().doc(currentCallId).onSnapshot((snap) => {
      if (snap.exists) {
        const call = toCallDoc(snap);
        lastCallRef.current = call;
        setCurrentCall(call);
      }
    });
  }, [currentCallId]);

  // Load names and photos for everyone in calls I can see.
  useEffect(() => {
    const uids = new Set<string>();
    activeCalls.forEach((c) => c.participants.forEach((u) => uids.add(u)));
    currentCall?.participants.forEach((u) => uids.add(u));
    const missing = Array.from(uids).filter((u) => !profiles[u]);
    if (missing.length === 0) return;
    Promise.all(missing.map((uid) => db.collection('users').doc(uid).get().then((snap) => {
      const u = (snap.data() || {}) as Partial<User>;
      const name = u.display_name || u.displayName || u.username || 'Player';
      return [uid, { name, avatar: u.profile_img_url || u.avatarUrl || fallbackAvatar(name) }] as const;
    }).catch(() => [uid, { name: 'Player', avatar: fallbackAvatar('Player') }] as const)))
      .then((entries) => setProfiles((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
  }, [activeCalls, currentCall, profiles]);

  const profileOf = useCallback((uid: string): Profile =>
    profiles[uid] || { name: '…', avatar: fallbackAvatar('?') }, [profiles]);

  // Clock for call duration and ring timeouts.
  useEffect(() => {
    if (!currentCallId && activeCalls.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [currentCallId, activeCalls.length]);

  // Caller: stop ringing after RING_TIMEOUT_MS if nobody answers.
  useEffect(() => {
    if (!currentCall || currentCall.status !== 'ringing' || currentCall.createdBy !== myUid) return;
    const left = RING_TIMEOUT_MS - callAgeMs(currentCall);
    const id = setTimeout(() => { endUnansweredCall(currentCall.id).catch(() => {}); }, Math.max(1000, left));
    return () => clearTimeout(id);
  }, [currentCall, myUid]);

  // Leave the call if the page is closed.
  useEffect(() => {
    const onUnload = () => { sessionRef.current?.leave(); };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, []);

  const showNotice = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000);
  };

  const handleEnded = useCallback(() => {
    const last = lastCallRef.current;
    sessionRef.current = null;
    setLocalStream(null);
    setPeers([]);
    setCurrentCallId(null);
    setMinimized(false);
    if (!last) return;
    // Read the final state so we can say why the call ended.
    callsRef().doc(last.id).get().then((snap) => {
      const call = snap.exists ? toCallDoc(snap) : last;
      if (!call.answeredAt && call.createdBy === myUid) {
        const others = call.participants.filter((u) => u !== myUid);
        showNotice(!call.isGroup && others.some((u) => (call.declined || []).includes(u)) ? 'Call declined' : 'No answer');
      } else {
        showNotice('Call ended');
      }
    }).catch(() => showNotice('Call ended'));
  }, [myUid]);

  const openSession = async (callId: string, type: CallType, alreadyJoined: boolean) => {
    const stream = await getLocalMedia(type, 'user');
    setMicOn(true);
    setCamOn(type === 'video');
    setFacing('user');
    setLocalStream(stream);
    navigator.mediaDevices.enumerateDevices?.()
      .then((d) => setHasMultipleCameras(d.filter((x) => x.kind === 'videoinput').length > 1))
      .catch(() => {});
    const session = new CallSession(callId, myUid, stream, setPeers, handleEnded);
    sessionRef.current = session;
    setCurrentCallId(callId);
    try {
      await session.join(alreadyJoined);
    } catch (e) {
      await session.leave();
      throw e;
    }
  };

  const startCall = async (opts: StartCallOptions) => {
    if (sessionRef.current || busy) { showNotice("You're already in a call."); return; }
    const existing = activeCalls.find((c) => c.chatId === opts.chatId && c.isGroup);
    if (existing) { await joinCall(existing); return; }
    setBusy(true);
    let callId: string | null = null;
    try {
      // Ask for camera/mic first so we don't ring people if access is blocked.
      const probe = await getLocalMedia(opts.type);
      probe.getTracks().forEach((t) => t.stop());
      callId = await createCall({ ...opts, myUid });
      await openSession(callId, opts.type, true);
    } catch (e) {
      if (callId) endUnansweredCall(callId).catch(() => {});
      alert((e as Error).message || 'Could not start the call.');
    } finally {
      setBusy(false);
    }
  };

  const joinCall = async (call: CallDoc) => {
    if (sessionRef.current) {
      if (sessionRef.current && currentCallId === call.id) { setMinimized(false); return; }
      showNotice("You're already in a call."); return;
    }
    setBusy(true);
    try {
      await openSession(call.id, call.type, false);
    } catch (e) {
      alert((e as Error).message || 'Could not join the call.');
    } finally {
      setBusy(false);
    }
  };

  const decline = async (call: CallDoc) => {
    setDismissed((s) => new Set(s).add(call.id));
    await declineCall(call, myUid).catch(() => {});
  };

  const hangUp = () => { sessionRef.current?.leave(); };

  const toggleMic = () => { const on = !micOn; sessionRef.current?.setMicEnabled(on); setMicOn(on); };
  const toggleCam = () => { const on = !camOn; sessionRef.current?.setCameraEnabled(on); setCamOn(on); };
  const flipCamera = async () => {
    const next = facing === 'user' ? 'environment' : 'user';
    try {
      await sessionRef.current?.switchCamera(next);
      setFacing(next);
      setLocalStream(sessionRef.current ? new MediaStream(sessionRef.current.localStream.getTracks()) : null);
    } catch {
      showNotice("Couldn't switch camera.");
    }
  };

  // Someone is calling me (or a group call started that I'm not in yet).
  const incoming = useMemo(() => activeCalls.find((c) =>
    c.id !== currentCallId
    && !dismissed.has(c.id)
    && !c.joined.includes(myUid)
    && !(c.declined || []).includes(myUid)
    && callAgeMs(c) < RING_TIMEOUT_MS + 5000
    && (c.status === 'ringing' || c.isGroup),
  ) || null, [activeCalls, currentCallId, dismissed, myUid, now]); // eslint-disable-line

  useRingtone(!!incoming && !sessionRef.current);

  const inCall = !!currentCallId && !!currentCall;
  const isVideo = currentCall?.type === 'video';
  const others = currentCall ? currentCall.participants.filter((u) => u !== myUid) : [];
  const answeredAt = currentCall?.answeredAt?.toMillis?.();
  const statusText = !currentCall ? ''
    : currentCall.status === 'ringing' ? (currentCall.isGroup ? 'Ringing the group…' : 'Calling…')
    : peers.length === 0 ? (currentCall.isGroup ? 'Waiting for others to join…' : 'Connecting…')
    : answeredAt ? formatClock(now - answeredAt) : 'Connected';
  const title = currentCall
    ? (currentCall.isGroup ? currentCall.title : profileOf(others[0] || '').name)
    : '';

  const ctxValue = useMemo(() => ({ currentCall: inCall ? currentCall : null, activeCalls, startCall, joinCall }),
    [inCall, currentCall, activeCalls]); // eslint-disable-line

  return (
    <CallContext.Provider value={ctxValue}>
      {children}

      {/* Short messages like "Call ended" */}
      {notice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[6000] px-4 py-2 rounded-full bg-zinc-800 text-white text-sm font-semibold shadow-xl border border-zinc-700">
          {notice}
        </div>
      )}

      {busy && !inCall && (
        <div className="fixed inset-0 z-[5500] bg-black/60 flex items-center justify-center">
          <Loader2 className="animate-spin text-white" size={40} />
        </div>
      )}

      {/* Incoming call */}
      {incoming && !inCall && !busy && (
        <div className="fixed inset-0 z-[5500] bg-zinc-950/95 backdrop-blur flex flex-col items-center justify-between py-16 px-6 animate-in fade-in duration-200">
          <div className="flex flex-col items-center text-center gap-4">
            <p className="text-zinc-400 text-sm font-semibold uppercase tracking-wider">
              {incoming.isGroup ? 'Group ' : ''}{incoming.type === 'video' ? 'video' : 'voice'} call
            </p>
            {incoming.isGroup ? (
              <div className="w-28 h-28 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-700 animate-pulse">
                <Users size={48} className="text-zinc-300" />
              </div>
            ) : (
              <img src={profileOf(incoming.createdBy).avatar} alt="" className="w-28 h-28 rounded-full object-cover border-2 border-zinc-700 animate-pulse" />
            )}
            <h2 className="text-2xl font-bold text-white">
              {incoming.isGroup ? incoming.title : profileOf(incoming.createdBy).name}
            </h2>
            {incoming.isGroup && (
              <p className="text-zinc-400 text-sm">{profileOf(incoming.createdBy).name} started a call · {incoming.joined.length} in call</p>
            )}
          </div>
          <div className="flex items-center gap-16">
            <div className="flex flex-col items-center gap-2">
              <RoundButton onClick={() => decline(incoming)} label="Decline" danger><PhoneOff size={26} /></RoundButton>
              <span className="text-zinc-400 text-xs">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => joinCall(incoming)}
                aria-label="Accept"
                className="w-14 h-14 rounded-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/50 active:scale-90 transition-all"
              >
                {incoming.type === 'video' ? <Video size={26} /> : <Phone size={26} />}
              </button>
              <span className="text-zinc-400 text-xs">{incoming.isGroup ? 'Join' : 'Accept'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Minimized call bar */}
      {inCall && minimized && (
        <button
          onClick={() => setMinimized(false)}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[5500] flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white text-sm font-bold shadow-xl"
        >
          {isVideo ? <Video size={16} /> : <Phone size={16} />}
          <span className="truncate max-w-[160px]">{title}</span>
          <span className="opacity-80">· {statusText}</span>
        </button>
      )}

      {/* In-call screen */}
      {inCall && !minimized && (
        <div className="fixed inset-0 z-[5000] bg-zinc-950 flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg truncate">{title}</h2>
              <p className="text-zinc-400 text-sm">{statusText}</p>
            </div>
            <button onClick={() => setMinimized(true)} aria-label="Minimize call" className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700">
              <Minimize2 size={20} />
            </button>
          </div>

          <div className="flex-1 relative p-3 min-h-0">
            {peers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="flex -space-x-4">
                  {others.slice(0, 4).map((uid) => (
                    <img key={uid} src={profileOf(uid).avatar} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-zinc-950 animate-pulse" />
                  ))}
                </div>
                <p className="text-zinc-400 text-sm">{statusText}</p>
                {currentCall!.isGroup && (
                  <p className="text-zinc-600 text-xs">Up to {MAX_CALL_SIZE} people can be in a group call.</p>
                )}
              </div>
            ) : (
              <div className={`h-full grid gap-3 ${peers.length === 1 ? 'grid-cols-1' : peers.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-3'} auto-rows-fr`}>
                {peers.map((p) => (
                  <MediaTile
                    key={p.uid}
                    stream={p.stream}
                    showVideo={!!isVideo && p.stream.getVideoTracks().length > 0}
                    profile={profileOf(p.uid)}
                    status={p.state === 'connected' ? undefined : p.state === 'failed' || p.state === 'disconnected' ? 'Reconnecting…' : 'Connecting…'}
                    className="w-full h-full min-h-[140px]"
                  />
                ))}
              </div>
            )}

            {/* My own camera, small in the corner */}
            {isVideo && localStream && (
              <div className="absolute bottom-5 right-5 w-28 h-40 md:w-40 md:h-56 shadow-2xl z-10">
                <MediaTile
                  stream={localStream}
                  muted
                  mirrored={facing === 'user'}
                  showVideo={camOn}
                  profile={profileOf(myUid)}
                  label="You"
                  className="w-full h-full"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 md:gap-6 px-4 pt-3 pb-8">
            <RoundButton onClick={toggleMic} label={micOn ? 'Mute microphone' : 'Unmute microphone'} off={!micOn}>
              {micOn ? <Mic size={24} /> : <MicOff size={24} />}
            </RoundButton>
            {isVideo && (
              <RoundButton onClick={toggleCam} label={camOn ? 'Turn camera off' : 'Turn camera on'} off={!camOn}>
                {camOn ? <Video size={24} /> : <VideoOff size={24} />}
              </RoundButton>
            )}
            {isVideo && hasMultipleCameras && (
              <RoundButton onClick={flipCamera} label="Switch camera" disabled={!camOn}>
                <SwitchCamera size={24} />
              </RoundButton>
            )}
            <RoundButton onClick={hangUp} label="End call" danger>
              <PhoneOff size={24} />
            </RoundButton>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
};

export default CallProvider;
