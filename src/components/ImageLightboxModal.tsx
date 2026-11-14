'use client';

import React, { useState } from 'react';
import {
  X,
  Download,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { downloadGeneratedImage } from '../services/imageService';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  prompt: string;
  style?: string;
  aspectRatio?: string;
  modelUsed?: string;
  createdAt?: string;
  onRegenerate?: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  prompt,
  style,
  aspectRatio,
  modelUsed,
  createdAt,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpeg'>('png');

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    await downloadGeneratedImage(imageUrl, prompt.slice(0, 32) || 'offnex_image', downloadFormat);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#0E1122] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-[#1F243D] bg-[#0B0B16]/90 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-xs font-bold text-white truncate">Generated Image Preview</span>
            {style && (
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md bg-purple-600/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                {style}
              </span>
            )}
            {aspectRatio && (
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md bg-[#181D35] text-gray-300 border border-[#272D4D] whitespace-nowrap">
                {aspectRatio}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#1C213D] transition-colors cursor-pointer shrink-0"
            title="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Full-size Image */}
        <div className="flex-1 bg-[#070812] flex items-center justify-center p-3 sm:p-4 overflow-auto min-h-0">
          <img
            src={imageUrl}
            alt={prompt}
            className="max-w-full max-h-[55dvh] sm:max-h-[62dvh] object-contain rounded-xl shadow-2xl border border-white/10"
          />
        </div>

        {/* Bottom Details & Actions */}
        <div className="p-3.5 sm:p-4 border-t border-[#1F243D] bg-[#0B0B16]/95 space-y-3 pb-safe">
          <p className="text-xs text-gray-200 leading-relaxed line-clamp-3">{prompt}</p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-gray-400">
              {modelUsed && <span>Model: <strong className="text-purple-300">{modelUsed}</strong></span>}
              {createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(createdAt).toLocaleString()}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-[#14182E] border border-[#272D4D] rounded-xl overflow-hidden">
                <select
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value as 'png' | 'jpeg')}
                  aria-label="Download format"
                  className="bg-transparent text-[11px] text-gray-200 px-2 py-2 focus:outline-none cursor-pointer"
                >
                  <option value="png" className="bg-[#14182E]">PNG</option>
                  <option value="jpeg" className="bg-[#14182E]">JPEG</option>
                </select>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyPrompt}
                className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181D35] hover:bg-[#222849] text-gray-200 text-xs font-medium border border-[#272D4D] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
              </button>

              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => {
                    onRegenerate();
                    onClose();
                  }}
                  className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 text-xs font-semibold border border-purple-500/30 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
