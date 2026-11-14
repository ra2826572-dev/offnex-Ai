'use client';

import React, { useState } from 'react';
import {
  User,
  UserPlus,
  Sun,
  Moon,
  Lock,
  Zap,
  ShieldCheck,
  Rocket,
} from 'lucide-react';
import { AuthMode } from '../../types';
import { AuthBranding } from './AuthBranding';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface AuthPageProps {
  initialMode?: AuthMode;
  onAuthenticated: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'signin',
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [themeToast, setThemeToast] = useState<string | null>(null);

  const handleToggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    setThemeToast(nextMode ? 'Switched to Deep Obsidian Dark Mode' : 'Switched to Light Mode (Offnex Ai Studio)');
    setTimeout(() => setThemeToast(null), 2500);
  };

  return (
    <div
      className={`relative h-full w-full ${
        isDarkMode ? 'bg-[#07091A] text-white' : 'bg-slate-900 text-white'
      } overflow-y-auto overflow-x-hidden select-none transition-colors duration-500`}
    >
      {/* Background Ambient Glowing Waves */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -right-32 w-72 sm:w-96 h-72 sm:h-96 bg-purple-700/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/4 -left-20 w-64 sm:w-80 h-64 sm:h-80 bg-blue-600/15 rounded-full blur-[90px]" />
        <div className="absolute -bottom-20 left-0 right-0 h-72 bg-gradient-to-t from-purple-900/25 via-indigo-900/10 to-transparent blur-2xl" />
        <div className="absolute bottom-6 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent shadow-[0_0_20px_rgba(130,85,255,0.4)]" />
      </div>

      {/* Theme Toast Notification */}
      {themeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-purple-900/95 border border-purple-500/50 text-purple-200 text-xs shadow-2xl flex items-center gap-2 max-w-[90vw] whitespace-nowrap">
          <Sun className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
          <span className="truncate">{themeToast}</span>
        </div>
      )}

      {/* Scrollable Centering Container */}
      <div className="relative z-10 min-h-full w-full flex flex-col items-center justify-center px-4 py-5 sm:px-6 sm:py-8 lg:p-10 pb-safe">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 lg:gap-8 items-center">
          {/* LEFT COLUMN: BRANDING (Tablet md+ and Desktop lg+) */}
          <div className="hidden md:flex md:col-span-5 lg:col-span-6 xl:col-span-7 flex-col justify-center">
            <AuthBranding mode={mode} />
          </div>

          {/* RIGHT COLUMN: AUTHENTICATION CARD (Full width on Mobile, 7 cols on Tablet, 5-6 cols on Desktop) */}
          <div className="col-span-1 md:col-span-7 lg:col-span-6 xl:col-span-5 w-full flex flex-col items-center">
            {/* Top Bar on Mobile/Tablet: Theme Toggle */}
            <div className="w-full max-w-md flex items-center justify-between md:justify-end mb-2.5 px-1">
              {/* Compact Mobile Brand Tag */}
              <div className="flex md:hidden items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#287BFF]/30 to-[#8C62FF]/30 p-0.5 border border-cyan-500/30 overflow-hidden bg-[#07091A]">
                  <img
                    src="/assets/offnex_icon_square.png"
                    alt="Offnex Ai Logo"
                    className="w-full h-full object-cover rounded-md"
                  />
                </div>
                <span className="text-sm font-extrabold tracking-tight text-white">
                  Offnex <span className="text-[#8C62FF]">Ai</span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleTheme}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#10132B]/90 hover:bg-[#1A1F3E] border border-purple-500/30 text-gray-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-95"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-300" />}
              </button>
            </div>

            {/* Glassmorphism Auth Card */}
            <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-[#10132B]/90 backdrop-blur-xl border border-[rgba(130,85,255,0.35)] p-5 sm:p-7 lg:p-8 shadow-2xl shadow-purple-950/40 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

              {/* Top Auth Tabs: Sign In / Sign Up */}
              <div className="p-1 rounded-2xl bg-[#090B1E] border border-[#20254D] grid grid-cols-2 gap-1 mb-5 sm:mb-6">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-gradient-to-r from-[#4824D5] to-[#7438F5] text-white shadow-md shadow-purple-600/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-gradient-to-r from-[#4824D5] to-[#7438F5] text-white shadow-md shadow-purple-600/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </button>
              </div>

              {/* Form Component */}
              {mode === 'signin' ? (
                <SignInForm
                  onSuccess={onAuthenticated}
                  onSwitchToSignUp={() => setMode('signup')}
                  onForgotPassword={() => setIsForgotPasswordOpen(true)}
                />
              ) : (
                <SignUpForm
                  onSuccess={onAuthenticated}
                  onSwitchToSignIn={() => setMode('signin')}
                />
              )}
            </div>

            {/* Compact Mobile Features & Privacy Footer (shown below card on Mobile < md) */}
            <div className="w-full max-w-md mt-4 md:hidden space-y-3 px-1">
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                <div className="flex items-center gap-2 bg-[#10132B]/70 border border-[#20254D] rounded-xl px-3 py-2">
                  <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">100% Offline AI</span>
                </div>
                <div className="flex items-center gap-2 bg-[#10132B]/70 border border-[#20254D] rounded-xl px-3 py-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Full Privacy</span>
                </div>
                <div className="flex items-center gap-2 bg-[#10132B]/70 border border-[#20254D] rounded-xl px-3 py-2">
                  <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">No Cloud Needed</span>
                </div>
                <div className="flex items-center gap-2 bg-[#10132B]/70 border border-[#20254D] rounded-xl px-3 py-2">
                  <Rocket className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Super Fast</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 text-center pb-2">
                <Lock className="w-3 h-3 text-purple-400 shrink-0" />
                <span>Your data stays on your device • Private &amp; Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSuccess={() => setMode('signin')}
      />
    </div>
  );
};
