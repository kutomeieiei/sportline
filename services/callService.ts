import { db, firebase } from '../firebase';

// ---------------------------------------------------------------------------
// Voice / video calls
//
// How it works:
// - A call is a Firestore doc in `calls/{callId}`. It lists who may join
//   (`participants`), who is in the call right now (`joined`), and who should
//   still see it as ringing / joinable (`activeFor`).
// - Media goes directly between browsers with WebRTC. In group calls every
//   person connects to every other person (a "mesh"), which works well for
//   small groups (up to MAX_CALL_SIZE people).
// - Browsers exchange connection details ("offer", "answer", "candidate")
//   through `calls/{callId}/signals`. Whoever joins later sends the offer.
// ---------------------------------------------------------------------------

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended';

export interface CallDoc {
  id: string;
  chatId: string;
  isGroup: boolean;
  title: string;
  type: CallType;
  createdBy: string;
  participants: string[];
  joined: string[];
  declined: string[];
  activeFor: string[];
  status: CallStatus;
  createdAt?: firebase.firestore.Timestamp | null;
  answeredAt?: firebase.firestore.Timestamp | null;
}

// Most people's upload is the limit in a mesh call; 6 keeps video smooth on phones.
export const MAX_CALL_SIZE = 6;
// How long a call rings before it counts as missed.
export const RING_TIMEOUT_MS = 45_000;
// If two people can't reach each other within this time, the network is
// blocking the call (usually needs a TURN relay), so stop trying.
export const CONNECT_TIMEOUT_MS = 20_000;

/** Why a call ended on this device. */
export type CallEndReason = 'ended' | 'connection-failed';

// Free public STUN servers. Optional TURN relay (for strict networks) can be
// added with VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL.
export const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map(u => u.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    });
  }
  return servers;
};

export const hasTurnRelay = () => !!import.meta.env.VITE_TURN_URL;

export const callsRef = () => db.collection('calls');

export const toCallDoc = (snap: firebase.firestore.DocumentSnapshot): CallDoc =>
  ({ id: snap.id, ...(snap.data() as Omit<CallDoc, 'id'>) });

export const callAgeMs = (call: CallDoc) => {
  const created = call.createdAt?.toMillis?.();
  return created ? Date.now() - created : 0;
};

export async function getLocalMedia(type: CallType, facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Calls need a secure (https) page and a browser that supports camera/microphone.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: type === 'video' ? { facingMode, width: { ideal: 640 }, height: { ideal: 480 } } : false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error(`Please allow ${type === 'video' ? 'camera and microphone' : 'microphone'} access in your browser to make calls.`);
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new Error(type === 'video' ? 'No camera or microphone was found on this device.' : 'No microphone was found on this device.');
    }
    if (name === 'NotReadableError') {
      throw new Error('Your camera or microphone is being used by another app. Close it and try again.');
    }
    throw new Error('Could not start your camera or microphone.');
  }
}

