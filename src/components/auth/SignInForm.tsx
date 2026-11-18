'use client';

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { authService } from '../../services/authService';

interface SignInFormProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  onSuccess,
  onSwitchToSignUp,
  onForgotPassword,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [socialNote, setSocialNote] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await authService.login(email, password, rememberMe);
      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to sign in. Please verify your credentials.');
      }
    } catch {
      setErrorMsg('Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialClick = (provider: 'Google' | 'Microsoft') => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    if (!isOnline) {
      setSocialNote(
        `Cloud ${provider} authentication requires an active internet connection. Please use local email sign-in for 100% offline access.`
      );
    } else {
      setSocialNote(
        `Offnex Ai prioritizes local sovereignty. Cloud ${provider} OAuth is in local sandbox mode; local email login is recommended to ensure zero data leaves your device.`
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Brand Header on Mobile (< md) where left AuthBranding is hidden */}
      <div className="flex md:hidden flex-col items-center text-center space-y-1.5 pb-3 border-b border-[#1E2346]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#287BFF]/30 to-[#8C62FF]/30 p-0.5 shadow-lg shadow-blue-500/20 border border-cyan-500/30 flex items-center justify-center overflow-hidden bg-[#07091A]">
          <img
            src="/assets/offnex_icon_square.png"
            alt="Offnex Ai Logo"
            className="w-full h-full object-cover rounded-xl"
          />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>Offnex</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#287BFF] to-[#8C62FF]">Ai</span>
          </h1>
          <p className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">INNOVATION BEYOND LIMITS</p>
        </div>
      </div>

      {/* Heading & Subtitle */}
      <div className="text-center space-y-0.5">
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Sign In</h2>
        <p className="text-xs text-[#B7B8D9]">Access your Offnex Ai account</p>
      </div>

      {/* Error Message Alert */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Social Provider Note */}
      {socialNote && (
        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-300 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
          <div className="space-y-1">
            <p>{socialNote}</p>
            <button
              type="button"
              onClick={() => setSocialNote(null)}
              className="text-[10px] text-blue-200 underline font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
        {/* Email Address */}
        <div className="relative flex items-center">
          <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            required
            className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] focus:ring-2 focus:ring-[#7438F5]/20 text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-4 py-2.5 outline-none transition-all"
          />
        </div>

        {/* Password */}
        <div className="relative flex items-center">
          <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (Min. 6 characters)"
            minLength={6}
            required
            className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] focus:ring-2 focus:ring-[#7438F5]/20 text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-11 py-2.5 outline-none transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 min-h-[36px]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[#262C54] bg-[#14172F] text-[#7438F5] focus:ring-[#7438F5]/40 accent-[#7438F5] cursor-pointer"
            />
            <span>Remember Me</span>
          </label>

          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[#8C62FF] hover:text-purple-300 font-medium transition-colors cursor-pointer min-h-[36px] flex items-center"
          >
            Forgot Password?
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[46px] py-3 rounded-xl bg-gradient-to-r from-[#4824D5] to-[#7438F5] hover:from-[#542be8] hover:to-[#844cf8] text-white font-bold text-sm sm:text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying local credentials...</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center justify-center pt-1">
        <div className="border-t border-[#22284E] w-full" />
        <span className="bg-[#10132B] px-3 text-[11px] text-gray-400 uppercase tracking-widest absolute">
          or
        </span>
      </div>

      {/* Social Providers */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={() => handleSocialClick('Google')}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#141832] hover:bg-[#1A1F42] border border-[#242A52] text-xs font-semibold text-gray-200 hover:text-white flex items-center justify-center gap-3 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={() => handleSocialClick('Microsoft')}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#141832] hover:bg-[#1A1F42] border border-[#242A52] text-xs font-semibold text-gray-200 hover:text-white flex items-center justify-center gap-3 transition-colors cursor-pointer"
        >
          <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5 shrink-0">
            <div className="bg-[#F25022]" />
            <div className="bg-[#7FBA00]" />
            <div className="bg-[#00A4EF]" />
            <div className="bg-[#FFB900]" />
          </div>
          <span>Continue with Microsoft</span>
        </button>
      </div>

      {/* Bottom Switch to Sign Up */}
      <div className="text-center pt-1">
        <p className="text-xs text-gray-400">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-[#8C62FF] hover:text-purple-300 font-bold ml-1 transition-colors cursor-pointer py-1"
          >
            Sign Up &rarr;
          </button>
        </p>
      </div>
    </div>
  );
};
