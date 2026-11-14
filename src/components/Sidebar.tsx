'use client';

import React from 'react';
import {
  Home,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { NavigationTab, SupportedLanguage, UserProfile } from '../types';
import { translations } from '../services/translations';

interface SidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  onOpenProfile?: () => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  onOpenProfile,
  currentUser,
  onLogout,
}) => {
  const t = translations[language];

  const navItems = [
    { id: 'home' as NavigationTab, label: t.home, icon: Home },
    { id: 'chat' as NavigationTab, label: t.chat, icon: MessageSquare },
    { id: 'images' as NavigationTab, label: t.images, icon: ImageIcon },
    { id: 'voice' as NavigationTab, label: t.voice, icon: Mic },
    { id: 'settings' as NavigationTab, label: t.settings, icon: SettingsIcon },
  ];

  return (
    <aside className="w-52 lg:w-64 bg-[#111426] border-r border-[#1F243D] flex flex-col justify-between p-3 lg:p-4 h-full shrink-0 select-none overflow-y-auto">
      {/* Top Section */}
      <div className="space-y-5 lg:space-y-6 shrink-0">
        {/* Brand Logo & Tagline */}
        <div className="flex flex-col items-center text-center pt-1 pb-1">
          <div className="relative mb-2.5 lg:mb-3">
            <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-tr from-[#287BFF]/40 to-[#8C62FF]/40 p-0.5 shadow-xl shadow-blue-500/20 border border-cyan-500/40 flex items-center justify-center glow-brain overflow-hidden bg-[#07091A]">
              <img
                src="/assets/offnex_icon_square.png"
                alt="Offnex Ai Logo"
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>
          </div>
          <h1 className="text-lg lg:text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
            <span>Offnex</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#287BFF] to-[#8C62FF]">Ai</span>
          </h1>
          <p className="text-[9px] lg:text-[10px] font-bold tracking-wider text-cyan-400 mt-1 uppercase leading-tight">
            INNOVATION BEYOND LIMITS
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[42px] flex items-center gap-3 px-3 lg:px-4 py-2.5 rounded-xl font-medium text-xs lg:text-sm transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#4435D5] to-[#7547FF] text-white shadow-md shadow-purple-600/30 font-semibold'
                    : 'text-gray-300 hover:text-white hover:bg-[#181D35]'
                }`}
              >
                <Icon className={`w-4 h-4 lg:w-5 lg:h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="space-y-3.5 lg:space-y-4 pt-4 border-t border-[#1F243D]/60 mt-4 shrink-0">
        {/* Language Selector */}
        <div>
          <label className="text-[11px] font-semibold tracking-wider uppercase text-gray-400 block mb-1.5">
            Languages
          </label>
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              aria-label="Select Application Language"
              className="w-full appearance-none bg-[#191D32] border border-[#272D4D] text-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-purple-500 cursor-pointer pr-8 hover:border-purple-500/40 transition-colors"
            >
              <option value="ur">🇵🇰 Urdu (اردو)</option>
              <option value="en">🇬🇧 English</option>
              <option value="roman_ur">🇵🇰 Roman Urdu</option>
              <option value="ar">🇸🇦 Arabic (العربية)</option>
              <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#14182D] border border-purple-500/10">
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div
              aria-label={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User Avatar'}
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-tr from-[#4435D5] to-[#7547FF] flex items-center justify-center text-sm font-extrabold text-white uppercase shrink-0 shadow-md shadow-purple-600/30 border border-purple-400/30 select-none"
            >
              {(
                currentUser?.firstName?.trim()?.[0] ||
                currentUser?.lastName?.trim()?.[0] ||
                currentUser?.email?.trim()?.[0] ||
                'U'
              ).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Rizwan Ahmad'}
              </p>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Sign Out"
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
