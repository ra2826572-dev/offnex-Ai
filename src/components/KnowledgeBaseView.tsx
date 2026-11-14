'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Folder, 
  Plus, 
  FileText, 
  Trash2, 
  Search, 
  Bookmark, 
  Sparkles, 
  Download, 
  Tag, 
  FolderPlus,
  Save,
  Check
} from 'lucide-react';
import { KnowledgeNote, KnowledgeFolder } from '../types';

interface KnowledgeBaseViewProps {
  notes: KnowledgeNote[];
  folders: KnowledgeFolder[];
  onSaveNote: (note: KnowledgeNote) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onSaveFolder: (folder: KnowledgeFolder) => Promise<void>;
  onAskKnowledgeBase: (query: string) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  notes,
  folders,
  onSaveNote,
  onDeleteNote,
  onSaveFolder,
  onAskKnowledgeBase,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);

  // Active note editor state
  const activeNote = notes.find(n => n.id === selectedNoteId) || notes[0];
  const [editTitle, setEditTitle] = useState(activeNote?.title || '');
  const [editContent, setEditContent] = useState(activeNote?.content || '');
  const [editTags, setEditTags] = useState(activeNote?.tags.join(', ') || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // When selected note changes, sync edit fields
  const handleSelectNote = (note: KnowledgeNote) => {
    setSelectedNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags.join(', '));
  };

  const handleCreateNewNote = async () => {
    const newNote: KnowledgeNote = {
      id: 'note-' + Date.now(),
      title: 'Untitled Note',
      content: 'Write your local private thoughts, summaries, and code snippets here...',
      folderId: selectedFolderId || undefined,
      tags: ['General'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBookmarked: false,
    };
    await onSaveNote(newNote);
    handleSelectNote(newNote);
  };

  const handleSaveActiveNote = async () => {
    if (!activeNote) return;
    const updated: KnowledgeNote = {
      ...activeNote,
      title: editTitle.trim() || 'Untitled Note',
      content: editContent,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
      updatedAt: new Date().toISOString(),
    };
    await onSaveNote(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const newFld: KnowledgeFolder = {
      id: 'fld-' + Date.now(),
      name: newFolderName.trim(),
      color: '#7547FF',
      createdAt: new Date().toISOString(),
    };
    await onSaveFolder(newFld);
    setNewFolderName('');
    setShowFolderInput(false);
  };

  const filteredNotes = notes.filter(n => {
    const matchesFolder = selectedFolderId ? n.folderId === selectedFolderId : true;
    const matchesSearch = searchQuery
      ? n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="flex-1 flex h-full bg-[#0B0D18] overflow-hidden">
      {/* 1. Folders Column */}
      <div className="w-56 border-r border-[#1F243D] bg-[#101324] flex flex-col h-full shrink-0">
        <div className="p-3 border-b border-[#1F243D] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Box className="w-4 h-4 text-purple-400" />
            <span>Folders</span>
          </div>
          <button
            onClick={() => setShowFolderInput(!showFolderInput)}
            title="Add Folder"
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1A1F38] transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {showFolderInput && (
          <div className="p-2 border-b border-[#1F243D] flex gap-1">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full bg-[#161B30] text-xs text-white px-2 py-1 rounded border border-[#252B4D] focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <button
              onClick={handleCreateFolder}
              className="px-2 py-1 bg-purple-600 text-white rounded text-xs"
            >
              Add
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer ${
              selectedFolderId === null
                ? 'bg-purple-600 text-white font-semibold'
                : 'text-gray-300 hover:bg-[#161A30]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5" />
              <span>All Notes</span>
            </div>
            <span className="text-[10px] opacity-70">{notes.length}</span>
          </button>

          {folders.map((f) => {
            const isSelected = selectedFolderId === f.id;
            const count = notes.filter(n => n.folderId === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFolderId(f.id)}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-gray-300 hover:bg-[#161A30]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Folder className="w-3.5 h-3.5 text-purple-400" />
                  <span className="truncate">{f.name}</span>
                </div>
                <span className="text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Notes List Column */}
      <div className="w-64 border-r border-[#1F243D] bg-[#12162B] flex flex-col h-full shrink-0">
        <div className="p-3 border-b border-[#1F243D] space-y-2">
          <button
            onClick={handleCreateNewNote}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-[#181D33] text-gray-200 text-xs rounded-lg pl-8 pr-2.5 py-1.5 border border-[#252B4D] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredNotes.map((note) => {
            const isSelected = note.id === activeNote?.id;
            return (
              <div
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`p-2.5 rounded-xl cursor-pointer text-xs transition-all border ${
                  isSelected
                    ? 'bg-[#1D2342] border-purple-500 text-white shadow-md'
                    : 'bg-[#151930] border-[#222846] text-gray-300 hover:bg-[#1A203C]'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="font-semibold truncate">{note.title}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(note.id);
                    }}
                    title="Delete Note"
                    className="text-gray-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 font-sans">
                  {note.content}
                </p>
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {note.tags.map((t, idx) => (
                    <span key={idx} className="text-[9px] bg-[#222846] text-purple-300 px-1.5 py-0.5 rounded">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Note Editor Column */}
      {activeNote ? (
        <div className="flex-1 flex flex-col h-full bg-[#0B0D18] overflow-hidden">
          {/* Note Editor Header */}
          <div className="p-3 border-b border-[#1F243D] bg-[#0E1020]/90 flex items-center justify-between shrink-0">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-base font-bold text-white bg-transparent focus:outline-none flex-1 mr-4 border-b border-transparent focus:border-purple-500"
              placeholder="Note Title"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveActiveNote}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tags bar */}
          <div className="px-4 py-2 border-b border-[#1F243D] flex items-center gap-2 text-xs bg-[#12162B]">
            <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="Comma-separated tags (e.g. AI, Research, Economy)"
              className="w-full bg-transparent text-gray-300 focus:outline-none text-xs"
            />
          </div>

          {/* Editor Body */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full bg-transparent text-sm text-gray-200 leading-relaxed resize-none focus:outline-none font-sans"
              placeholder="Write your note or paste documents here..."
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-400">
          <p className="text-sm">Select or create a note to begin.</p>
        </div>
      )}
    </div>
  );
};
