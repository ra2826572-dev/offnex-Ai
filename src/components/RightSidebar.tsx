'use client';

import React from 'react';
import { 
  FileText, 
  Mic, 
  Languages, 
  GraduationCap, 
  Lightbulb, 
  AlignLeft, 
  ArrowRight, 
  HardDrive, 
  Laptop, 
  Sparkles,
  Zap
} from 'lucide-react';
import { NavigationTab } from '../types';

interface RightSidebarProps {
  setActiveTab: (tab: NavigationTab) => void;
  onQuickToolClick: (toolName: string) => void;
  storageUsageMb?: number;
  totalDocsCount?: number;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  setActiveTab,
  onQuickToolClick,
  storageUsageMb = 4.2,
  totalDocsCount = 1,
}) => {
  const tools = [
    {
      id: 'pdf-reader',
      name: 'PDF\nReader',
      icon: FileText,
      gradient: 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600',
      shadow: 'shadow-blue-500/20',
      action: () => onQuickToolClick('pdf-reader'),
    },
    {
      id: 'voice-assistant',
      name: 'Voice\nAssistant',
      icon: Mic,
      gradient: 'from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600',
      shadow: 'shadow-emerald-500/20',
      action: () => setActiveTab('voice'),
    },
    {
      id: 'translator',
      name: 'Translator',
      icon: Languages,
      gradient: 'from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600',
      shadow: 'shadow-purple-500/20',
      action: () => onQuickToolClick('translator'),
    },
    {
      id: 'ai-tutor',
      name: 'AI Tutor',
      icon: GraduationCap,
      gradient: 'from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600',
      shadow: 'shadow-amber-500/20',
      action: () => onQuickToolClick('ai-tutor'),
    },
    {
      id: 'study-helper',
      name: 'Study\nHelper',
      icon: Lightbulb,
      gradient: 'from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600',
      shadow: 'shadow-teal-500/20',
      action: () => onQuickToolClick('study-helper'),
    },
    {
      id: 'summarizer',
      name: 'Summarizer',
      icon: AlignLeft,
      gradient: 'from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600',
      shadow: 'shadow-rose-500/20',
      action: () => onQuickToolClick('summarizer'),
    },
  ];

  return (
    <aside className="w-72 bg-[#111426] border-l border-[#1F243D] flex flex-col justify-between p-4 h-full shrink-0 select-none overflow-y-auto">
      <div className="space-y-5 shrink-0">
        {/* Quick Tools Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">Quick Tools</h2>
          </div>
          <button
            onClick={() => setActiveTab('chat')}
            className="text-xs text-gray-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
          >
            <span>See All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* 2x3 Grid matching Screenshot */}
        <div className="grid grid-cols-2 gap-2.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={tool.action}
                className={`relative flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b ${tool.gradient} text-white shadow-md ${tool.shadow} transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-center whitespace-pre-line leading-tight">
                  {tool.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Did You Know? Card matching Screenshot */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#181D35] to-[#12162B] border border-purple-500/20 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 rounded-full blur-xl pointer-events-none"></div>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-xs font-bold text-white tracking-wide">Did You Know?</h3>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed mb-3">
            Offnex Ai can work on <span className="text-cyan-300 font-semibold">low-end devices</span> too!
          </p>

          {/* Futuristic Laptop Illustration */}
          <div className="relative w-full h-24 rounded-xl bg-[#0C0E1C] border border-[#232847] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/30 to-transparent"></div>
            
            {/* Laptop graphic */}
            <div className="relative flex flex-col items-center">
              {/* Screen */}
              <div className="w-24 h-16 rounded-t-md bg-[#161A30] border border-cyan-500/40 p-1 flex items-center justify-center shadow-inner relative overflow-hidden">
                {/* Glowing Offnex Ai Logo on screen */}
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                  <img
                    src="/assets/offnex_icon_square.png"
                    alt="Offnex Ai"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              {/* Base */}
              <div className="w-32 h-1.5 bg-[#2B3054] rounded-b-sm border-t border-purple-400/30 shadow-md"></div>
              <div className="w-12 h-1 bg-[#1A1D33] rounded-b-sm mx-auto"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Local Storage & Device Status */}
      <div className="mt-4 pt-4 border-t border-[#1F243D]/60 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            <span>Local Storage</span>
          </span>
          <span className="text-gray-300 font-medium">{storageUsageMb} MB / 1 GB</span>
        </div>
        <div className="w-full bg-[#181D35] h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full"
            style={{ width: `${Math.min(100, (storageUsageMb / 1024) * 100 + 4)}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center text-[10px] text-gray-400 pt-0.5">
          <span>{totalDocsCount} Document(s) Indexed</span>
          <span className="text-emerald-400 font-medium">100% Private</span>
        </div>
      </div>
    </aside>
  );
};
