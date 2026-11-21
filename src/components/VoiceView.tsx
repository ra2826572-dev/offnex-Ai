'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Sparkles,
  Languages,
  ShieldCheck,
  Radio,
  Send,
} from 'lucide-react';
import { SupportedLanguage } from '../types';
import { speechService } from '../services/speechService';

interface VoiceViewProps {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  onSendVoiceQuery: (text: string) => Promise<string>;
}

const QUICK_VOICE_PROMPTS = [
  'Pakistan ki economy per report do',
  'Summarize how AI works',
  'Tell me today date and time',
  '15% of 2500',
];

export const VoiceView: React.FC<VoiceViewProps> = ({
  language,
  setLanguage,
  onSendVoiceQuery,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [assistantReply, setAssistantReply] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 24, 40, 60, 30, 16, 45, 55, 20, 35, 50, 15]);

  useEffect(() => {
    speechService.setLanguage(language);
  }, [language]);

  const handleToggleRecord = async () => {
    if (isRecording) {
      speechService.stopListening();
      setIsRecording(false);
      if (transcript.trim()) {
        processVoiceText(transcript.trim());
      }
    } else {
      setVoiceNotice(null);
      setTranscript('');
      setAssistantReply('');
      setIsRecording(true);

      const started = await speechService.startListening(
        (recognizedText, isFinal) => {
          setTranscript(recognizedText);
          if (isFinal) {
            speechService.stopListening();
            setIsRecording(false);
            processVoiceText(recognizedText);
          }
        },
        (waveData) => {
          const bars: number[] = [];
          const step = Math.floor(waveData.length / 12) || 1;
          for (let i = 0; i < 12; i++) {
            const val = waveData[i * step] || 10;
            bars.push(Math.max(8, Math.min(64, Math.floor((val / 255) * 64))));
          }
          setWaveHeights(bars);
        },
        (err) => {
          console.warn('Voice error:', err);
          setIsRecording(false);
          if (String(err).toLowerCase().includes('network')) {
            setVoiceNotice(
              'Browser mic STT needs internet or offline voice pack — type or tap any prompt below and Offnex Ai will answer with voice playback offline!'
            );
          } else {
            setVoiceNotice(
              'Microphone unavailable right now. Type or tap a quick prompt below for offline voice reply.'
            );
          }
        }
      );

      if (!started) {
        setIsRecording(false);
        setVoiceNotice('Could not access microphone. You can still type or tap a quick prompt below.');
      }
    }
  };

  const processVoiceText = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    setVoiceNotice(null);
    setTranscript(text.trim());
    setIsProcessing(true);
    try {
      const response = await onSendVoiceQuery(text.trim());
      setAssistantReply(response);
      speakText(response);
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text: string) => {
    setIsPlayingAudio(true);
    speechService.speak(text, {
      rate: speechRate,
      lang: language === 'ur' || language === 'roman_ur' ? 'ur-PK' : 'en-US',
      onEnd: () => setIsPlayingAudio(false),
    });
  };

  const handleStopAudio = () => {
    speechService.stopSpeaking();
    setIsPlayingAudio(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim() || isProcessing) return;
    const q = manualQuery.trim();
    setManualQuery('');
    await processVoiceText(q);
  };

  return (
    <div className="flex-1 w-full h-full bg-[#0B0D18] overflow-y-auto">
      <div className="min-h-full w-full max-w-2xl mx-auto flex flex-col items-center justify-between p-4 sm:p-6 gap-5">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className={`w-4 h-4 shrink-0 ${isRecording ? 'text-rose-400 animate-pulse' : 'text-purple-400'}`} />
            <h2 className="text-sm sm:text-base font-bold text-white truncate">Voice Assistant</h2>
          </div>

          {/* Language selector */}
          <div className="flex items-center gap-1.5 bg-[#14182E] border border-[#232948] rounded-xl px-2.5 py-1.5 text-xs shrink-0">
            <Languages className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              aria-label="Select Voice Language"
              className="bg-transparent text-gray-200 focus:outline-none cursor-pointer"
            >
              <option value="en" className="bg-[#14182E]">English</option>
              <option value="ur" className="bg-[#14182E]">Urdu (اردو)</option>
              <option value="roman_ur" className="bg-[#14182E]">Roman Urdu</option>
              <option value="ar" className="bg-[#14182E]">Arabic</option>
            </select>
          </div>
        </div>

        {/* Center Interactive Microphone */}
        <div className="w-full flex flex-col items-center justify-center my-auto space-y-4 sm:space-y-5 text-center py-2">
          {/* Pulsing circular mic button */}
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-purple-500/20 transition-all duration-700 ${
                isRecording ? 'scale-125 border-rose-500/50 animate-ping' : ''
              }`}
            />
            <div
              className={`absolute w-30 h-30 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 blur-md ${
                isRecording ? 'bg-rose-600/30' : ''
              }`}
            />

            <button
              type="button"
              onClick={handleToggleRecord}
              title={isRecording ? 'Stop Recording' : 'Start Speaking'}
              className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-2xl transition-all transform active:scale-95 cursor-pointer z-10 ${
                isRecording
                  ? 'bg-gradient-to-tr from-rose-600 to-red-500 shadow-rose-600/40 glow-purple ring-4 ring-rose-400/30'
                  : 'bg-gradient-to-tr from-[#4435D5] to-[#7547FF] shadow-purple-600/40 glow-purple hover:scale-105'
              }`}
            >
              {isRecording ? (
                <MicOff className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-bounce" />
              ) : (
                <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              )}
            </button>
          </div>

          {/* Labels */}
          <div className="space-y-1 px-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-white">
              {isRecording ? 'Listening to your voice...' : 'Tap to Speak or Type'}
            </h3>
            <p className="text-xs text-gray-400">
              Ask anything... (English / Urdu / Roman Urdu • Offline TTS Ready)
            </p>
          </div>

          {/* Dynamic Waveform Bars */}
          <div className="flex items-center justify-center gap-1.5 h-12 sm:h-14 w-full max-w-[260px] px-4 bg-[#121528] rounded-2xl border border-purple-500/20">
            {waveHeights.map((h, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  isRecording
                    ? 'bg-gradient-to-t from-rose-500 to-purple-400'
                    : 'bg-gradient-to-t from-purple-600 to-indigo-400'
                }`}
                style={{ height: `${isRecording ? h : 10 + Math.sin(i) * 6}px` }}
              />
            ))}
          </div>

          {voiceNotice && (
            <div className="w-full max-w-lg px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 text-left">
              {voiceNotice}
            </div>
          )}

          {/* Offline Voice Input Bar + Quick Voice Commands */}
          <form onSubmit={handleManualSubmit} className="w-full max-w-lg flex items-center gap-2">
            <input
              type="text"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Ask via text & hear spoken answer offline..."
              className="flex-1 bg-[#14182E] border border-[#262D50] focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-400 focus:outline-none min-w-0"
            />
            <button
              type="submit"
              disabled={!manualQuery.trim() || isProcessing}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#4435D5] to-[#7547FF] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask & Speak</span>
            </button>
          </form>

          <div className="w-full max-w-lg flex flex-wrap items-center justify-center gap-1.5">
            {QUICK_VOICE_PROMPTS.map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => processVoiceText(qp)}
                disabled={isProcessing}
                className="px-2.5 py-1 rounded-full bg-[#14182E] hover:bg-[#1E2444] border border-[#262D50] text-[11px] text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Transcript Box */}
          {(transcript || isProcessing) && (
            <div className="w-full max-w-lg p-3.5 rounded-xl bg-[#14182E] border border-purple-500/30 text-xs text-left space-y-1">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                {isRecording ? 'Recognizing...' : 'Your Voice Query:'}
              </span>
              <p className="text-white font-medium text-sm break-words">
                &ldquo;{transcript || 'Processing speech...'}&rdquo;
              </p>
            </div>
          )}

          {/* Assistant Spoken Response */}
          {assistantReply && (
            <div className="w-full max-w-lg p-3.5 sm:p-4 rounded-xl bg-[#161B33] border border-[#262D50] text-xs text-left space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>Spoken Local Response:</span>
                </span>
                <button
                  type="button"
                  onClick={() => (isPlayingAudio ? handleStopAudio() : speakText(assistantReply))}
                  className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-white px-2 py-1 rounded-lg bg-[#1F2545] cursor-pointer shrink-0"
                >
                  {isPlayingAudio ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Stop Voice</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Replay</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-gray-200 text-xs leading-relaxed max-h-40 overflow-y-auto whitespace-pre-line">
                {assistantReply}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Privacy & Controls */}
        <div className="w-full pt-3 sm:pt-4 border-t border-[#1F243D] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 text-center sm:text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Microphone audio stays private on your device</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span>Speed:</span>
            {[0.75, 1.0, 1.25].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setSpeechRate(rate)}
                className={`min-w-[38px] min-h-[28px] px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                  speechRate === rate ? 'bg-purple-600 text-white' : 'bg-[#181D35] text-gray-300 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
