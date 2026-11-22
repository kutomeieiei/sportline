import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Video, Image as ImageIcon, Mic, Trash2, Loader2, LogOut, UserMinus, Info, Camera, Pencil, UserPlus, MapPin, ShieldCheck, Clock, UserCheck } from 'lucide-react';
import VenuePhoto from './VenuePhoto';
import { recordMessage, markChatRead, MessageKind } from '../services/chatMeta';
import { fallbackAvatar } from '../utils/image';
import EditGroupModal from './EditGroupModal';
import AddMembersModal from './AddMembersModal';
import { useCall } from '../services/callContext';
import { CallType } from '../services/callService';
import CameraCapture from './CameraCapture';
import Portal from './Portal';
import VoiceMessage from './VoiceMessage';
import { separatorLabel, toDate } from '../utils/time';
import { ChatUser } from './ChatListView';
import { User, Venue } from '../types'; // Import User and Venue types
import { db, storage, firebase } from '../firebase'; // Import db and storage

interface ChatDetailViewProps {
  chatUser: ChatUser;
  currentUser: User;
  friends?: User[];
  onBack: () => void;
  onViewVenue: (venue: Venue) => void;
  onOpenProfile?: (uid: string) => void;
  onAddFriend?: (usernameOrEmail: string) => void;
  onAcceptFriend?: (uid: string) => void;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: firebase.firestore.Timestamp | Date | string | number | null;
  type?: 'text' | 'venue_share' | 'image' | 'audio' | 'system';
  venue?: Venue;
  imageUrl?: string;
  audioUrl?: string;
  /** Length of a voice message in seconds. */
  audioDuration?: number;
}