/** Creates the call document. The caller is the first one in `joined`. */
export async function createCall(opts: {
  chatId: string; isGroup: boolean; title: string; type: CallType; myUid: string; participants: string[];
}): Promise<string> {
  const participants = Array.from(new Set([...opts.participants, opts.myUid]));
  if (participants.length < 2) throw new Error('There is nobody else in this chat to call.');
  if (participants.length > 12) throw new Error('Group calls are limited to chats with 12 members or fewer.');

  const ref = callsRef().doc();
  await ref.set({
    chatId: opts.chatId,
    isGroup: opts.isGroup,
    title: opts.title,
    type: opts.type,
    createdBy: opts.myUid,
    participants,
    joined: [opts.myUid],
    declined: [],
    activeFor: participants,
    status: 'ringing',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function declineCall(call: CallDoc, myUid: string) {
  const ref = callsRef().doc(call.id);
  if (!call.isGroup && call.status === 'ringing') {
    // 1-to-1: declining ends the call for the caller too.
    await ref.update({ status: 'ended', activeFor: [], declined: firebase.firestore.FieldValue.arrayUnion(myUid) });
  } else {
    await ref.update({
      declined: firebase.firestore.FieldValue.arrayUnion(myUid),
      activeFor: firebase.firestore.FieldValue.arrayRemove(myUid),
    });
  }
}

/** Ends a call nobody answered (used by the caller's ring timer). */
export async function endUnansweredCall(callId: string) {
  const ref = callsRef().doc(callId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() as CallDoc;
    if (data.status === 'ringing') tx.update(ref, { status: 'ended', activeFor: [] });
  });
}

export interface RemotePeer {
  uid: string;
  stream: MediaStream;
  state: RTCPeerConnectionState;
  /** How loud the sound arriving from this person is right now (0 to 1). */
  audioLevel: number;
}

type SignalType = 'offer' | 'answer' | 'candidate';
interface SignalDoc {
  from: string;
  to: string;
  type: SignalType;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  createdAt?: firebase.firestore.Timestamp | null;
}

// Signals must be handled in the order they were sent (offer before its
// candidates). Firestore returns them by document id, which is random.
const signalOrder = (s: SignalDoc) => [s.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER, s.type === 'candidate' ? 1 : 0];
const bySentOrder = (a: SignalDoc, b: SignalDoc) => {
  const [ta, ka] = signalOrder(a);
  const [tb, kb] = signalOrder(b);
  return ta - tb || ka - kb;
};

/**
 * One person's side of a call. Create it after `getLocalMedia`, then `join()`.
 */
export class CallSession {
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private unsubscribers: Array<() => void> = [];
  private failTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private connectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private audioLevels = new Map<string, number>();
  private lastAudioEnergy = new Map<string, { energy: number; duration: number }>();
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private signalQueue: Promise<void> = Promise.resolve();
  private iceServers = buildIceServers();
  private left = false;
  private everConnected = false;
  private triedToConnect = false;
  private connectionFailed = false;
  private leftOnPurpose = false;

  constructor(
    private callId: string,
    private myUid: string,
    public localStream: MediaStream,
    private onPeersChanged: (peers: RemotePeer[]) => void,
    private onCallEnded: (reason: CallEndReason) => void,
  ) {}

  private get callRef() { return callsRef().doc(this.callId); }
  private get signalsRef() { return this.callRef.collection('signals'); }

  /** Joins the call. `alreadyJoined` is true for the caller (added at creation). */
  async join(alreadyJoined: boolean) {
    // 1. Listen for signals sent to me, and handle them one at a time in the
    //    order they were sent (handling a candidate before its offer loses it).
    this.unsubscribers.push(
      this.signalsRef.where('to', '==', this.myUid).onSnapshot((snap) => {
        const added = snap.docChanges().filter((change) => change.type === 'added');
        added.forEach((change) => change.doc.ref.delete().catch(() => {}));
        added.map((change) => change.doc.data() as SignalDoc).sort(bySentOrder).forEach((signal) => {
          this.signalQueue = this.signalQueue
            .then(() => this.handleSignal(signal))
            .catch((e) => console.warn('Call signal failed', e));
        });
      }, (err) => console.error('Call signal listener failed', err)),
    );
    this.statsTimer = setInterval(() => { this.pollAudioLevels(); }, 500);

    // 2. Join: add myself, and remember who was already there (I call them).
    let existing: string[] = [];
    if (!alreadyJoined) {
      existing = await db.runTransaction(async (tx) => {
        const snap = await tx.get(this.callRef);
        if (!snap.exists) throw new Error('This call no longer exists.');
        const call = snap.data() as CallDoc;
        if (call.status === 'ended') throw new Error('This call has already ended.');
        const others = (call.joined || []).filter((u) => u !== this.myUid);
        if (others.length + 1 > MAX_CALL_SIZE) throw new Error(`This call is full (max ${MAX_CALL_SIZE} people).`);
        const update: Record<string, unknown> = {
          joined: firebase.firestore.FieldValue.arrayUnion(this.myUid),
          status: 'active',
        };
        if (call.status === 'ringing') update.answeredAt = firebase.firestore.FieldValue.serverTimestamp();
        tx.update(this.callRef, update);
        return others;
      });
    }

    // 3. Watch the call: close connections to people who left, end when over.
    this.unsubscribers.push(
      this.callRef.onSnapshot((snap) => {
        if (!snap.exists) { this.finish(); return; }
        const call = snap.data() as CallDoc;
        if (call.status === 'ended') { this.finish(); return; }
        const joined = new Set(call.joined || []);
        for (const uid of Array.from(this.peers.keys())) {
          if (!joined.has(uid)) this.closePeer(uid);
        }
      }),
    );

    // 4. Send offers to everyone who was already in the call.
    for (const uid of existing) {
      await this.makeOffer(uid);
    }
  }

  private emit() {
    const list: RemotePeer[] = [];
    this.peers.forEach((pc, uid) => {
      list.push({
        uid,
        stream: this.remoteStreams.get(uid) || new MediaStream(),
        state: pc.connectionState,
        audioLevel: this.audioLevels.get(uid) || 0,
      });
    });
    this.onPeersChanged(list);
  }

  private async send(to: string, data: Omit<SignalDoc, 'from' | 'to'>) {
    if (this.left) return;
    await this.signalsRef.add({ ...data, from: this.myUid, to, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  private createPeer(uid: string, keepQueuedCandidates = false): RTCPeerConnection {
    // Candidates that arrived just before this person's offer belong to it.
    const queued = keepQueuedCandidates ? this.pendingCandidates.get(uid) : undefined;
    this.closePeer(uid, false);
    if (queued) this.pendingCandidates.set(uid, queued);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peers.set(uid, pc);
    this.remoteStreams.set(uid, new MediaStream());
    this.triedToConnect = true;
    // Give up on this person if we can't reach them in time.
    this.connectTimers.set(uid, setTimeout(() => {
      this.connectTimers.delete(uid);
      if (pc.connectionState !== 'connected') this.handlePeerLost(uid);
    }, CONNECT_TIMEOUT_MS));

    this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));

    pc.ontrack = (event) => {
      const stream = this.remoteStreams.get(uid) || new MediaStream();
      if (!stream.getTracks().includes(event.track)) stream.addTrack(event.track);
      // New MediaStream object so React re-renders the <video>.
      this.remoteStreams.set(uid, new MediaStream(stream.getTracks()));
      this.emit();
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) this.send(uid, { type: 'candidate', candidate: event.candidate.toJSON() }).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      const pending = this.failTimers.get(uid);
      if (pending) { clearTimeout(pending); this.failTimers.delete(uid); }
      if (state === 'connected') {
        this.everConnected = true;
        const t = this.connectTimers.get(uid);
        if (t) { clearTimeout(t); this.connectTimers.delete(uid); }
      }
      // If someone's connection drops for good (app closed, lost signal), stop waiting for them.
      if (state === 'failed' || state === 'disconnected') {
        this.failTimers.set(uid, setTimeout(() => this.handlePeerLost(uid), state === 'failed' ? 3_000 : 15_000));
      }
      this.emit();
    };
    this.emit();
    return pc;
  }

  private async makeOffer(uid: string) {
    const pc = this.createPeer(uid);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.send(uid, { type: 'offer', sdp: offer.sdp });
  }

  private async handleSignal(signal: SignalDoc) {
    if (this.left) return;
    const uid = signal.from;
    if (signal.type === 'offer') {
      const pc = this.createPeer(uid, true);
      await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      await this.flushCandidates(uid);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.send(uid, { type: 'answer', sdp: answer.sdp });
    } else if (signal.type === 'answer') {
      const pc = this.peers.get(uid);
      if (!pc || pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      await this.flushCandidates(uid);
    } else if (signal.type === 'candidate' && signal.candidate) {
      const pc = this.peers.get(uid);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(signal.candidate).catch(() => {});
      } else {
        const queue = this.pendingCandidates.get(uid) || [];
        queue.push(signal.candidate);
        this.pendingCandidates.set(uid, queue);
      }
    }
  }

  private async flushCandidates(uid: string) {
    const pc = this.peers.get(uid);
    const queue = this.pendingCandidates.get(uid) || [];
    this.pendingCandidates.delete(uid);
    if (!pc) return;
    for (const c of queue) await pc.addIceCandidate(c).catch(() => {});
  }

  private async handlePeerLost(uid: string) {
    const pc = this.peers.get(uid);
    if (!pc || pc.connectionState === 'connected') return;
    this.closePeer(uid);
    // In a 1-to-1 call, the other person is gone, so the call is over.
    // In a group call, just drop that one connection and keep talking.
    const snap = await this.callRef.get().catch(() => null);
    const call = snap?.exists ? (snap.data() as CallDoc) : null;
    if (call && !call.isGroup) {
      if (!this.everConnected) this.connectionFailed = true;
      await this.leave(false);
    }
  }

  /** Reads how loud each person's incoming sound is, from WebRTC stats. */
  private async pollAudioLevels() {
    if (this.left) return;
    let changed = false;
    await Promise.all(Array.from(this.peers.entries()).map(async ([uid, pc]) => {
      if (pc.connectionState !== 'connected') return;
      try {
        const report = await pc.getStats();
        let level: number | undefined;
        report.forEach((r: Record<string, unknown>) => {
          if (r.type !== 'inbound-rtp' || r.kind !== 'audio') return;
          if (typeof r.audioLevel === 'number') {
            level = r.audioLevel;
          } else if (typeof r.totalAudioEnergy === 'number' && typeof r.totalSamplesDuration === 'number') {
            const prev = this.lastAudioEnergy.get(uid);
            this.lastAudioEnergy.set(uid, { energy: r.totalAudioEnergy, duration: r.totalSamplesDuration });
            if (prev && r.totalSamplesDuration > prev.duration) {
              level = Math.sqrt((r.totalAudioEnergy - prev.energy) / (r.totalSamplesDuration - prev.duration));
            }
          }
        });
        const rounded = Math.round(Math.min(1, level || 0) * 100) / 100;
        if (this.audioLevels.get(uid) !== rounded) { this.audioLevels.set(uid, rounded); changed = true; }
      } catch { /* stats not available; no level shown */ }
    }));
    if (changed && !this.left) this.emit();
  }

  private closePeer(uid: string, notify = true) {
    const pc = this.peers.get(uid);
    if (pc) {
      pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null;
      pc.close();
    }
    this.peers.delete(uid);
    this.remoteStreams.delete(uid);
    this.pendingCandidates.delete(uid);
    this.audioLevels.delete(uid);
    this.lastAudioEnergy.delete(uid);
    const t = this.failTimers.get(uid);
    if (t) { clearTimeout(t); this.failTimers.delete(uid); }
    const c = this.connectTimers.get(uid);
    if (c) { clearTimeout(c); this.connectTimers.delete(uid); }
    if (notify) this.emit();
  }

  setMicEnabled(on: boolean) {
    this.localStream.getAudioTracks().forEach((t) => { t.enabled = on; });
  }

  setCameraEnabled(on: boolean) {
    this.localStream.getVideoTracks().forEach((t) => { t.enabled = on; });
  }

  /** Switches between front and back camera without reconnecting. */
  async switchCamera(facingMode: 'user' | 'environment') {
    const oldTrack = this.localStream.getVideoTracks()[0];
    if (!oldTrack) return;
    const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } } });
    const newTrack = fresh.getVideoTracks()[0];
    newTrack.enabled = oldTrack.enabled;
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);
    }
    this.localStream.removeTrack(oldTrack);
    oldTrack.stop();
    this.localStream.addTrack(newTrack);
  }

  /** Leaves the call. Ends it for everyone if it's 1-to-1 or I'm the last one. */
  async leave(onPurpose = true) {
    if (this.left) return;
    if (onPurpose) this.leftOnPurpose = true;
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(this.callRef);
        if (!snap.exists) return;
        const call = snap.data() as CallDoc;
        if (call.status === 'ended') return;
        const remaining = (call.joined || []).filter((u) => u !== this.myUid);
        if (!call.isGroup || remaining.length === 0) {
          tx.update(this.callRef, {
            status: 'ended',
            activeFor: [],
            joined: firebase.firestore.FieldValue.arrayRemove(this.myUid),
          });
        } else {
          tx.update(this.callRef, { joined: firebase.firestore.FieldValue.arrayRemove(this.myUid) });
        }
      });
    } catch (e) {
      console.warn('Could not update call when leaving', e);
    }
    this.finish();
  }

  /** Stops everything locally (no database writes). */
  private finish() {
    if (this.left) return;
    this.left = true;
    // "Couldn't connect" = we started connecting to someone but never reached
    // anyone, and it wasn't me hanging up.
    const failed = this.connectionFailed || (this.triedToConnect && !this.everConnected && !this.leftOnPurpose);
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = null; }
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    Array.from(this.peers.keys()).forEach((uid) => this.closePeer(uid, false));
    this.localStream.getTracks().forEach((t) => t.stop());
    this.onPeersChanged([]);
    this.onCallEnded(failed ? 'connection-failed' : 'ended');
  }
}
