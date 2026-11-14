'use client';

import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  Cpu,
  Moon,
  Sun,
  WifiOff,
  Wifi,
  Save,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { AppSettings, SupportedLanguage, UserProfile } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onOpenModelManager: () => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onOpenModelManager,
  language,
  setLanguage,
  currentUser,
  onLogout,
}) => {
  const [autoSave, setAutoSave] = useState(settings.autoSaveHistory);

  return (
    <div className="flex-1 w-full h-full bg-[#0B0D18] overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 pb-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F243D] mb-5 sm:mb-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">Application Settings</h2>
              <p className="text-xs text-gray-400 truncate">Offline preferences &amp; local AI configuration</p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#171B36] to-[#12162B] border border-purple-500/20 shadow-md mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              aria-label={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User Avatar'}
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4435D5] to-[#7547FF] flex items-center justify-center text-lg font-extrabold text-white uppercase shrink-0 shadow-lg shadow-purple-600/30 border border-purple-400/30 select-none"
            >
              {(
                currentUser?.firstName?.trim()?.[0] ||
                currentUser?.lastName?.trim()?.[0] ||
                currentUser?.email?.trim()?.[0] ||
                'U'
              ).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Rizwan Ahmad'}
              </h3>
              <p className="text-xs text-gray-400 truncate">
                {currentUser?.email || 'rizwan@gmail.com'} • Local Account
              </p>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto min-h-[40px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>

        {/* Preferences List */}
        <div className="space-y-3 sm:space-y-4">
          {/* Language Item */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Globe className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Language</div>
                <div className="text-[11px] text-gray-400">Application interface and response default</div>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              aria-label="Application Interface Language"
              className="w-full sm:w-auto min-h-[40px] bg-[#1A1F38] text-xs text-gray-200 border border-[#272D50] rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer shrink-0"
            >
              <option value="ur">Urdu (اردو)</option>
              <option value="en">English</option>
              <option value="roman_ur">Roman Urdu</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          {/* AI Models Item */}
          <div
            onClick={onOpenModelManager}
            className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] hover:border-purple-500/40 flex items-center justify-between gap-3 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Cpu className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">AI Models</div>
                <div className="text-[11px] text-gray-400 truncate">Current: {settings.defaultModel}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-purple-300 shrink-0 whitespace-nowrap">
              <span>Manage</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Theme */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {settings.theme === 'dark' ? (
                <Moon className="w-5 h-5 text-purple-400 shrink-0" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Theme</div>
                <div className="text-[11px] text-gray-400 truncate">
                  {settings.theme === 'dark' ? 'Dark Mode (#0B0D18 Deep Obsidian)' : 'Light Mode (Offnex Ai Studio)'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
                onUpdateSettings({ ...settings, theme: nextTheme });
              }}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1F38] hover:bg-[#252C52] border border-[#272D50] text-xs font-semibold text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Offline Mode Toggle */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {settings.offlineStrict ? (
                <WifiOff className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Wifi className="w-5 h-5 text-blue-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Offline Mode</div>
                <div className="text-[11px] text-gray-400">
                  {settings.offlineStrict ? 'Strictly offline (No cloud sync)' : 'Online connected mode'}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle Offline Mode"
              onClick={() => {
                const nextVal = !settings.offlineStrict;
                onUpdateSettings({ ...settings, offlineStrict: nextVal });
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                settings.offlineStrict ? 'bg-purple-600' : 'bg-blue-600'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.offlineStrict ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto Save Chat History Toggle */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#14182D] border border-[#222846] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Save className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">Auto Save Chat History</div>
                <div className="text-[11px] text-gray-400">Persist conversations to local storage</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle Auto Save Chat History"
              onClick={() => {
                setAutoSave(!autoSave);
                onUpdateSettings({ ...settings, autoSaveHistory: !autoSave });
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                autoSave ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  autoSave ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
