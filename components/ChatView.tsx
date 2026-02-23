import React, { useState, useEffect, useRef } from 'react';
import { User, ChatConversation, ChatMessage, FriendRequest } from '../types';
import { 
  getConversations, 
  sendMessage, 
  subscribeToMessages, 
  createConversation 
} from '../services/chatService';
import { 
  getFriends, 
  getIncomingFriendRequests, 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest 
} from '../services/friendService';
import { Send, UserPlus, MessageSquare, X, Check, Search, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatViewProps {
  currentUser: User;
  onClose: () => void;
  onChatOpen: (isOpen: boolean) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ currentUser, onClose, onChatOpen }) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Friends State
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendSuccess, setAddFriendSuccess] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    loadConversations();
    loadFriends();
    loadFriendRequests();
  }, [currentUser.uid]);

  // Subscribe to messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      onChatOpen(true);
      const unsubscribe = subscribeToMessages(selectedConversation.id, (msgs) => {
        setMessages(msgs);
        scrollToBottom();
      });
      return () => {
        unsubscribe();
        onChatOpen(false);
      };
    } else {
      onChatOpen(false);
    }
  }, [selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const convs = await getConversations(currentUser.uid);
      setConversations(convs);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const loadFriends = async () => {
    try {
      const friendList = await getFriends(currentUser.uid);
      setFriends(friendList);
    } catch (error) {
      console.error("Error loading friends:", error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const requests = await getIncomingFriendRequests(currentUser.uid);
      setFriendRequests(requests);
    } catch (error) {
      console.error("Error loading friend requests:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;
    
    try {
      await sendMessage(selectedConversation.id, currentUser.uid, newMessage);
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!addFriendUsername.trim()) return;
    setAddFriendError('');
    setAddFriendSuccess('');

    try {
      await sendFriendRequest(currentUser.uid, addFriendUsername);
      setAddFriendSuccess(`Request sent to ${addFriendUsername}`);
      setAddFriendUsername('');
    } catch (error: any) {
      setAddFriendError(error.message || "Failed to send request");
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      loadFriendRequests();
      loadFriends();
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      loadFriendRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  const startChatWithFriend = async (friendId: string) => {
    try {
      const convId = await createConversation([currentUser.uid, friendId]);
      // Refresh conversations and select the new one
      await loadConversations();
      const newConv = conversations.find(c => c.id === convId) || await getConversations(currentUser.uid).then(cs => cs.find(c => c.id === convId));
      if (newConv) {
        setSelectedConversation(newConv);
      }
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  // --- RENDER ---

  // 1. Chat Detail View
  if (selectedConversation) {
    const otherUser = selectedConversation.participantUsers?.[0];
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3 bg-white shadow-sm">
          <button 
            onClick={() => setSelectedConversation(null)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
              {otherUser?.profile_img_url ? (
                <img src={otherUser.profile_img_url} alt={otherUser.display_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold">
                  {otherUser?.display_name?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{otherUser?.display_name || 'Unknown User'}</h3>
              <p className="text-xs text-green-500">Online</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] p-3 rounded-2xl ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 shadow-sm rounded-tl-none'
                }`}>
                  <p>{msg.text}</p>
                  <span className={`text-[10px] block mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 p-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-3 bg-indigo-600 text-white rounded-full disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main List View (Chats & Friends)
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'chats' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'friends' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Friends
            {friendRequests.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chats' ? (
          <div className="divide-y">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No conversations yet.</p>
                <p className="text-sm">Add friends to start chatting!</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const otherUser = conv.participantUsers?.[0];
                return (
                  <div 
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4 transition-colors"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                      {otherUser?.profile_img_url ? (
                        <img src={otherUser.profile_img_url} alt={otherUser.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-lg">
                          {otherUser?.display_name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{otherUser?.display_name || 'Unknown'}</h3>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {conv.updatedAt?.toDate ? conv.updatedAt.toDate().toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{conv.lastMessage || 'Start a conversation'}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Add Friend Section */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Add Friend
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addFriendUsername}
                  onChange={(e) => setAddFriendUsername(e.target.value)}
                  placeholder="Enter username"
                  className="flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                  onClick={handleSendFriendRequest}
                  disabled={!addFriendUsername.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {addFriendError && <p className="text-red-500 text-xs mt-2">{addFriendError}</p>}
              {addFriendSuccess && <p className="text-green-500 text-xs mt-2">{addFriendSuccess}</p>}
            </div>

            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider text-gray-500">Requests</h3>
                <div className="space-y-3">
                  {friendRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
                          {req.fromUser?.profile_img_url ? (
                            <img src={req.fromUser.profile_img_url} alt={req.fromUser.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold">
                              {req.fromUser?.display_name?.[0] || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{req.fromUser?.display_name}</p>
                          <p className="text-xs text-gray-500">@{req.fromUser?.username}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAcceptRequest(req.id)}
                          className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleRejectRequest(req.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends List */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider text-gray-500">My Friends ({friends.length})</h3>
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div key={friend.uid} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
                        {friend.profile_img_url ? (
                          <img src={friend.profile_img_url} alt={friend.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold">
                            {friend.display_name?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{friend.display_name}</p>
                        <p className="text-xs text-gray-500">@{friend.username}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => startChatWithFriend(friend.uid)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatView;