const ChatDetailView: React.FC<ChatDetailViewProps> = ({ chatUser, currentUser, friends = [], onBack, onViewVenue, onOpenProfile, onAddFriend, onAcceptFriend }) => {
  const handleViewOnMap = (venue: Venue) => {
    // This will be handled by App.tsx
    onViewVenue(venue);
  };
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMembers, setChatMembers] = useState<Record<string, User>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Media states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef(0);
  const discardRecordingRef = useRef(false);
  // How many messages each member hasn't read yet (for "Seen").
  const [unreadBy, setUnreadBy] = useState<Record<string, number>>({});
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [groupInfo, setGroupInfo] = useState<{ name: string; avatarUrl: string } | null>(null);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const myName = currentUser.display_name || currentUser.displayName || currentUser.username || 'Someone';
  const { startCall, joinCall, activeCalls, currentCall } = useCall();

  const chatId = chatUser.isGroup ? chatUser.id : [currentUser.uid, chatUser.id].sort().join('_');
  const headerName = groupInfo?.name || chatUser.name;
  const headerAvatar = groupInfo?.avatarUrl || chatUser.avatarUrl || fallbackAvatar(headerName);

  // ---- Safety: people who aren't friends can send each other one text message ----
  // My friend list entry for this person: sent / pending / accepted (or none).
  const [friendStatus, setFriendStatus] = useState<'loading' | 'none' | 'sent' | 'pending' | 'accepted'>('loading');
  useEffect(() => {
    if (chatUser.isGroup || !currentUser.uid) return;
    return db.collection('users').doc(currentUser.uid).collection('friends').doc(chatUser.id).onSnapshot(
      (snap) => {
        const st = snap.exists ? (snap.data()?.status as string | undefined) : undefined;
        setFriendStatus(st === 'sent' || st === 'pending' ? st : snap.exists ? 'accepted' : 'none');
      },
      () => setFriendStatus('none'),
    );
  }, [chatUser.id, chatUser.isGroup, currentUser.uid]);
  const isDirect = !chatUser.isGroup;
  const isFriend = !isDirect || friendStatus === 'accepted' || friends.some((f) => f.uid === chatUser.id);
  // Who has used their one message (stored on the chat).
  const [introBy, setIntroBy] = useState<Record<string, boolean>>({});
  const usedMyMessage = !!introBy[currentUser.uid];
  const canSend = isFriend || (friendStatus !== 'loading' && !usedMyMessage);

  // Saves a message and updates the chat list preview + unread badges.
  const sendMessage = async (message: Record<string, unknown>, kind: MessageKind, text: string) => {
    const data = {
      ...message,
      text,
      type: kind,
      senderId: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (isDirect && !isFriend) {
      // Not friends: send the one allowed message together with the "used" marker.
      const batch = db.batch();
      batch.set(db.collection('chats').doc(chatId).collection('messages').doc(), data);
      await recordMessage(chatId, [currentUser.uid, chatUser.id], currentUser.uid, kind, text, { batch, intro: true });
      await batch.commit();
      return;
    }
    await db.collection('chats').doc(chatId).collection('messages').add(data);
    const members = chatUser.isGroup ? memberIds : [currentUser.uid, chatUser.id];
    await recordMessage(chatId, members.length ? members : [currentUser.uid], currentUser.uid, kind, text)
      .catch((e) => console.warn('Could not update chat preview', e));
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    
    try {
      await sendMessage({}, 'system', `${myName} left the group`).catch(() => {});
      // Remove from chat members
      await db.collection('chats').doc(chatId).update({
        members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
      });

      // Try to remove from party if it exists (assuming party ID matches chat ID)
      const partyRef = db.collection('parties').doc(chatId);
      const partyDoc = await partyRef.get();
      
      if (partyDoc.exists) {
        const currentPlayers = partyDoc.data()?.playersCurrent || 1;
        await partyRef.update({
          members: firebase.firestore.FieldValue.arrayRemove(currentUser.username),
          playersCurrent: Math.max(0, currentPlayers - 1)
        });
      }

      onBack();
    } catch (error) {
      console.error("Error leaving group:", error);
      alert("Failed to leave group.");
    }
  };

  const handleRemoveFriend = async () => {
    if (!window.confirm(`Are you sure you want to remove ${chatUser.name} from your friends?`)) return;

    try {
      // Remove from my friends list
      await db.collection('users').doc(currentUser.uid).collection('friends').doc(chatUser.id).delete();
      
      // Remove me from their friends list
      await db.collection('users').doc(chatUser.id).collection('friends').doc(currentUser.uid).delete();

      onBack();
    } catch (error) {
      console.error("Error removing friend:", error);
      alert("Failed to remove friend.");
    }
  };

  // Message Listener
  useEffect(() => {
    if (!currentUser || !chatUser) return;

    const unsubscribe = db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp', 'asc').onSnapshot(snapshot => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      // I'm looking at this chat, so everything in it is read.
      markChatRead(chatId, currentUser.uid);
    });

    return () => unsubscribe();
  }, [currentUser, chatUser, chatId]);

  // Read receipts: the chat keeps how many messages each member hasn't seen.
  useEffect(() => {
    if (!db) return;
    return db.collection('chats').doc(chatId).onSnapshot(
      (snap) => {
        setUnreadBy((snap.data()?.unread as Record<string, number>) || {});
        setIntroBy((snap.data()?.intro as Record<string, boolean>) || {});
      },
      () => {},
    );
  }, [chatId]);

  // Group info (name, photo, members) - live, so edits by anyone show up right away.
  useEffect(() => {
    if (!chatUser.isGroup || !db) return;
    return db.collection('chats').doc(chatId).onSnapshot(async (chatDoc) => {
      if (!chatDoc.exists) return;
      const data = chatDoc.data() || {};
      const ids: string[] = data.members || [];
      setMemberIds(ids);
      setGroupInfo({ name: data.name || 'Group Chat', avatarUrl: data.avatarUrl || '' });

      const memberDocs = await Promise.all(ids.map((id) => db.collection('users').doc(id).get()));
      const membersData: Record<string, User> = {};
      memberDocs.forEach(doc => {
        if (doc.exists) membersData[doc.id] = { uid: doc.id, ...doc.data() } as User;
      });
      setChatMembers(membersData);
    });
  }, [chatId, chatUser.isGroup]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !currentUser || !currentUser.uid || !chatUser.id) {
      return;
    }

    const text = inputValue.trim();
    setInputValue('');
    try {
      await sendMessage({}, 'text', text);
    } catch (error) {
      console.error("Error sending message:", error);
      setInputValue(text);
      alert("Message not sent. Please try again.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadImageFile(file);
  };

  const uploadImageFile = async (file: File) => {
    if (!currentUser || !currentUser.uid || !chatUser.id) return;
    if (!file.type.startsWith('image/')) {
      alert("Please choose an image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image is too large (max 10MB).");
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = storage.ref();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileRef = storageRef.child(`chats/${chatId}/${Date.now()}_${safeName}`);
      await fileRef.put(file, { contentType: file.type });
      const downloadUrl = await fileRef.getDownloadURL();

      await sendMessage({ imageUrl: downloadUrl }, 'image', 'Sent an image');
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        alert("Voice messages aren't supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      // Prefer MP4/AAC: it plays on every phone (iPhones can't always play webm).
      // Fall back to whatever this browser can record.
      const mimeType = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find((t) => MediaRecorder.isTypeSupported?.(t));
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const type = (mediaRecorder.mimeType || 'audio/webm').split(';')[0];
        const audioBlob = new Blob(audioChunksRef.current, { type });
        if (discardRecordingRef.current) { discardRecordingRef.current = false; return; } // cancelled
        if (audioBlob.size < 1500) return; // too short / empty recording
        const seconds = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
        await uploadAudio(audioBlob, seconds);
      };

      mediaRecorder.start();
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access the microphone. Please allow microphone access in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    discardRecordingRef.current = true;
    stopRecording();
  };

  const uploadAudio = async (blob: Blob, seconds: number) => {
    if (!currentUser || !currentUser.uid || !chatUser.id) return;

    setIsUploading(true);
    try {
      const storageRef = storage.ref();
      const ext = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const fileRef = storageRef.child(`chats/${chatId}/audio_${Date.now()}.${ext}`);
      await fileRef.put(blob, { contentType: blob.type || 'audio/webm' });
      const downloadUrl = await fileRef.getDownloadURL();

      await sendMessage({ audioUrl: downloadUrl, audioDuration: seconds }, 'audio', 'Sent a voice message');
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Failed to send audio message.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- Calls ---
  const groupCallInProgress = chatUser.isGroup
    ? activeCalls.find((c) => c.chatId === chatId && !c.joined.includes(currentUser.uid) && c.joined.length > 0)
    : undefined;
  const isInThisCall = currentCall?.chatId === chatId;

  const handleCall = (type: CallType) => {
    if (groupCallInProgress) {
      joinCall(groupCallInProgress);
      return;
    }
    const participants = chatUser.isGroup ? memberIds : [currentUser.uid, chatUser.id];
    if (chatUser.isGroup && participants.length < 2) {
      alert("Group members are still loading. Try again in a moment.");
      return;
    }
    startCall({ chatId, isGroup: !!chatUser.isGroup, title: chatUser.name, type, participants });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ---- Message list helpers (grouping like most chat apps) ----
  const timeOf = (m?: Message) => (m ? toDate(m.timestamp as never)?.getTime() ?? null : null);
  const SEPARATOR_GAP = 15 * 60_000; // show the time when 15+ minutes passed
  const GROUP_GAP = 5 * 60_000; // bubbles closer than 5 minutes stick together
  const needsSeparator = (i: number) => {
    const t = timeOf(messages[i]);
    const prev = timeOf(messages[i - 1]);
    return t !== null && (prev === null || t - prev > SEPARATOR_GAP);
  };
  const joinsPrevious = (i: number) => {
    const m = messages[i];
    const prev = messages[i - 1];
    if (!prev || prev.type === 'system' || m.type === 'system' || prev.senderId !== m.senderId || needsSeparator(i)) return false;
    const t = timeOf(m);
    const pt = timeOf(prev);
    return t === null || pt === null || t - pt < GROUP_GAP;
  };
  const lastMessage = messages[messages.length - 1];
  const seen = !chatUser.isGroup && lastMessage?.senderId === currentUser.uid && lastMessage.type !== 'system'
    && unreadBy[chatUser.id] === 0;
  const subtitleText = chatUser.isGroup
    ? `${memberIds.length || chatUser.members || 2} members`
    : chatUser.isOnline ? 'Active now' : (chatUser.username ? `@${chatUser.username}` : chatUser.statusText || '');

  return (
    <div className="w-full h-full bg-white flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pl-1 md:pl-4 pr-2 h-16 md:h-[72px] border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button onClick={onBack} aria-label="Back" className="md:hidden ripple press w-10 h-10 shrink-0 flex items-center justify-center text-gray-800 rounded-full hover:bg-gray-100">
            <ArrowLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => !chatUser.isGroup && onOpenProfile?.(chatUser.id)}
            disabled={chatUser.isGroup}
            title={chatUser.isGroup ? undefined : 'View profile'}
            className="flex items-center gap-2 md:gap-3 min-w-0 text-left rounded-xl pr-2 enabled:hover:bg-gray-50"
          >
            <span className="relative shrink-0">
              <img src={headerAvatar} alt="" className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover bg-gray-100" />
              {chatUser.isOnline && !chatUser.isGroup && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              )}
            </span>
            <span className="min-w-0">
              <h3 className="font-semibold text-[16px] text-gray-900 leading-tight truncate">{headerName}</h3>
              {subtitleText && <p className="text-xs text-gray-500 truncate">{subtitleText}</p>}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-0.5 text-gray-900 relative shrink-0">
          <button onClick={() => handleCall('audio')} disabled={isInThisCall || !isFriend} aria-label="Voice call" title={isFriend ? 'Voice call' : 'Calls are for friends'} className="ripple press w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full disabled:opacity-40">
            <Phone size={24} />
          </button>
          <button onClick={() => handleCall('video')} disabled={isInThisCall || !isFriend} aria-label="Video call" title={isFriend ? 'Video call' : 'Calls are for friends'} className="ripple press w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full disabled:opacity-40">
            <Video size={26} />
          </button>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Chat details" title="Chat details" aria-expanded={isMenuOpen} className="ripple press w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full">
            <Info size={24} />
          </button>
          {isMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-elev-2 py-2 z-50 origin-top-right animate-in zoom-in">
              {chatUser.isGroup ? (
                <>
                <button
                  onClick={() => { setIsMenuOpen(false); setIsEditGroupOpen(true); }}
                  className="w-full px-4 py-3 text-left text-gray-800 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                >
                  <Pencil size={18} />
                  <span className="font-medium text-sm">Edit Group</span>
                </button>
                <button
                  onClick={() => { setIsMenuOpen(false); setIsAddMembersOpen(true); }}
                  className="w-full px-4 py-3 text-left text-gray-800 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                >
                  <UserPlus size={18} />
                  <span className="font-medium text-sm">Add Members</span>
                </button>
                <button 
                  onClick={handleLeaveGroup}
                  className="w-full px-4 py-3 text-left text-red-600 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="font-medium text-sm">Leave Group</span>
                </button>
                </>
              ) : (
                <button 
                  onClick={handleRemoveFriend}
                  className="w-full px-4 py-3 text-left text-red-600 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                >
                  <UserMinus size={18} />
                  <span className="font-medium text-sm">Remove Friend</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {groupCallInProgress && (
        <button
          onClick={() => joinCall(groupCallInProgress)}
          className="flex items-center justify-between gap-3 px-4 py-3 bg-green-700/90 text-white text-sm font-semibold hover:bg-green-700"
        >
          <span className="flex items-center gap-2">
            {groupCallInProgress.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
            {groupCallInProgress.type === 'video' ? 'Video' : 'Voice'} call in progress · {groupCallInProgress.joined.length} joined
          </span>
          <span className="px-3 py-1 rounded-full bg-white text-green-800 font-bold">Join</span>
        </button>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white px-3 md:px-5 pb-3">
        {/* Who you're talking to */}
        <div className="flex flex-col items-center text-center pt-8 pb-6">
          <img src={headerAvatar} alt="" className="w-24 h-24 rounded-full object-cover bg-gray-100" />
          <p className="mt-3 text-xl font-semibold text-gray-900">{headerName}</p>
          <p className="text-sm text-gray-500">
            {chatUser.isGroup ? `${memberIds.length || chatUser.members || 2} members` : `${chatUser.username ? `@${chatUser.username} · ` : ''}SportSphere`}
          </p>
          {!chatUser.isGroup && onOpenProfile && (
            <button onClick={() => onOpenProfile(chatUser.id)} className="press mt-3 h-8 px-4 rounded-lg bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200">
              View profile
            </button>
          )}
        </div>

        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUser.uid;
          const sender = chatMembers[msg.senderId];
          const separator = needsSeparator(i) ? (
            <div className="text-center text-xs font-medium text-gray-500 pt-5 pb-2">{separatorLabel(toDate(msg.timestamp as never)!)}</div>
          ) : null;

          if (msg.type === 'system') {
            return (
              <React.Fragment key={msg.id}>
                {separator}
                <p className="text-center text-xs text-gray-500 py-2">{msg.text}</p>
              </React.Fragment>
            );
          }

          const joinPrev = joinsPrevious(i);
          const joinNext = i + 1 < messages.length && joinsPrevious(i + 1);
          // Bubbles in a run share a flatter corner on the sender's side.
          const shape = isMe
            ? `rounded-[22px] ${joinPrev ? 'rounded-tr-md' : ''} ${joinNext ? 'rounded-br-md' : ''}`
            : `rounded-[22px] ${joinPrev ? 'rounded-tl-md' : ''} ${joinNext ? 'rounded-bl-md' : ''}`;
          const color = isMe ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-900';
          const senderName = sender ? (sender.display_name || sender.displayName || sender.username) : chatUser.name;
          const senderAvatar = sender ? (sender.profile_img_url || sender.avatarUrl || fallbackAvatar(senderName || '?')) : headerAvatar;

          return (
            <React.Fragment key={msg.id}>
              {separator}
              {!isMe && chatUser.isGroup && !joinPrev && (
                <p className="ml-11 mt-3 mb-0.5 text-xs text-gray-500">{senderName}</p>
              )}
              <div className={`pop-in flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${joinPrev ? 'mt-0.5' : (!isMe && chatUser.isGroup ? '' : 'mt-3')}`}>
                {!isMe && (
                  joinNext
                    ? <span className="w-7 shrink-0" />
                    : (
                      <button type="button" onClick={() => onOpenProfile?.(msg.senderId)} title={`${senderName} · View profile`} className="press shrink-0 rounded-full">
                        <img src={senderAvatar} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100" />
                      </button>
                    )
                )}
                <div className="max-w-[75%] md:max-w-[60%] min-w-0">
                  {msg.type === 'venue_share' && msg.venue ? (
                    <div className="w-64 max-w-full rounded-2xl border border-gray-200 overflow-hidden bg-white text-gray-900">
                      {msg.text && <p className="px-3.5 pt-2.5 pb-2 text-[15px]">{msg.text}</p>}
                      <VenuePhoto venue={{ ...msg.venue, courts: msg.venue.courts || [] }} className="w-full h-32" />
                      <div className="p-3">
                        <h4 className="font-semibold text-gray-900">{msg.venue.name}</h4>
                        <p className="text-xs text-gray-500 line-clamp-2">{msg.venue.description}</p>
                        <button onClick={() => handleViewOnMap(msg.venue!)} className="mt-2 flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-semibold">
                          <MapPin size={14} /> View on map
                        </button>
                      </div>
                    </div>
                  ) : msg.type === 'image' && msg.imageUrl ? (
                    <img src={msg.imageUrl} alt="Photo" className={`block max-w-[240px] max-h-[320px] w-auto object-cover bg-gray-100 ${shape}`} />
                  ) : msg.type === 'audio' && msg.audioUrl ? (
                    <div className={`px-3 py-2 ${color} ${shape}`}>
                      <VoiceMessage url={msg.audioUrl} duration={msg.audioDuration} isMe={isMe} />
                    </div>
                  ) : (
                    <p className={`px-3.5 py-2 text-[15px] leading-5 whitespace-pre-wrap break-words ${color} ${shape}`}>{msg.text}</p>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {seen && <p className="text-right text-xs text-gray-500 mt-1 pr-1 animate-in fade-in">Seen</p>}
        <div ref={messagesEndRef} />
      </div>

      {/* Not friends yet: explain the one-message limit */}
      {isDirect && !isFriend && friendStatus !== 'loading' && (
        <div className="mx-3 md:mx-5 mb-2 p-3 rounded-2xl bg-gray-50 border border-gray-200 flex items-start gap-3 animate-in fade-in">
          <ShieldCheck size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">
              {usedMyMessage
                ? `You've sent your message. You can keep chatting once you and ${chatUser.name} are friends.`
                : `You and ${chatUser.name} aren't friends yet, so you can send one text message.`}
            </p>
            <div className="mt-2">
              {friendStatus === 'pending' ? (
                <button onClick={() => onAcceptFriend?.(chatUser.id)} className="press h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 inline-flex items-center gap-1.5">
                  <UserCheck size={14} /> Accept friend request
                </button>
              ) : friendStatus === 'sent' ? (
                <span className="h-8 px-3 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold inline-flex items-center gap-1.5">
                  <Clock size={14} /> Friend request sent
                </span>
              ) : (
                <button
                  onClick={() => (chatUser.username ? onAddFriend?.(chatUser.username) : onOpenProfile?.(chatUser.id))}
                  className="press h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 inline-flex items-center gap-1.5"
                >
                  <UserPlus size={14} /> Add friend
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message bar */}
      <div className={`px-3 md:px-5 pt-1 pb-3 bg-white shrink-0 pb-safe ${canSend ? '' : 'hidden'}`}>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleImageUpload}
        />
        {isRecording ? (
          <div className="flex items-center gap-2 h-12 pl-1.5 pr-1.5 rounded-full border border-gray-300 animate-in fade-in">
            <button onClick={cancelRecording} aria-label="Delete recording" title="Delete" className="ripple press w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 shrink-0">
              <Trash2 size={20} />
            </button>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
            <span className="flex-1 text-[15px] text-gray-900 tabular-nums">{formatDuration(recordingDuration)}</span>
            <button
              onClick={stopRecording}
              aria-label="Stop and send voice message"
              className="ripple press h-9 px-4 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shrink-0"
            >
              Send
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-1 h-12 pl-1.5 pr-2 rounded-full border border-gray-300 focus-within:border-gray-400 transition-colors">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              disabled={isUploading || !isFriend}
              aria-label="Take a photo"
              title="Camera"
              className="press w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shrink-0 disabled:opacity-50"
            >
              <Camera size={18} />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message..."
              aria-label="Message"
              className="flex-1 min-w-0 px-2 bg-transparent outline-none text-[15px] text-gray-900 placeholder-gray-500"
              disabled={isUploading}
            />
            {isUploading ? (
              <Loader2 size={22} className="animate-spin text-red-600 mx-2 shrink-0" />
            ) : inputValue.trim() ? (
              <button type="submit" className="px-2 text-[15px] font-semibold text-red-600 hover:text-red-800 shrink-0 animate-in fade-in">
                Send
              </button>
            ) : isFriend ? (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  aria-label="Record voice message"
                  title="Voice message"
                  className="ripple press w-9 h-9 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 shrink-0"
                >
                  <Mic size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Send a photo"
                  title="Photo"
                  className="ripple press w-9 h-9 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 shrink-0"
                >
                  <ImageIcon size={22} />
                </button>
              </>
            ) : null}
          </form>
        )}
      </div>

      {isEditGroupOpen && (
        <Portal>
          <EditGroupModal
            chatId={chatId}
            currentName={headerName}
            currentAvatar={groupInfo?.avatarUrl || ''}
            onSaved={(summary) => sendMessage({}, 'system', `${myName} ${summary}`).catch(() => {})}
            onClose={() => setIsEditGroupOpen(false)}
          />
        </Portal>
      )}

      {isAddMembersOpen && (
        <Portal>
          <AddMembersModal
            chatId={chatId}
            friends={friends}
            memberIds={memberIds}
            onAdded={(names) => sendMessage({}, 'system', `${myName} added ${names}`).catch(() => {})}
            onClose={() => setIsAddMembersOpen(false)}
          />
        </Portal>
      )}

      {isCameraOpen && (
        <Portal>
          <CameraCapture
            title={`Send to ${chatUser.name}`}
            initialFacing="environment"
            onCapture={uploadImageFile}
            onClose={() => setIsCameraOpen(false)}
          />
        </Portal>
      )}
    </div>
  );
};

export default ChatDetailView;