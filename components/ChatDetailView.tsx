import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Video, Info, Send, Image as ImageIcon, Smile, Mic, Square, Loader2, LogOut, UserMinus, MoreVertical } from 'lucide-react';
import { ChatUser } from './ChatListView';
import { User, Venue } from '../types'; // Import User and Venue types
import { db, storage, firebase } from '../firebase'; // Import db and storage

interface ChatDetailViewProps {
  chatUser: ChatUser;
  currentUser: User;
  onBack: () => void;
  onViewVenue: (venue: Venue) => void;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: firebase.firestore.Timestamp | Date | string | number | null;
  type?: 'text' | 'venue_share' | 'image' | 'audio';
  venue?: Venue;
  imageUrl?: string;
  audioUrl?: string;
}

const ChatDetailView: React.FC<ChatDetailViewProps> = ({ chatUser, currentUser, onBack, onViewVenue }) => {
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

  const chatId = chatUser.isGroup ? chatUser.id : [currentUser.uid, chatUser.id].sort().join('_');

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    
    try {
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
    });

    return () => unsubscribe();
  }, [currentUser, chatUser, chatId]);

  useEffect(() => {
    if (!chatUser.isGroup || !db) return;

    const fetchMembers = async () => {
        const chatDoc = await db.collection('chats').doc(chatId).get();
        if (!chatDoc.exists) return;

        const memberIds = chatDoc.data()?.members || [];
        if (memberIds.length === 0) return;

        const memberPromises = memberIds.map((id: string) => 
            db.collection('users').doc(id).get()
        );

        const memberDocs = await Promise.all(memberPromises);
        
        const membersData: Record<string, User> = {};
        memberDocs.forEach(doc => {
            if (doc.exists) {
                membersData[doc.id] = { uid: doc.id, ...doc.data() } as User;
            }
        });
        setChatMembers(membersData);
    };

    fetchMembers();

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

    const newMessage: Omit<Message, 'id'> = {
      text: inputValue,
      senderId: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      type: 'text'
    };

    await db.collection('chats').doc(chatId).collection('messages').add(newMessage);
    setInputValue('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !currentUser.uid || !chatUser.id) return;

    setIsUploading(true);
    try {
      const storageRef = storage.ref();
      const fileRef = storageRef.child(`chats/${chatId}/${Date.now()}_${file.name}`);
      await fileRef.put(file);
      const downloadUrl = await fileRef.getDownloadURL();

      const newMessage: Omit<Message, 'id'> = {
        text: 'Sent an image',
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'image',
        imageUrl: downloadUrl,
      };

      await db.collection('chats').doc(chatId).collection('messages').add(newMessage);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
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
      const fileRef = storageRef.child(`chats/${chatId}/audio_${Date.now()}.webm`);
      await fileRef.put(blob);
      const downloadUrl = await fileRef.getDownloadURL();

      const newMessage: Omit<Message, 'id'> = {
        text: 'Sent a voice message',
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'audio',
        audioUrl: downloadUrl,
      };

      await db.collection('chats').doc(chatId).collection('messages').add(newMessage);
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Failed to send audio message.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shadow-sm bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-2 text-blue-600 rounded-full hover:bg-blue-50">
            <ArrowLeft size={24} />
          </button>
          <div className="relative">
             <img src={chatUser.avatarUrl} alt={chatUser.name} className="w-10 h-10 rounded-full object-cover" />
             {chatUser.isOnline && !chatUser.isGroup && (
               <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
             )}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 leading-none">{chatUser.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {chatUser.isGroup 
                ? `${chatUser.members || 2} members` 
                : (chatUser.isOnline ? 'Active now' : chatUser.statusText)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-blue-600 relative">
          <Phone size={24} />
          <Video size={24} />
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical size={24} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              {chatUser.isGroup ? (
                <button 
                  onClick={handleLeaveGroup}
                  className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="font-medium text-sm">Leave Group</span>
                </button>
              ) : (
                <button 
                  onClick={handleRemoveFriend}
                  className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <UserMinus size={18} />
                  <span className="font-medium text-sm">Remove Friend</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
        <div className="text-center text-xs text-gray-400 my-4">Today</div>
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.uid;
          const sender = chatMembers[msg.senderId];
          return (
            <div 
              key={msg.id} 
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!isMe && (
                 <img 
                    src={sender ? (sender.profile_img_url || sender.avatarUrl) : chatUser.avatarUrl} 
                    className="w-8 h-8 rounded-full self-end mr-2 mb-1" 
                    title={sender ? sender.displayName : chatUser.name}
                 />
              )}
              <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-[15px] ${
                  msg.type === 'venue_share' || msg.type === 'image' || msg.type === 'audio'
                  ? `bg-white text-gray-800 border border-gray-200 ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`
                  : (isMe 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none')
              }`}>
                {msg.type === 'venue_share' && msg.venue ? (
                  <div className="w-full">
                    <p className="mb-2">{msg.text}</p>
                    <div className="border-l-4 border-blue-500 pl-3">
                      <img src={msg.venue.imageUrl} alt={msg.venue.name} className="w-full h-32 object-cover rounded-lg mb-2" />
                      <h4 className="font-bold">{msg.venue.name}</h4>
                      <p className="text-xs text-gray-500">{msg.venue.description}</p>
                      <button onClick={() => handleViewOnMap(msg.venue!)} className="mt-2 text-xs text-blue-500 hover:underline">View on Map</button>
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
      <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-3 pb-safe">
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
          className="text-blue-600 p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
        >
            <ImageIcon size={24} />
        </button>
        
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-red-50 rounded-full px-4 py-2 border border-red-100">
            <div className="flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-medium text-sm">{formatDuration(recordingDuration)}</span>
            </div>
            <button onClick={stopRecording} className="text-red-500 hover:text-red-600">
              <Square size={20} fill="currentColor" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
              <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
                  disabled={isUploading}
              />
              <button type="button" className="text-gray-400">
                  <Smile size={24} />
              </button>
          </form>
        )}

        {isUploading ? (
          <div className="p-2 text-blue-600">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : inputValue.trim() ? (
          <button 
              onClick={handleSend}
              className="text-blue-600 p-2 hover:bg-blue-50 rounded-full"
          >
              <Send size={24} />
          </button>
        ) : (
          <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`${isRecording ? 'text-red-500 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'} p-2 rounded-full transition-colors`}
          >
              <Mic size={24} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatDetailView;