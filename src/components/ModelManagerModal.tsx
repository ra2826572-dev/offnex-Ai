'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Download, 
  Check, 
  Trash2, 
  Sparkles, 
  AlertTriangle, 
  RotateCw, 
  Server, 
  X, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { LocalAIModel, SystemHardwareInfo } from '../types';
import { SUPPORTED_LOCAL_MODELS, aiEngine } from '../services/aiEngine';

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: string;
  onSelectModel: (modelTag: string) => void;
  models: LocalAIModel[];
  onUpdateModels: (updated: LocalAIModel[]) => void;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
  activeModel,
  onSelectModel,
  models,
  onUpdateModels,
}) => {
  const [hardware, setHardware] = useState<SystemHardwareInfo | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; version?: string }>({
    connected: false,
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      aiEngine.fetchHardwareInfo().then(setHardware);
      aiEngine.checkOllamaStatus().then(setOllamaStatus);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadModel = (model: LocalAIModel) => {
    setDownloadingId(model.id);
    setDownloadProgress(0);

    // Simulate steady download progress bar
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadingId(null);
          // Mark model as installed
          const updated = models.map((m) =>
            m.id === model.id ? { ...m, isInstalled: true, status: 'ready' as const } : m
          );
          onUpdateModels(updated);
          return 100;
        }
        return prev + 15;
      });
    }, 400);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await aiEngine.generateResponse('Hello, are you operational on-device?');
      setTestResult(`Success! Model responded: "${res.text.slice(0, 80)}..."`);
    } catch {
      setTestResult('Connection failed. Verify local engine or Ollama daemon.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111426] border border-purple-500/30 rounded-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#1F243D] flex items-center justify-between gap-2 bg-[#14182E]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">Google Gemini AI Model Manager</h2>
              <p className="text-[11px] text-gray-400 truncate">
                Google Gemini cloud model configured and active
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-[#1E2342] transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Hardware & Ollama Status Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Ollama Status */}
            <div className="p-3.5 rounded-xl bg-[#151930] border border-[#232948] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Server className={`w-5 h-5 ${ollamaStatus.connected ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <div className="text-xs font-semibold text-white">
                    {ollamaStatus.connected ? 'Ollama Daemon Active' : 'Embedded Local Engine Active'}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {ollamaStatus.connected
                      ? `v${ollamaStatus.version} on localhost:11434`
                      : 'Zero-config offline reasoning engine ready'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-[#202544] hover:bg-[#2A3158] text-purple-300 border border-purple-500/20 cursor-pointer"
              >
                {isTesting ? 'Testing...' : 'Test Speed'}
              </button>
            </div>

            {/* Hardware Assessment */}
            <div className="p-3.5 rounded-xl bg-[#151930] border border-[#232948] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="text-xs font-semibold text-white">
                    RAM: {hardware?.totalMemGb || 8} GB Detected
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    Recommended: 2B - 3B models run flawlessly
                  </div>
                </div>
              </div>
              <span className="text-[10px] bg-purple-950/40 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                {hardware?.cpuCount || 8} CPU Cores
              </span>
            </div>
          </div>

          {testResult && (
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200">
              ⚡ {testResult}
            </div>
          )}

          {/* Model Selection List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Compatible Offline Models
            </h3>

            <div className="space-y-2.5">
              {models.map((model) => {
                const isActive = model.id === activeModel;
                const isDownloading = downloadingId === model.id;

                return (
                  <div
                    key={model.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-[#1C213D] border-purple-500 shadow-lg shadow-purple-950/30'
                        : 'bg-[#14182E] border-[#222846] hover:bg-[#181D35]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{model.name}</h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#222744] text-purple-300">
                            {model.size}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {model.parameters} params • Min RAM: {model.minRamGb} GB
                          </span>
                          {isActive && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300">{model.description}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {model.isInstalled ? (
                          <button
                            onClick={() => onSelectModel(model.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-[#1F2545] hover:bg-[#2A3158] text-gray-200 hover:text-white border border-purple-500/20'
                            }`}
                          >
                            {isActive ? 'Current Model' : 'Select Model'}
                          </button>
                        ) : isDownloading ? (
                          <div className="w-28 text-center space-y-1">
                            <div className="w-full bg-[#181D35] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-purple-500 h-full rounded-full transition-all"
                                style={{ width: `${downloadProgress}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-purple-300">{downloadProgress}%</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDownloadModel(model)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Install Model</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Setup Guide for Ollama */}
          <div className="p-4 rounded-xl bg-[#0F1224] border border-[#1F243D] text-xs text-gray-400 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>How Local AI Execution Works:</span>
            </div>
            <p>
              Offnex Ai communicates directly with on-device models. If you have Ollama installed, run:
              <code className="text-purple-300 font-mono ml-1 bg-[#1A1F38] px-2 py-0.5 rounded">
                ollama run gemma2:2b
              </code>
            </p>
            <p>
              Offnex Ai also includes an embedded local reasoning engine that works without any installation or terminal commands!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1F243D] bg-[#14182E] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
