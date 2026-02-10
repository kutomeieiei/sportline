import React from 'react';

export interface ChatUser {
  id: string;
  name: string;
  avatarUrl: string;
  statusText?: string;
  timestamp?: string;
  isOnline?: boolean;
  isUnread?: boolean;
}

// Generic mock data - complying with "Do not use names from the image"
const MOCK_CHATS: ChatUser[] = [
  {
    id: '1',
    name: 'Sarah Anderson',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Sent 7 minutes ago',
    timestamp: '7 min',
    isOnline: false,
  },
  {
    id: '2',
    name: 'Michael Chen',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Active Now',
    isOnline: true,
  },
  {
    id: '3',
    name: 'Jessica Taylor',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Active Now',
    isOnline: true,
  },
  {
    id: '4',
    name: 'David Wilson',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Active 44 minutes ago',
    timestamp: '44 min',
    isOnline: false,
  },
  {
    id: '5',
    name: 'Emily Davis',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Active 47 minutes ago',
    timestamp: '47 min',
    isOnline: false,
  },
  {
    id: '6',
    name: 'James Rodriguez',
    avatarUrl: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Active 7 minutes ago',
    timestamp: '7 min',
    isOnline: false,
  },
  {
    id: '7',
    name: 'Running Club Group',
    avatarUrl: 'https://images.unsplash.com/photo-1552674605-469537d7a548?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Alex reacted ❤️ to message...',
    timestamp: '1 week',
    isOnline: false,
  },
  {
    id: '8',
    name: 'Lisa Wong',
    avatarUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656ec?w=150&h=150&fit=crop&crop=faces',
    statusText: 'Sent 1 week ago',
    timestamp: '1 week',
    isOnline: false,
  }
];

interface ChatListViewProps {
  onSelectChat: (user: ChatUser) => void;
}

const ChatListView: React.FC<ChatListViewProps> = ({ onSelectChat }) => {
  return (
    <div className="w-full h-full bg-white flex flex-col font-sans">
      {/* Header */}
      <div className="pt-4 pb-2 px-4 bg-white sticky top-0 z-10">
         <h1 className="text-2xl font-bold text-black">Chats</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col pb-24">
          {MOCK_CHATS.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors w-full text-left"
            >
              {/* Avatar Container */}
              <div className="relative flex-shrink-0">
                <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-gray-200 border border-gray-100">
                    <img src={chat.avatarUrl} alt={chat.name} className="w-full h-full object-cover" />
                </div>
                
                {/* Online Status Dot */}
                {chat.isOnline && (
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-[#31a24c] border-2 border-white rounded-full"></div>
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="text-[17px] font-normal text-black truncate leading-tight mb-1">
                  {chat.name}
                </h3>
                <div className="flex items-center gap-1 text-[15px] text-gray-500 font-light truncate leading-tight">
                  <span className="truncate">{chat.statusText}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatListView;