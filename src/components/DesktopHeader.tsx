'use client';

import React from 'react';
import { Settings as SettingsIcon, LogOut, Sun, Moon, Wifi, WifiOff } from 'lucide-react';
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
  isNetworkOnline?: boolean;
  onToggleOfflineMode?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  setActiveTab,
  currentUser,
  onLogout,
  offlineStrict = false,
  isNetworkOnline = true,
  onToggleOfflineMode,
  theme = 'dark',
  onToggleTheme,
}) => {
  const effectiveOffline = Boolean(offlineStrict) || !isNetworkOnline;

  return (
    <header className="hidden md:flex h-12 border-b border-[#1F243D] bg-[#0E1020]/90 backdrop-blur-md px-3 lg:px-4 items-center justify-between select-none z-30 shrink-0 w-full gap-3">
      {/* Left: One-click Offline / Online Mode Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleOfflineMode}
          title={
            offlineStrict
              ? 'Offline Mode Active — Click to switch to Online Mode'
              : !isNetworkOnline
              ? 'No Internet Detected — Running in 100% Offline Mode'
              : 'Online Mode Active — Click to switch to Offline Mode'
          }
          className={`flex items-center gap-2 ${
            effectiveOffline
              ? 'bg-[#14182B] border-emerald-500/35 text-emerald-400 hover:border-emerald-400/60'
              : 'bg-blue-950/40 border-blue-500/35 text-blue-400 hover:border-blue-400/60'
          } border px-2.5 py-1 rounded-full text-xs font-medium shadow-sm shrink-0 whitespace-nowrap transition-all cursor-pointer`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                effectiveOffline ? 'bg-emerald-400' : 'bg-blue-400'
              } opacity-75`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                effectiveOffline ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
          </span>
          {effectiveOffline ? (
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Wifi className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{effectiveOffline ? 'Offline Mode' : 'Online Mode'}</span>
          <span className="text-gray-400 hidden lg:inline">
            • {effectiveOffline ? 'Works Without Internet' : 'Connected to Cloud/API'}
          </span>
        </button>
      </div>

      {/* Right: User Status, Theme & Settings */}
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

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to White Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to White Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1A1F38] transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-purple-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
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
