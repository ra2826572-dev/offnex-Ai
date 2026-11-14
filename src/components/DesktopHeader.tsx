'use client';

import React from 'react';
import { Settings as SettingsIcon, LogOut } from 'lucide-react';
import { NavigationTab, UserProfile } from '../types';

interface DesktopHeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  activeModelName: string;
  isOllamaConnected: boolean;
  onOpenModelManager: () => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  offlineStrict?: boolean;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  setActiveTab,
  currentUser,
  onLogout,
  offlineStrict = true,
}) => {
  return (
    <header className="hidden md:flex h-12 border-b border-[#1F243D] bg-[#0E1020]/90 backdrop-blur-md px-3 lg:px-4 items-center justify-between select-none z-30 shrink-0 w-full gap-3">
      {/* Left: Dynamic Status Badge (Offline when toggle ON, Online when OFF) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div
          className={`flex items-center gap-2 ${
            offlineStrict
              ? 'bg-[#14182B] border-emerald-500/30 text-emerald-400'
              : 'bg-blue-950/40 border-blue-500/30 text-blue-400'
          } border px-2.5 py-1 rounded-full text-xs font-medium shadow-sm shrink-0 whitespace-nowrap`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                offlineStrict ? 'bg-emerald-400' : 'bg-blue-400'
              } opacity-75`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                offlineStrict ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
          </span>
          <span>{offlineStrict ? 'Offline Mode' : 'Online Mode'}</span>
          <span className="text-gray-400 hidden lg:inline">
            • {offlineStrict ? 'No Internet Required' : 'Connected to Cloud/API'}
          </span>
        </div>
      </div>

      {/* Right: User Status & Settings */}
      <div className="flex items-center gap-2 shrink-0">
        {currentUser && (
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#14182D] border border-purple-500/20 hover:border-purple-500/40 text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <div
              aria-hidden="true"
              className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#4435D5] to-[#7547FF] flex items-center justify-center text-[10px] font-extrabold text-white uppercase shrink-0 select-none"
            >
              {(
                currentUser.firstName?.trim()?.[0] ||
                currentUser.lastName?.trim()?.[0] ||
                currentUser.email?.trim()?.[0] ||
                'U'
              ).toUpperCase()}
            </div>
            <span className="text-gray-200 font-medium">{currentUser.firstName}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          title="Settings"
          aria-label="Settings"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1A1F38] transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            aria-label="Sign Out"
            className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
