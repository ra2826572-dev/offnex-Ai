'use client';

import React from 'react';
import { Home, MessageSquare, Image as ImageIcon, Mic, Settings } from 'lucide-react';
import { NavigationTab } from '../types';

interface MobileBottomNavProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const items = [
    { id: 'home' as NavigationTab, label: 'Home', icon: Home },
    { id: 'chat' as NavigationTab, label: 'Chat', icon: MessageSquare },
    { id: 'images' as NavigationTab, label: 'Images', icon: ImageIcon },
    { id: 'voice' as NavigationTab, label: 'Voice', icon: Mic },
    { id: 'settings' as NavigationTab, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden bg-[#101324]/95 backdrop-blur-md border-t border-[#1F243D] flex items-center justify-around px-1 pt-1 pb-safe z-40 shrink-0 min-h-[56px]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center min-h-[46px] py-1 px-1 rounded-xl transition-colors cursor-pointer ${
              isActive ? 'text-[#8C62FF]' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-[#8C62FF]' : 'text-gray-400'}`} />
            <span className="text-[10px] mt-0.5 font-medium whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
