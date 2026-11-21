import React from 'react';
import { Map, PlusCircle, Settings, MessageCircle } from 'lucide-react';

type Tab = 'explore' | 'create' | 'settings' | 'chat';

interface BottomNavProps {
  currentTab: string;
  onChangeTab: (tab: Tab) => void;
  /** Unread messages + friend requests, shown as a red badge on Chat. */
  chatBadge?: number;
}

const ITEMS: { id: Tab; label: string; Icon: typeof Map }[] = [
  { id: 'explore', label: 'Explore', Icon: Map },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
  { id: 'create', label: 'Create', Icon: PlusCircle },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

/** Material-style bottom bar: the active tab gets a soft pill that grows in. */
const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab, chatBadge = 0 }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-[1000] flex h-[72px]">
      {ITEMS.map(({ id, label, Icon }) => {
        const active = currentTab === id;
        return (
          <button
            key={id}
            onClick={() => onChangeTab(id)}
            aria-current={active ? 'page' : undefined}
            className="group flex-1 flex flex-col items-center justify-center gap-1"
          >
            <span className="relative flex items-center justify-center w-16 h-8">
              {/* Active indicator pill */}
              <span
                className={`absolute inset-0 rounded-full bg-red-50 transition-transform duration-300 ease-[cubic-bezier(0.05,0.7,0.1,1)] ${active ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0 group-hover:opacity-60 group-hover:scale-x-100 group-hover:bg-gray-100'}`}
              />
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.9}
                className={`relative transition-colors duration-200 ${active ? 'text-red-700' : 'text-gray-600'} group-active:scale-90 transition-transform`}
              />
              {id === 'chat' && chatBadge > 0 && (
                <span
                  key={chatBadge}
                  aria-label={`${chatBadge} unread`}
                  className="bump absolute top-0 right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
                >
                  {chatBadge > 99 ? '99+' : chatBadge}
                </span>
              )}
            </span>
            <span className={`text-xs transition-colors duration-200 ${active ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
