import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Video, Info, Send, Image as ImageIcon, Smile } from 'lucide-react';
import { ChatUser } from './ChatListView';
import { User, Venue } from '../types'; // Import User and Venue types
import { db } from '../firebase'; // Import db
import { firebase } from '../firebase';

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
  type?: 'text' | 'venue_share';
  venue?: Venue;
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

  const chatId = chatUser.isGroup ? chatUser.id : [currentUser.uid, chatUser.id].sort().join('_');

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentUser || !currentUser.uid || !chatUser.id) {
      console.error("Missing user ID or chat ID");
      return;
    }

    const newMessage: Omit<Message, 'id'> = {
      text: inputValue,
      senderId: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('chats').doc(chatId).collection('messages').add(newMessage);
    setInputValue('');
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
        <div className="flex items-center gap-4 text-blue-600">
          <Phone size={24} />
          <Video size={24} />
          <Info size={24} />
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
                    src={sender ? sender.avatarUrl : chatUser.avatarUrl} 
                    className="w-8 h-8 rounded-full self-end mr-2 mb-1" 
                    title={sender ? sender.displayName : chatUser.name}
                 />
              )}
              <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-[15px] ${isMe 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
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
        <button className="text-blue-600 p-2 hover:bg-gray-100 rounded-full">
            <ImageIcon size={24} />
        </button>
        <form onSubmit={handleSend} className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
            <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message..."
                className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
            />
            <button type="button" className="text-gray-400">
                <Smile size={24} />
            </button>
        </form>
        <button 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="text-blue-600 p-2 hover:bg-blue-50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <Send size={24} />
        </button>
      </div>
    </div>
  );
};

export default ChatDetailView;