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

// Free public STUN servers. Optional TURN relay (for strict networks) can be
// added with VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL.
const buildIceServers = (): RTCIceServer[] => {
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
}

type SignalType = 'offer' | 'answer' | 'candidate';
interface SignalDoc {
  from: string;
  to: string;
  type: SignalType;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

/**
 * One person's side of a call. Create it after `getLocalMedia`, then `join()`.
 */
export class CallSession {
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private unsubscribers: Array<() => void> = [];
  private failTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private iceServers = buildIceServers();
  private left = false;

  constructor(
    private callId: string,
    private myUid: string,
    public localStream: MediaStream,
    private onPeersChanged: (peers: RemotePeer[]) => void,
    private onCallEnded: () => void,
  ) {}

  private get callRef() { return callsRef().doc(this.callId); }
  private get signalsRef() { return this.callRef.collection('signals'); }

  /** Joins the call. `alreadyJoined` is true for the caller (added at creation). */
  async join(alreadyJoined: boolean) {
    // 1. Listen for signals sent to me.
    this.unsubscribers.push(
      this.signalsRef.where('to', '==', this.myUid).onSnapshot((snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const signal = change.doc.data() as SignalDoc;
          change.doc.ref.delete().catch(() => {});
          this.handleSignal(signal).catch((e) => console.warn('Call signal failed', e));
        });
      }, (err) => console.error('Call signal listener failed', err)),
    );

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
      list.push({ uid, stream: this.remoteStreams.get(uid) || new MediaStream(), state: pc.connectionState });
    });
    this.onPeersChanged(list);
  }

  private async send(to: string, data: Omit<SignalDoc, 'from' | 'to'>) {
    if (this.left) return;
    await this.signalsRef.add({ ...data, from: this.myUid, to, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  private createPeer(uid: string): RTCPeerConnection {
    this.closePeer(uid, false);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peers.set(uid, pc);
    this.remoteStreams.set(uid, new MediaStream());

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
      const pc = this.createPeer(uid);
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
    if (call && !call.isGroup) await this.leave();
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
    const t = this.failTimers.get(uid);
    if (t) { clearTimeout(t); this.failTimers.delete(uid); }
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
  async leave() {
    if (this.left) return;
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
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    Array.from(this.peers.keys()).forEach((uid) => this.closePeer(uid, false));
    this.localStream.getTracks().forEach((t) => t.stop());
    this.onPeersChanged([]);
    this.onCallEnded();
  }
}
