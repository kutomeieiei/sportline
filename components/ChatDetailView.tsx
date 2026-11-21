import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Video, Send, Image as ImageIcon, Smile, Mic, Square, Loader2, LogOut, UserMinus, MoreVertical, Camera, Pencil, UserPlus } from 'lucide-react';
import { recordMessage, markChatRead, MessageKind } from '../services/chatMeta';
import { fallbackAvatar } from '../utils/image';
import EditGroupModal from './EditGroupModal';
import AddMembersModal from './AddMembersModal';
import { useCall } from '../services/callContext';
import { CallType } from '../services/callService';
import CameraCapture from './CameraCapture';
import { ChatUser } from './ChatListView';
import { User, Venue } from '../types'; // Import User and Venue types
import { db, storage, firebase } from '../firebase'; // Import db and storage

interface ChatDetailViewProps {
  chatUser: ChatUser;
  currentUser: User;
  friends?: User[];
  onBack: () => void;
  onViewVenue: (venue: Venue) => void;
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
}

const ChatDetailView: React.FC<ChatDetailViewProps> = ({ chatUser, currentUser, friends = [], onBack, onViewVenue }) => {
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

  // Saves a message and updates the chat list preview + unread badges.
  const sendMessage = async (message: Record<string, unknown>, kind: MessageKind, text: string) => {
    await db.collection('chats').doc(chatId).collection('messages').add({
      ...message,
      text,
      type: kind,
      senderId: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
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
      // iPhone/Safari can't record webm, so pick the first format this browser supports.
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus']
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
        if (audioBlob.size < 1500) return; // too short / empty recording
        await uploadAudio(audioBlob);
      };

      mediaRecorder.start();
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

  const uploadAudio = async (blob: Blob) => {
    if (!currentUser || !currentUser.uid || !chatUser.id) return;

    setIsUploading(true);
    try {
      const storageRef = storage.ref();
      const ext = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const fileRef = storageRef.child(`chats/${chatId}/audio_${Date.now()}.${ext}`);
      await fileRef.put(blob, { contentType: blob.type || 'audio/webm' });
      const downloadUrl = await fileRef.getDownloadURL();

      await sendMessage({ audioUrl: downloadUrl }, 'audio', 'Sent a voice message');
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

  return (
    <div className="fixed inset-0 bg-zinc-950 z-[2000] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shadow-sm bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-2 text-red-500 rounded-full hover:bg-zinc-800 active:scale-95 transition-transform">
            <ArrowLeft size={24} />
          </button>
          <div className="relative">
             <img src={headerAvatar} alt={headerName} className="w-10 h-10 rounded-full object-cover border border-zinc-800" />
             {chatUser.isOnline && !chatUser.isGroup && (
               <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
             )}
          </div>
          <div>
            <h3 className="font-bold text-white leading-none truncate max-w-[45vw]">{headerName}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {chatUser.isGroup 
                ? `${memberIds.length || chatUser.members || 2} members` 
                : (chatUser.isOnline ? 'Active now' : chatUser.statusText)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-red-500 relative">
          <button onClick={() => handleCall('audio')} disabled={isInThisCall} aria-label="Voice call" title="Voice call" className="p-1 hover:bg-zinc-800 rounded-full transition-colors active:scale-95 disabled:opacity-40">
            <Phone size={24} />
          </button>
          <button onClick={() => handleCall('video')} disabled={isInThisCall} aria-label="Video call" title="Video call" className="p-1 hover:bg-zinc-800 rounded-full transition-colors active:scale-95 disabled:opacity-40">
            <Video size={24} />
          </button>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-zinc-800 rounded-full transition-colors active:scale-95">
            <MoreVertical size={24} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 rounded-xl shadow-lg border border-zinc-800 py-1 z-50">
              {chatUser.isGroup ? (
                <>
                <button
                  onClick={() => { setIsMenuOpen(false); setIsEditGroupOpen(true); }}
                  className="w-full px-4 py-3 text-left text-zinc-200 hover:bg-zinc-800 flex items-center gap-3 transition-colors"
                >
                  <Pencil size={18} />
                  <span className="font-medium text-sm">Edit Group</span>
                </button>
                <button
                  onClick={() => { setIsMenuOpen(false); setIsAddMembersOpen(true); }}
                  className="w-full px-4 py-3 text-left text-zinc-200 hover:bg-zinc-800 flex items-center gap-3 transition-colors"
                >
                  <UserPlus size={18} />
                  <span className="font-medium text-sm">Add Members</span>
                </button>
                <button 
                  onClick={handleLeaveGroup}
                  className="w-full px-4 py-3 text-left text-red-500 hover:bg-zinc-800 flex items-center gap-3 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="font-medium text-sm">Leave Group</span>
                </button>
                </>
              ) : (
                <button 
                  onClick={handleRemoveFriend}
                  className="w-full px-4 py-3 text-left text-red-500 hover:bg-zinc-800 flex items-center gap-3 transition-colors"
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 space-y-4">
        <div className="text-center text-xs text-zinc-600 my-4">Today</div>
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.uid;
          const sender = chatMembers[msg.senderId];
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="px-3 py-1 rounded-full bg-zinc-900 text-zinc-500 text-xs border border-zinc-800">{msg.text}</span>
              </div>
            );
          }
          return (
            <div 
              key={msg.id} 
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!isMe && (
                 <img 
                    src={sender ? (sender.profile_img_url || sender.avatarUrl) : chatUser.avatarUrl} 
                    className="w-8 h-8 rounded-full self-end mr-2 mb-1 border border-zinc-800" 
                    title={sender ? sender.displayName : chatUser.name}
                 />
              )}
              <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-[15px] ${
                  msg.type === 'venue_share' || msg.type === 'image' || msg.type === 'audio'
                  ? `bg-zinc-900 text-white border border-zinc-800 ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`
                  : (isMe 
                      ? 'bg-red-600 text-white rounded-br-none' 
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-bl-none')
              }`}>
                {msg.type === 'venue_share' && msg.venue ? (
                  <div className="w-full">
                    <p className="mb-2">{msg.text}</p>
                    <div className="border-l-4 border-red-500 pl-3">
                      <img src={msg.venue.imageUrl} alt={msg.venue.name} className="w-full h-32 object-cover rounded-lg mb-2 opacity-80" />
                      <h4 className="font-bold text-white">{msg.venue.name}</h4>
                      <p className="text-xs text-zinc-500">{msg.venue.description}</p>
                      <button onClick={() => handleViewOnMap(msg.venue!)} className="mt-2 text-xs text-red-500 hover:text-red-400 font-bold transition-colors">View on Map</button>
                    </div>
                  </div>
                ) : msg.type === 'image' && msg.imageUrl ? (
                  <div className="w-full">
                    <img src={msg.imageUrl} alt="Shared image" className="w-full max-w-xs rounded-lg object-contain" />
                  </div>
                ) : msg.type === 'audio' && msg.audioUrl ? (
                  <div className="w-full">
                    <audio controls src={msg.audioUrl} className="w-full max-w-[200px] h-10" />
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-900 flex items-center gap-3 pb-safe">
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleImageUpload} 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isRecording}
          className="text-red-500 p-2 hover:bg-zinc-900 rounded-full disabled:opacity-50 transition-colors"
        >
            <ImageIcon size={24} />
        </button>
        <button
          onClick={() => setIsCameraOpen(true)}
          disabled={isUploading || isRecording}
          aria-label="Take a photo"
          className="text-red-500 p-2 -ml-2 hover:bg-zinc-900 rounded-full disabled:opacity-50 transition-colors"
        >
            <Camera size={24} />
        </button>
        
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-red-900/30 rounded-full px-4 py-2 border border-red-900/50">
            <div className="flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-medium text-sm">{formatDuration(recordingDuration)}</span>
            </div>
            <button onClick={stopRecording} className="text-red-500 hover:text-red-400">
              <Square size={20} fill="currentColor" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-full px-4 py-2 border border-zinc-800">
              <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500"
                  disabled={isUploading}
              />
              <button type="button" className="text-zinc-500 hover:text-zinc-400 transition-colors">
                  <Smile size={24} />
              </button>
          </form>
        )}

        {isUploading ? (
          <div className="p-2 text-red-500">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : inputValue.trim() ? (
          <button 
              onClick={handleSend}
              className="text-red-500 p-2 hover:bg-red-900/20 rounded-full transition-colors active:scale-95"
          >
              <Send size={24} />
          </button>
        ) : (
          <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`${isRecording ? 'text-white bg-red-600 shadow-md shadow-red-900/50' : 'text-red-500 hover:bg-red-900/20'} p-2 rounded-full transition-all active:scale-95`}
          >
              <Mic size={24} />
          </button>
        )}
      </div>

      {isEditGroupOpen && (
        <EditGroupModal
          chatId={chatId}
          currentName={headerName}
          currentAvatar={groupInfo?.avatarUrl || ''}
          onSaved={(summary) => sendMessage({}, 'system', `${myName} ${summary}`).catch(() => {})}
          onClose={() => setIsEditGroupOpen(false)}
        />
      )}

      {isAddMembersOpen && (
        <AddMembersModal
          chatId={chatId}
          friends={friends}
          memberIds={memberIds}
          onAdded={(names) => sendMessage({}, 'system', `${myName} added ${names}`).catch(() => {})}
          onClose={() => setIsAddMembersOpen(false)}
        />
      )}

      {isCameraOpen && (
        <CameraCapture
          title={`Send to ${chatUser.name}`}
          initialFacing="environment"
          onCapture={uploadImageFile}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
};

export default ChatDetailView;