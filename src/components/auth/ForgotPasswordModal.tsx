'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { authService } from '../../services/authService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await authService.resetPassword(email, newPassword);
      if (res.success) {
        setSuccessMsg('Password has been successfully updated on this device. You can now Sign In.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      } else {
        setErrorMsg(res.error || 'Failed to reset password.');
      }
    } catch {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#10132B] border border-purple-500/30 rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative space-y-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-3.5 right-3.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#1A1F3E] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 pr-8">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Reset Password</h3>
            <p className="text-xs text-[#B7B8D9]">Offline account recovery on this device</p>
          </div>
        </div>

        {/* Feedback messages */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-3 pt-1">
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Registered Email Address"
              required
              className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-4 py-2.5 outline-none"
            />
          </div>

          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password (Min 8 chars)"
              required
              className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-4 py-2.5 outline-none"
            />
          </div>

          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              required
              className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-4 py-2.5 outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-[#4824D5] to-[#7438F5] hover:from-[#542be8] hover:to-[#844cf8] text-white font-bold text-sm sm:text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
