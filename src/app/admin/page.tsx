'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { authService } from '@/services/authService';
import { UserProfile } from '@/types';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';

const OFFLINE_ADMIN_UNLOCK_KEY = 'offnex_admin_unlocked';

export default function AdminRoutePage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      await authService.init();
      if (!active) return;
      setCurrentUser(authService.getCurrentUser());

      let unlocked = false;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const res = await fetch('/api/admin/auth', { cache: 'no-store' });
          if (res.ok) {
            const data = (await res.json()) as { authenticated?: boolean };
            unlocked = Boolean(data.authenticated);
          }
        } catch {
          // Offline fallback below
        }
      }

      if (!unlocked && typeof window !== 'undefined') {
        try {
          unlocked = sessionStorage.getItem(OFFLINE_ADMIN_UNLOCK_KEY) === 'true';
        } catch {
          // Ignore storage error
        }
      }

      if (active) {
        setIsAdminUnlocked(unlocked);
        setIsHydrated(true);
      }
    }

    hydrate();
    return () => {
      active = false;
    };
  }, []);

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setAuthError('Please enter the admin password.');
      return;
    }

    setAuthError('');
    setIsVerifying(true);

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: passwordInput.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };

        if (res.ok && data.ok) {
          try {
            sessionStorage.setItem(OFFLINE_ADMIN_UNLOCK_KEY, 'true');
          } catch {
            // Ignore
          }
          setIsAdminUnlocked(true);
          setPasswordInput('');
          return;
        }

        if (res.status === 401 || res.status === 403) {
          setAuthError(data.error || 'Incorrect admin password.');
          return;
        }
      }

      // Offline fallback verification against one-way hash
      const offlineValid = await authService.verifyOfflineAdminPasscode(passwordInput.trim());
      if (offlineValid) {
        try {
          sessionStorage.setItem(OFFLINE_ADMIN_UNLOCK_KEY, 'true');
        } catch {
          // Ignore
        }
        setIsAdminUnlocked(true);
        setPasswordInput('');
      } else {
        setAuthError('Incorrect admin password.');
      }
    } catch {
      const offlineValid = await authService.verifyOfflineAdminPasscode(passwordInput.trim());
      if (offlineValid) {
        try {
          sessionStorage.setItem(OFFLINE_ADMIN_UNLOCK_KEY, 'true');
        } catch {
          // Ignore
        }
        setIsAdminUnlocked(true);
        setPasswordInput('');
      } else {
        setAuthError('Incorrect admin password.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="h-[100dvh] w-full bg-[#070914] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#7547FF]/40 bg-[#07091A] shadow-xl shadow-[#7547FF]/25">
          <img src="/assets/offnex_icon_square.png" alt="Offnex Ai" className="w-full h-full object-cover" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-extrabold text-white tracking-tight">
            Offnex <span className="text-[#8C62FF]">AI</span> Admin
          </p>
          <p className="text-xs text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdminUnlocked) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#070914] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#101426]/95 border border-white/10 shadow-2xl shadow-purple-950/30 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7547FF]/30 to-[#3B82F6]/20 border border-[#7547FF]/40 flex items-center justify-center shadow-lg shadow-[#7547FF]/20">
              <ShieldCheck className="w-7 h-7 text-[#A78BFA]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Admin Panel Access
              </h1>
              <p className="text-xs text-slate-400">
                Enter your Admin Password to unlock Offnex AI Control Center
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlockAdmin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-300">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  placeholder="Enter admin password"
                  autoFocus
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#0A0D1C] border border-white/10 focus:border-[#7547FF] focus:ring-2 focus:ring-[#7547FF]/25 outline-none text-sm text-white placeholder:text-slate-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {authError && (
                <p className="text-xs font-medium text-rose-400 pt-1">{authError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7547FF] to-[#5B32E5] hover:brightness-110 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-[#7547FF]/30 transition cursor-pointer"
            >
              {isVerifying ? 'Verifying...' : 'Unlock Admin Panel'}
            </button>
          </form>

          <div className="pt-2 border-t border-white/10 flex justify-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminPanel
      currentUser={currentUser}
      onExitAdmin={() => router.push('/')}
      onLogout={() => {
        fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => undefined);
        try {
          sessionStorage.removeItem(OFFLINE_ADMIN_UNLOCK_KEY);
        } catch {
          // Ignore
        }
        setIsAdminUnlocked(false);
        authService.logout();
        setCurrentUser(null);
      }}
    />
  );
}
