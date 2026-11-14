'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { authService } from '@/services/authService';
import { UserProfile } from '@/types';

export default function AdminRoutePage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    authService.init().then(() => {
      setCurrentUser(authService.getCurrentUser());
      setIsHydrated(true);
    });
  }, []);

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

  return (
    <AdminPanel
      currentUser={currentUser}
      onExitAdmin={() => router.push('/')}
      onLogout={() => {
        authService.logout();
        setCurrentUser(null);
      }}
    />
  );
}
