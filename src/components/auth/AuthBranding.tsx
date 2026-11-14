'use client';

import React from 'react';
import {
  Zap,
  ShieldCheck,
  Lock,
  Rocket,
  CheckCircle2,
} from 'lucide-react';
import { AuthMode } from '../../types';

interface AuthBrandingProps {
  mode: AuthMode;
}

export const AuthBranding: React.FC<AuthBrandingProps> = ({ mode }) => {
  return (
    <div className="flex flex-col justify-between h-full p-4 md:p-6 lg:p-10 xl:p-12 relative z-10">
      {/* Top Brand Logo & Wordmark */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-tr from-[#287BFF]/30 to-[#8C62FF]/30 p-0.5 shadow-xl shadow-blue-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 overflow-hidden bg-[#07091A]">
            <img
              src="/assets/offnex_icon_square.png"
              alt="Offnex Ai Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>Offnex</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#287BFF] to-[#8C62FF]">Ai</span>
            </h1>
            <p className="text-[10px] lg:text-[11px] font-bold tracking-wider text-cyan-400 uppercase">
              INNOVATION BEYOND LIMITS
            </p>
          </div>
        </div>
      </div>

      {/* Middle Section: Artwork & Value Proposition */}
      <div className="my-auto py-5 lg:py-6 space-y-5 lg:space-y-6 max-w-md">
        {/* Futuristic AI Robot Artwork */}
        <div className="relative group w-fit">
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-700 pointer-events-none" />

          <div className="relative w-36 h-36 md:w-40 md:h-40 lg:w-52 lg:h-52 rounded-2xl overflow-hidden border border-purple-500/40 shadow-2xl bg-[#090C1E] flex items-center justify-center">
            <img
              src="/assets/ai_robot_avatar.png"
              alt="Offnex Ai Futuristic Assistant"
              className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07091A] via-transparent to-transparent opacity-40" />
          </div>
        </div>

        {/* Headings & Feature List according to Mode */}
        {mode === 'signin' ? (
          <div className="space-y-3.5 lg:space-y-4">
            <div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Welcome <span className="text-[#8C62FF]">Back!</span>
              </h2>
              <p className="text-xs lg:text-sm text-[#B7B8D9] mt-1.5">
                Sign in to continue your AI journey offline.
              </p>
            </div>

            {/* Feature List for Sign In */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-3 pt-1">
              <div className="flex items-center gap-2.5 text-xs text-gray-200">
                <div className="w-7 h-7 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span>100% Offline AI</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-gray-200">
                <div className="w-7 h-7 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span>Your Privacy</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-gray-200">
                <div className="w-7 h-7 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span>No Cloud Required</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-gray-200">
                <div className="w-7 h-7 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Rocket className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span>Super Fast</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 lg:space-y-4">
            <div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Join{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#287BFF] to-[#8C62FF]">
                  Offnex Ai
                </span>
              </h2>
              <p className="text-xs lg:text-sm text-[#B7B8D9] mt-1.5">
                Create your account and unlock the power of AI.
              </p>
            </div>

            {/* Feature List for Sign Up */}
            <div className="space-y-2 pt-1 text-xs text-gray-200">
              {[
                'Offline AI Assistant',
                'PDF & Document AI',
                'Voice Assistant',
                'AI Image Studio',
                'Multilingual Support',
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="pt-1 hidden lg:block">
              <span className="font-['Caveat',cursive,'Noto_Nastaliq_Urdu'] text-2xl text-purple-200 tracking-wide font-bold italic drop-shadow-md">
                Smarter. Private.<br />Always with You.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Privacy Statement */}
      <div className="pt-4 border-t border-[#1C2042]/50 flex items-center gap-2 text-[11px] lg:text-xs text-gray-400">
        <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span>Your data stays on your device • 100% Private &amp; Secure</span>
      </div>
    </div>
  );
};
