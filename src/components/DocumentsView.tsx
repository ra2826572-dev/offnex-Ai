'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  BookOpen, 
  Sparkles, 
  Search, 
  HelpCircle, 
  FileCheck, 
  Layers, 
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { StoredDocument } from '../types';
import { documentProcessor } from '../services/documentProcessor';

interface DocumentsViewProps {
  documents: StoredDocument[];
  onUploadFile: (file: File) => Promise<void>;
  onDeleteDocument: (id: string) => void;
  onAskAboutDocument: (doc: StoredDocument, question: string) => void;
  selectedDocId?: string | null;
  onSelectDocId?: (id: string) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  onUploadFile,
  onDeleteDocument,
  onAskAboutDocument,
  selectedDocId: controlledDocId,
  onSelectDocId,
}) => {
  const [internalSelectedDocId, setInternalSelectedDocId] = useState<string | null>(
    documents[0]?.id || null
  );

  const selectedDocId = controlledDocId !== undefined && controlledDocId !== null
    ? controlledDocId 
    : internalSelectedDocId;

  const setSelectedDocId = (id: string | null) => {
    setInternalSelectedDocId(id);
    if (onSelectDocId && id) onSelectDocId(id);
  };
  const [isUploading, setIsUploading] = useState(false);
  const [searchDocQuery, setSearchDocQuery] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [activeTab, setActiveTab] = useState<'read' | 'summary' | 'quiz' | 'ask'>('read');
  const [generatedQuiz, setGeneratedQuiz] = useState<any[] | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  const activeDoc = documents.find(d => d.id === selectedDocId) || documents[0];

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      await onUploadFile(file);
      // set new document active
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateQuiz = () => {
    if (!activeDoc) return;
    const quiz = documentProcessor.generateQuizFromText(activeDoc.content);
    setGeneratedQuiz(quiz);
    setQuizScore(null);
    setSelectedAnswers({});
    setActiveTab('quiz');
  };

  const handleAnswerSelect = (qIdx: number, optIdx: number) => {
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmitQuiz = () => {
    if (!generatedQuiz) return;
    let score = 0;
    generatedQuiz.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        score++;
      }
    });
    setQuizScore(score);
  };

  return (
    <div className="flex-1 flex h-full bg-[#0B0D18] overflow-hidden">
      {/* Left List of Documents */}
      <div className="w-80 border-r border-[#1F243D] bg-[#101324] flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-[#1F243D] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Offline Documents</span>
            </h2>
            <span className="text-[10px] text-gray-400">{documents.length} Files</span>
          </div>

          {/* Upload Drop Area */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 rounded-xl p-3 bg-[#151930] hover:bg-[#1A203D] cursor-pointer transition-all">
            <Upload className="w-5 h-5 text-purple-400 mb-1" />
            <span className="text-xs font-semibold text-white">Upload PDF or Text</span>
            <span className="text-[10px] text-gray-400">PDF, TXT, DOCX, MD (Processed 100% locally)</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.json,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>

        {/* Document Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {documents.map((doc) => {
            const isSelected = doc.id === activeDoc?.id;
            return (
              <div
                key={doc.id}
                onClick={() => {
                  setSelectedDocId(doc.id);
                  setGeneratedQuiz(null);
                  setActiveTab('read');
                }}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-[#1D2342] border-purple-500 shadow-md shadow-purple-950/40 text-white'
                    : 'bg-[#14182D] border-[#222846] text-gray-300 hover:bg-[#191E38]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate leading-tight">{doc.name}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {(doc.size / (1024 * 1024)).toFixed(1)} MB • {doc.pageCount} Pages
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(doc.id);
                    }}
                    title="Delete Document"
                    className="p-1 text-gray-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Document Workspace */}
      {activeDoc ? (
        <div className="flex-1 flex flex-col h-full bg-[#0B0D18] overflow-hidden">
          {/* Doc Header */}
          <div className="p-4 border-b border-[#1F243D] bg-[#0E1020]/90 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{activeDoc.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {activeDoc.chunks.length} Text Chunks
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Uploaded: {new Date(activeDoc.uploadedAt).toLocaleDateString()} • Zero Cloud Egress
              </p>
            </div>

            {/* Quick Action Navigation */}
            <div className="flex items-center gap-1.5 bg-[#14182E] p-1 rounded-xl border border-[#232948]">
              <button
                onClick={() => setActiveTab('read')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'read' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Read & Highlights
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'summary' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Summary
              </button>
              <button
                onClick={handleGenerateQuiz}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'quiz' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Quiz Generator
              </button>
              <button
                onClick={() => setActiveTab('ask')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'ask' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Ask Document (RAG)
              </button>
            </div>
          </div>

          {/* Doc Content Tabs */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'read' && (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Search within document */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchDocQuery}
                    onChange={(e) => setSearchDocQuery(e.target.value)}
                    placeholder="Search keywords within this document..."
                    className="w-full bg-[#14182E] text-sm text-gray-200 rounded-xl pl-9 pr-4 py-2 border border-[#232948] focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Text Chunks / Pages Viewer */}
                <div className="space-y-4">
                  {activeDoc.chunks
                    .filter(c =>
                      !searchDocQuery ||
                      c.text.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
                      c.keywords.some(k => k.toLowerCase().includes(searchDocQuery.toLowerCase()))
                    )
                    .map((chunk, idx) => (
                      <div
                        key={chunk.id}
                        className="p-4 rounded-xl bg-[#14182D] border border-[#222846] space-y-2 hover:border-purple-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs text-purple-400 font-semibold">
                          <span>Page {chunk.pageNumber} • Section {idx + 1}</span>
                          <span className="text-[10px] text-gray-400">{chunk.keywords.join(', ')}</span>
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed font-sans">{chunk.text}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'summary' && (
              <div className="max-w-3xl mx-auto space-y-5">
                <div className="p-5 rounded-2xl bg-[#151930] border border-purple-500/30 shadow-lg space-y-3">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Executive Document Summary (Generated on-device)</span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">{activeDoc.summary}</p>
                </div>

                <div className="p-5 rounded-2xl bg-[#13162B] border border-[#222846] space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Core Conceptual Highlights:
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-300 list-disc list-inside">
                    <li>Fully vectorized and partitioned into {activeDoc.chunks.length} distinct search contexts.</li>
                    <li>No document data leaves the local memory or browser sandboxed storage.</li>
                    <li>Supports real-time multilingual querying in Urdu, Roman Urdu, and English.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'quiz' && generatedQuiz && (
              <div className="max-w-3xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>Auto-Generated Knowledge Quiz</span>
                  </h3>
                  {quizScore !== null && (
                    <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                      Score: {quizScore} / {generatedQuiz.length} ({Math.round((quizScore / generatedQuiz.length) * 100)}%)
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {generatedQuiz.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 rounded-xl bg-[#14182D] border border-[#222846] space-y-3">
                      <p className="text-sm font-semibold text-white">
                        {qIdx + 1}. {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt: string, oIdx: number) => {
                          const isSelected = selectedAnswers[qIdx] === oIdx;
                          const isSubmitted = quizScore !== null;
                          const isCorrect = oIdx === q.correctIndex;

                          let btnStyle = 'bg-[#181D35] border-[#252B4D] text-gray-300 hover:bg-[#202646]';
                          if (isSelected) btnStyle = 'bg-purple-900/40 border-purple-500 text-white font-medium';
                          if (isSubmitted && isCorrect) btnStyle = 'bg-emerald-950/40 border-emerald-500 text-emerald-300';
                          if (isSubmitted && isSelected && !isCorrect) btnStyle = 'bg-rose-950/40 border-rose-500 text-rose-300';

                          return (
                            <button
                              key={oIdx}
                              onClick={() => !isSubmitted && handleAnswerSelect(qIdx, oIdx)}
                              className={`w-full text-left p-3 rounded-lg border text-xs transition-colors flex items-center justify-between ${btnStyle}`}
                            >
                              <span>{opt}</span>
                              {isSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {quizScore !== null && (
                        <p className="text-xs text-gray-400 bg-[#1A1F3A] p-2.5 rounded-lg border border-purple-500/20">
                          💡 <span className="font-semibold text-purple-300">Explanation:</span> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {quizScore === null ? (
                  <button
                    onClick={handleSubmitQuiz}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                  >
                    Submit Quiz Answers
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateQuiz}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                  >
                    Retake Quiz with New Questions
                  </button>
                )}
              </div>
            )}

            {activeTab === 'ask' && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                  ⚡ <strong>Local Retrieval Augmented Generation (RAG):</strong> Ask anything about{' '}
                  <span className="font-semibold text-white">{activeDoc.name}</span>. The local engine will retrieve relevant text chunks and cite page numbers.
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="e.g., What are the main projections or statistics mentioned?"
                    className="flex-1 bg-[#14182E] border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && questionInput.trim()) {
                        onAskAboutDocument(activeDoc, questionInput.trim());
                        setQuestionInput('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (questionInput.trim()) {
                        onAskAboutDocument(activeDoc, questionInput.trim());
                        setQuestionInput('');
                      }
                    }}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    Ask
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
          <FileText className="w-12 h-12 text-gray-600 mb-2" />
          <p className="text-sm font-semibold text-gray-300">No Document Selected</p>
          <p className="text-xs text-gray-400 mt-1">Upload a PDF or TXT to start local offline analysis.</p>
        </div>
      )}
    </div>
  );
};
