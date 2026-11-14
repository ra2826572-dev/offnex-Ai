'use client';

import React from 'react';
import {
  X,
  Home,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  Settings,
  Power,
  LogOut,
} from 'lucide-react';
import { NavigationTab, SupportedLanguage, UserProfile } from '../types';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  language?: SupportedLanguage;
  setLanguage?: (lang: SupportedLanguage) => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  language,
  setLanguage,
}) => {
  if (!isOpen) return null;

  const navItems = [
    { id: 'home' as NavigationTab, label: 'Home', icon: Home },
    { id: 'chat' as NavigationTab, label: 'Chat', icon: MessageSquare },
    { id: 'images' as NavigationTab, label: 'Images', icon: ImageIcon },
    { id: 'voice' as NavigationTab, label: 'Voice Assistant', icon: Mic },
    { id: 'settings' as NavigationTab, label: 'Settings', icon: Settings },
  ];

  const handleSelect = (tab: NavigationTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[85vw] bg-[#111426] h-full z-10 flex flex-col justify-between p-4 sm:p-5 border-r border-[#1F243D] shadow-2xl overflow-y-auto pb-safe">
        <div className="space-y-5 shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-cyan-500/40 p-0.5 bg-[#07091A] shadow-md shadow-blue-500/20 shrink-0">
                <img
                  src="/assets/offnex_icon_square.png"
                  alt="Offnex Ai"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <span className="font-extrabold text-white text-base">
                <span>Offnex</span> <span className="text-[#287BFF]">Ai</span>
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-400 hover:text-white rounded-xl hover:bg-[#1A1F38] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#4435D5] to-[#7547FF] text-white shadow-md'
                      : 'text-gray-300 hover:bg-[#181D35] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Language Selector */}
          {language && setLanguage && (
            <div className="pt-2 border-t border-[#1F243D]/70">
              <label className="text-[11px] font-semibold tracking-wider uppercase text-gray-400 block mb-1.5">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                aria-label="Select Application Language"
                className="w-full min-h-[42px] bg-[#191D32] border border-[#272D4D] text-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="ur">🇵🇰 Urdu (اردو)</option>
                <option value="en">🇬🇧 English</option>
                <option value="roman_ur">🇵🇰 Roman Urdu</option>
                <option value="ar">🇸🇦 Arabic (العربية)</option>
                <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="space-y-2 pt-4 border-t border-[#1F243D] mt-4 shrink-0">
          {/* User info */}
          <div
            onClick={() => handleSelect('settings')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#14182D] border border-purple-500/10 mb-2 cursor-pointer"
          >
            <div
              aria-label={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User Avatar'}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4435D5] to-[#7547FF] flex items-center justify-center text-sm font-extrabold text-white uppercase shrink-0 shadow-md shadow-purple-600/30 border border-purple-400/30 select-none"
            >
              {(
                currentUser?.firstName?.trim()?.[0] ||
                currentUser?.lastName?.trim()?.[0] ||
                currentUser?.email?.trim()?.[0] ||
                'U'
              ).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Rizwan Ahmad'}
              </p>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full min-h-[42px] flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (confirm('Exit Offnex Ai? Local state is preserved.')) {
                window.close();
              }
            }}
            className="w-full min-h-[42px] flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
          >
            <Power className="w-4 h-4" />
            <span>Exit App</span>
          </button>
        </div>
      </div>
    </div>
  );
};
