import React from 'react';
import { Map, Settings, MessageCircle, Flame } from 'lucide-react';
import { APP_CONFIG } from '../constants';

type Tab = 'explore' | 'settings' | 'chat';

interface BottomNavProps {
  currentTab: string;
  onChangeTab: (tab: Tab) => void;
  /** Unread messages + friend requests, shown as a red badge on Chat. */
  chatBadge?: number;
  /** Hide the bar on phones (e.g. while a chat is open). The PC side menu always stays. */
  hideOnMobile?: boolean;
}

const ITEMS: { id: Tab; label: string; Icon: typeof Map }[] = [
  { id: 'explore', label: 'Explore', Icon: Map },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

/**
 * Main navigation. Phones: bar along the bottom. PC (768px and wider): menu
 * down the left side. The active tab gets a soft pill that grows in.
 */
const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab, chatBadge = 0, hideOnMobile = false }) => {
  return (
    <nav
      aria-label="Main"
      className={`${hideOnMobile ? 'hidden md:flex' : 'flex'} fixed z-[1000] bg-white
        bottom-0 left-0 right-0 h-[72px] border-t border-gray-200 pb-safe
        md:top-0 md:right-auto md:w-20 md:h-full md:flex-col md:items-center md:gap-1 md:border-t-0 md:border-r md:pt-3 md:pb-4`}
    >
      {/* Logo (PC only) */}
      <div className="hidden md:flex w-11 h-11 mb-4 items-center justify-center" title="SportSphere">
        {APP_CONFIG.logoUrl ? (
          <img src={APP_CONFIG.logoUrl} alt="SportSphere" className="w-full h-full object-contain" />
        ) : (
          <span className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center shadow-elev-1">
            <Flame size={22} className="text-white fill-white/90" />
          </span>
        )}
      </div>

      {ITEMS.map(({ id, label, Icon }) => {
        const active = currentTab === id;
        return (
          <button
            key={id}
            onClick={() => onChangeTab(id)}
            aria-current={active ? 'page' : undefined}
            className="group flex-1 md:flex-none md:w-full md:h-16 flex flex-col items-center justify-center gap-1"
          >
            <span className="relative flex items-center justify-center w-16 md:w-14 h-8">
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
                  className="bump absolute top-0 right-2.5 md:right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
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
