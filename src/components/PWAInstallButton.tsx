'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Monitor,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import { DevicePlatform, usePWAInstall, warmOfflineAppCache } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'default',
  className = '',
}) => {
  const { isInstallable, isInstalled, platform, isEmbedded, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<DevicePlatform>(platform);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [standaloneUrl, setStandaloneUrl] = useState('/?install=1');

  useEffect(() => {
    setSelectedPlatform(platform);
  }, [platform]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setStandaloneUrl(`${window.location.origin}/?install=1`);
    }
  }, []);

  if (isInstalled) {
    return null;
  }

  const handlePrimaryClick = async () => {
    setFeedback(null);
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        void warmOfflineAppCache([], true);
        return;
      }
    }
    setShowGuide(true);
  };

  const handleModalInstall = async () => {
    setFeedback(null);
    if (isInstallable && selectedPlatform !== 'ios') {
      const outcome = await install();
      if (outcome === 'accepted') {
        void warmOfflineAppCache([], true);
        setShowGuide(false);
        return;
      }
      if (outcome === 'dismissed') {
        setFeedback('Install cancel hua — dobara click karke install kar sakte hain.');
        return;
      }
    }

    if (selectedPlatform === 'ios') {
      setFeedback('Safari mein neeche Share (□↑) → Add to Home Screen par tap karein.');
    } else if (selectedPlatform === 'android') {
      setFeedback('Chrome menu (⋮) → Install app / Add to Home screen par tap karein.');
    } else {
      setFeedback('Chrome ya Edge ke address bar ke right side par Install App icon par click karein.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePrimaryClick}
        title="Install Offnex Ai for Offline Use on Mobile & PC"
        className={
          variant === 'compact'
            ? `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#4435D5] to-[#7547FF] hover:brightness-110 text-white text-[11px] font-semibold shadow-sm shadow-purple-600/25 transition-all cursor-pointer shrink-0 whitespace-nowrap ${className}`
            : `inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#4435D5] to-[#7547FF] hover:brightness-110 text-white text-xs font-semibold shadow-md shadow-purple-600/25 transition-all cursor-pointer shrink-0 whitespace-nowrap ${className}`
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{isInstallable ? 'Install App' : 'Install'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#111426] border border-[#272D50] p-5 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/assets/offnex_icon_square.png"
                  alt="Offnex Ai"
                  className="w-10 h-10 rounded-xl border border-purple-500/30 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Install Offnex Ai</h3>
                  <p className="text-xs text-gray-400">
                    Install karne ke baad bagair internet ke bhi chalegi
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close install dialog"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isEmbedded && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
                Aap abhi preview frame mein hain. Direct install aur offline cache save karne ke liye live browser tab mein kholein.
              </div>
            )}

            <div className="space-y-2 text-xs">
              {(
                [
                  {
                    id: 'desktop' as const,
                    label: 'PC / Laptop (Windows / Mac)',
                    desc: 'Chrome ya Edge ke address bar mein Install App icon par click karein.',
                    icon: Monitor,
                  },
                  {
                    id: 'android' as const,
                    label: 'Android Mobile (Chrome)',
                    desc: 'Chrome menu (⋮) → Install app / Add to Home screen.',
                    icon: Smartphone,
                  },
                  {
                    id: 'ios' as const,
                    label: 'iPhone / iPad (Safari)',
                    desc: 'Safari Share (□↑) → Add to Home Screen.',
                    icon: Share2,
                  },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = selectedPlatform === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlatform(opt.id);
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'bg-purple-600/15 border-purple-500'
                        : 'bg-[#14182D] border-[#222846] hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="flex items-center gap-2 font-bold text-white">
                        <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                        {opt.label}
                      </span>
                      {active && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-gray-400">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className="mt-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-gray-200 leading-relaxed">
                {feedback}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {isEmbedded ? (
                <a
                  href={standaloneUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Standalone &amp; Install</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleModalInstall}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Now</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-xl bg-[#1A1F38] hover:bg-[#252C52] border border-[#272D50] text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
