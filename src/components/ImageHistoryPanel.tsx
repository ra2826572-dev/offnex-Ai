'use client';

import React, { useState } from 'react';
import {
  X,
  History,
  Search,
  Download,
  RefreshCw,
  Trash2,
  Maximize2,
  Image as ImageIcon,
  Calendar,
} from 'lucide-react';
import { GeneratedImageRecord } from '../types';
import { downloadGeneratedImage } from '../services/imageService';

interface ImageHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  records: GeneratedImageRecord[];
  onDeleteRecord: (id: string) => void;
  onRegenerateFromRecord: (record: GeneratedImageRecord) => void;
  onOpenLightbox: (payload: {
    imageUrl: string;
    prompt: string;
    style?: string;
    aspectRatio?: string;
    modelUsed?: string;
    createdAt?: string;
    onRegenerate?: () => void;
  }) => void;
}

export const ImageHistoryPanel: React.FC<ImageHistoryPanelProps> = ({
  isOpen,
  onClose,
  records,
  onDeleteRecord,
  onRegenerateFromRecord,
  onOpenLightbox,
}) => {
  const [search, setSearch] = useState('');
  const [formatMap, setFormatMap] = useState<Record<string, 'png' | 'jpeg'>>({});

  if (!isOpen) return null;

  const filtered = records.filter(
    (r) =>
      r.prompt.toLowerCase().includes(search.toLowerCase()) ||
      r.style.toLowerCase().includes(search.toLowerCase()) ||
      r.modelUsed.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#0B0B16] border-l border-[#1F243D] h-full flex flex-col shadow-2xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#1F243D] bg-[#101324] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <History className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Image History</h3>
              <p className="text-[11px] text-gray-400">{records.length} saved generation(s)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Image History"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C213D] transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#1F243D]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts, styles, or models..."
              className="w-full bg-[#14172B] text-gray-200 text-sm sm:text-xs rounded-xl pl-8 pr-3 py-2.5 sm:py-2 border border-[#262C4A] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filtered.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-[#111426] border border-dashed border-[#262C4A]">
              <ImageIcon className="w-8 h-8 text-gray-500 mb-2" />
              <p className="text-xs font-semibold text-gray-300">
                {records.length === 0 ? 'No generated images yet' : 'No matching images found'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Switch to Image Mode in chat to generate your first AI image.
              </p>
            </div>
          ) : (
            filtered.map((rec) => {
              const primaryImg = rec.images[0];
              const fmt = formatMap[rec.id] || 'png';
              return (
                <div
                  key={rec.id}
                  className="p-3 rounded-2xl bg-[#14172B]/90 border border-[#242A48] hover:border-purple-500/40 transition-all space-y-2.5"
                >
                  {/* Thumbnail Grid */}
                  <div className={`grid gap-1.5 ${rec.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {rec.images.map((img) => (
                      <div
                        key={img.id}
                        className="relative group rounded-xl overflow-hidden bg-[#0B0D18] border border-white/10 cursor-pointer"
                        onClick={() =>
                          onOpenLightbox({
                            imageUrl: img.dataUrl,
                            prompt: rec.prompt,
                            style: rec.style,
                            aspectRatio: rec.aspectRatio,
                            modelUsed: rec.modelUsed,
                            createdAt: rec.createdAt,
                            onRegenerate: () => {
                              onRegenerateFromRecord(rec);
                              onClose();
                            },
                          })
                        }
                      >
                        <img
                          src={img.dataUrl}
                          alt={rec.prompt}
                          className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 right-2 sm:inset-0 bg-transparent sm:bg-black/40 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-semibold">
                            <Maximize2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Full Size</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-200 font-medium line-clamp-2">{rec.prompt}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                      <span className="px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/20">
                        {rec.style}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#1A1F38] text-gray-300">
                        {rec.aspectRatio}
                      </span>
                      <span className="truncate max-w-[140px]">{rec.modelUsed}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(rec.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#1F243D] gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {primaryImg && (
                        <div className="flex items-center bg-[#191D35] border border-[#272D4D] rounded-lg overflow-hidden">
                          <select
                            value={fmt}
                            onChange={(e) =>
                              setFormatMap((prev) => ({
                                ...prev,
                                [rec.id]: e.target.value as 'png' | 'jpeg',
                              }))
                            }
                            aria-label="Image download format"
                            className="bg-transparent text-[10px] text-gray-300 px-1.5 py-1 focus:outline-none cursor-pointer"
                          >
                            <option value="png" className="bg-[#14172B]">PNG</option>
                            <option value="jpeg" className="bg-[#14172B]">JPG</option>
                          </select>
                          <button
                            onClick={() =>
                              downloadGeneratedImage(
                                primaryImg.dataUrl,
                                rec.prompt.slice(0, 28),
                                fmt
                              )
                            }
                            title="Download image"
                            className="px-2 py-1 text-[11px] font-semibold text-purple-200 hover:bg-purple-600/30 flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          onRegenerateFromRecord(rec);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>

                    <button
                      onClick={() => onDeleteRecord(rec.id)}
                      title="Delete from history"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
