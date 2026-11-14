'use client';

import React, { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { authService } from '../../services/authService';

interface SignUpFormProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSuccess,
  onSwitchToSignIn,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!firstName.trim()) {
      setErrorMsg('First name is required.');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Email address is required.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (!agreedTerms) {
      setErrorMsg('Please agree to the Terms & Privacy Policy to proceed.');
      return;
    }

    setLoading(true);

    try {
      const res = await authService.register({
        firstName,
        lastName,
        email,
        password,
        role: 'user',
      });

      if (res.needsEmailConfirmation) {
        setSuccessMsg(
          res.message ||
            'Account created in Supabase! Please confirm your email link, then Sign In.'
        );
      } else if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to create account.');
      }
    } catch {
      setErrorMsg('An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Brand Header on Mobile (< md) */}
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
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Create Account</h2>
        <p className="text-xs text-[#B7B8D9]">Get started with Offnex Ai</p>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Confirmation Alert */}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-2">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="text-emerald-200 underline font-bold cursor-pointer"
          >
            Go to Sign In &rarr;
          </button>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* First Name & Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative flex items-center">
            <User className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              required
              className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] focus:ring-2 focus:ring-[#7438F5]/20 text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-2.5 outline-none transition-all"
            />
          </div>

          <div className="relative flex items-center">
            <User className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] focus:ring-2 focus:ring-[#7438F5]/20 text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-2.5 outline-none transition-all"
            />
          </div>
        </div>

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
            placeholder="Password (Min. 8 characters)"
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

        {/* Confirm Password */}
        <div className="relative flex items-center">
          <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
            className="w-full min-h-[44px] bg-[#14172F] border border-[#262C54] focus:border-[#7438F5] focus:ring-2 focus:ring-[#7438F5]/20 text-sm sm:text-xs text-white placeholder-gray-400 rounded-xl pl-10 pr-11 py-2.5 outline-none transition-all"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Terms & Privacy Policy Checkbox */}
        <div className="pt-1">
          <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer select-none min-h-[36px]">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="w-4 h-4 rounded border-[#262C54] bg-[#14172F] text-[#7438F5] focus:ring-[#7438F5]/40 accent-[#7438F5] cursor-pointer shrink-0"
            />
            <span>
              I agree to the <span className="text-[#8C62FF] hover:underline">Terms &amp; Privacy Policy</span>
            </span>
          </label>
        </div>

        {/* Create Account Primary Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[46px] py-3 rounded-xl bg-gradient-to-r from-[#4824D5] to-[#7438F5] hover:from-[#542be8] hover:to-[#844cf8] text-white font-bold text-sm sm:text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating your local account...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </>
          )}
        </button>
      </form>

      {/* Bottom Switch to Sign In */}
      <div className="text-center pt-1">
        <p className="text-xs text-gray-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="text-[#8C62FF] hover:text-purple-300 font-bold ml-1 transition-colors cursor-pointer py-1"
          >
            Sign In &rarr;
          </button>
        </p>
      </div>
    </div>
  );
};
