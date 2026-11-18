import {
  Conversation,
  Message,
  StoredDocument,
  KnowledgeNote,
  KnowledgeFolder,
  AppSettings,
  SupportedLanguage,
  GeneratedImageRecord,
  SupportTicket,
  AdminActivityLog,
} from '../types';

const DB_NAME = 'OfflineGPT_DB';
const DB_VERSION = 3;

export class LocalDatabase {
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        // Fallback or SSR
        this.isInitialized = true;
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
        }

        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id' });
          store.createIndex('folderId', 'folderId', { unique: false });
        }

        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('learning_progress')) {
          db.createObjectStore('learning_progress', { keyPath: 'lessonId' });
        }

        if (!db.objectStoreNames.contains('image_history')) {
          const imgStore = db.createObjectStore('image_history', { keyPath: 'id' });
          imgStore.createIndex('userId', 'userId', { unique: false });
          imgStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('support_tickets')) {
          const ticketStore = db.createObjectStore('support_tickets', { keyPath: 'id' });
          ticketStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('activity_logs')) {
          const logStore = db.createObjectStore('activity_logs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isInitialized = true;
        this.seedInitialDataIfEmpty().then(() => resolve());
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event);
        // Fallback gracefully
        this.isInitialized = true;
        resolve();
      };
    });
  }

  private async seedInitialDataIfEmpty() {
    const convs = await this.getConversations();
    if (convs.length === 0) {
      // Seed default initial chat matching the screenshot!
      const initialConvId = 'conv-initial-pakistan-economy';
      const initialConv: Conversation = {
        id: initialConvId,
        title: 'Pakistan Economy Report',
        createdAt: '2026-11-10T14:10:00Z',
        updatedAt: '2026-11-10T14:15:00Z',
        modelName: 'Gemma 2 (2B Local)',
        language: 'roman_ur',
        messagesCount: 2,
        tags: ['Economy', 'Report', 'Urdu'],
      };
      await this.saveConversation(initialConv);

      const msgUser: Message = {
        id: 'msg-seed-1',
        conversationId: initialConvId,
        role: 'user',
        content: 'Mujhe Pakistan ki economy per complete report do.',
        timestamp: '02:15 PM',
        modelUsed: 'Gemma 2 (2B Local)',
      };

      const msgAssistant: Message = {
        id: 'msg-seed-2',
        conversationId: initialConvId,
        role: 'assistant',
        content: `Pakistan ki economy per complete report yeh rahi:

📊 **Key Points:**
1. **GDP Growth:** 2.5% – 3.0% (2025 estimate)
2. **Major Sectors:** Agriculture, Industry, Services
3. **Challenges:** Mehngai, berozgaari, external debt
4. **Opportunities:** IT, Agriculture, Renewable Energy

Aap chahein to is report ka **PDF** bhi bana sakta hoon.`,
        timestamp: '02:15 PM',
        modelUsed: 'Gemma 2 (2B Local)',
        suggestedActions: ['Download Report', 'Summary', 'More Details'],
      };

      await this.saveMessage(msgUser);
      await this.saveMessage(msgAssistant);

      // Seed initial sample document
      const sampleDoc: StoredDocument = {
        id: 'doc-seed-1',
        name: 'Tech Trends 2026.pdf',
        size: 2457600, // 2.4 MB
        type: 'application/pdf',
        uploadedAt: new Date().toISOString(),
        pageCount: 14,
        summary: 'Overview of artificial intelligence, localized on-device LLMs, edge computing, automation, and smart cities for 2026.',
        content: `Technology Trends in 2026

Key Highlights:
- AI everywhere: Autonomous local inference without cloud dependencies.
- More automation: Edge devices powering robotic workflows and real-time vision.
- Smart cities: Decentralized energy grids and privacy-preserving citizen analytics.
- Privacy-first architectures: Users retaining their weights and vector embeddings on-device.`,
        chunks: [
          {
            id: 'chk-1',
            documentId: 'doc-seed-1',
            pageNumber: 1,
            text: 'AI everywhere: Autonomous local inference without cloud dependencies. Edge computing has grown 300% since 2024.',
            keywords: ['ai', 'inference', 'edge', 'local'],
          },
          {
            id: 'chk-2',
            documentId: 'doc-seed-1',
            pageNumber: 2,
            text: 'Privacy-first architectures: Users retaining their weights and vector embeddings on-device, preventing cloud leaks.',
            keywords: ['privacy', 'weights', 'embeddings', 'security'],
          },
        ],
      };
      await this.saveDocument(sampleDoc);

      // Seed initial folder and notes
      await this.saveFolder({
        id: 'fld-1',
        name: 'AI & Research',
        color: '#7547FF',
        createdAt: new Date().toISOString(),
      });
      await this.saveFolder({
        id: 'fld-2',
        name: 'Study Notes',
        color: '#10B981',
        createdAt: new Date().toISOString(),
      });

      await this.saveNote({
        id: 'note-1',
        title: 'Local AI Deployment Checklist',
        content: `1. Ensure Ollama is running or local WebLLM cache is warm.\n2. Quantization: Q4_K_M is ideal for 8GB RAM.\n3. Gemma 2 2B requires ~1.6 GB VRAM.\n4. Always verify zero data egress for maximum privacy.`,
        folderId: 'fld-1',
        tags: ['Ollama', 'LocalAI', 'Hardware'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBookmarked: true,
      });
    }
  }

  // Generic helpers
  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore | null {
    if (!this.db) return null;
    try {
      const tx = this.db.transaction(storeName, mode);
      return tx.objectStore(storeName);
    } catch (err) {
      console.warn(`Error getting store ${storeName}:`, err);
      return null;
    }
  }

  // Conversations
  public async getConversations(): Promise<Conversation[]> {
    return new Promise((resolve) => {
      const store = this.getStore('conversations');
      if (!store) {
        resolve([]);
        return;
      }
      const request = store.getAll();
      request.onsuccess = () => {
        const result = request.result as Conversation[];
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(result);
      };
      request.onerror = () => resolve([]);
    });
  }

  public async saveConversation(conv: Conversation): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('conversations', 'readwrite');
      if (!store) return resolve();
      const req = store.put(conv);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteConversation(id: string): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('conversations', 'readwrite');
      if (!store) return resolve();
      store.delete(id);
      // Also delete its messages
      this.deleteMessagesByConversation(id).then(resolve);
    });
  }

  // Messages
  public async getMessages(conversationId: string): Promise<Message[]> {
    return new Promise((resolve) => {
      const store = this.getStore('messages');
      if (!store) return resolve([]);
      const index = store.index('conversationId');
      const req = index.getAll(conversationId);
      req.onsuccess = () => resolve(req.result as Message[]);
      req.onerror = () => resolve([]);
    });
  }

  public async saveMessage(msg: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('messages', 'readwrite');
      if (!store) return resolve();
      const req = store.put(msg);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteMessagesByConversation(conversationId: string): Promise<void> {
    const msgs = await this.getMessages(conversationId);
    const store = this.getStore('messages', 'readwrite');
    if (!store) return;
    for (const m of msgs) {
      store.delete(m.id);
    }
  }

  // Documents
  public async getDocuments(): Promise<StoredDocument[]> {
    return new Promise((resolve) => {
      const store = this.getStore('documents');
      if (!store) return resolve([]);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as StoredDocument[]);
      req.onerror = () => resolve([]);
    });
  }

  public async saveDocument(doc: StoredDocument): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('documents', 'readwrite');
      if (!store) return resolve();
      const req = store.put(doc);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteDocument(id: string): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('documents', 'readwrite');
      if (!store) return resolve();
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  // Notes & Folders
  public async getNotes(): Promise<KnowledgeNote[]> {
    return new Promise((resolve) => {
      const store = this.getStore('notes');
      if (!store) return resolve([]);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as KnowledgeNote[]);
      req.onerror = () => resolve([]);
    });
  }

  public async saveNote(note: KnowledgeNote): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('notes', 'readwrite');
      if (!store) return resolve();
      const req = store.put(note);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteNote(id: string): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('notes', 'readwrite');
      if (!store) return resolve();
      store.delete(id);
      resolve();
    });
  }

  public async getFolders(): Promise<KnowledgeFolder[]> {
    return new Promise((resolve) => {
      const store = this.getStore('folders');
      if (!store) return resolve([]);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as KnowledgeFolder[]);
      req.onerror = () => resolve([]);
    });
  }

  public async saveFolder(folder: KnowledgeFolder): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('folders', 'readwrite');
      if (!store) return resolve();
      const req = store.put(folder);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Settings
  public async getSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      language: 'ur',
      theme: 'dark',
      defaultModel: 'gemma:2b',
      ollamaHost: 'http://localhost:11434',
      temperature: 0.7,
      contextWindow: 4096,
      speechSpeed: 1.0,
      ttsVoice: 'default',
      offlineStrict: true,
      autoSaveHistory: true,
      enableSoundEffects: true,
    };

    return new Promise((resolve) => {
      const store = this.getStore('settings');
      if (!store) return resolve(defaultSettings);
      const req = store.get('app_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve({ ...defaultSettings, ...req.result.value });
        } else {
          resolve(defaultSettings);
        }
      };
      req.onerror = () => resolve(defaultSettings);
    });
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('settings', 'readwrite');
      if (!store) return resolve();
      const req = store.put({ key: 'app_settings', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Learning Progress
  public async getLessonProgress(): Promise<Record<string, boolean>> {
    return new Promise((resolve) => {
      const store = this.getStore('learning_progress');
      if (!store) return resolve({});
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result as { lessonId: string; completed: boolean }[]) || [];
        const map: Record<string, boolean> = {};
        for (const r of records) {
          map[r.lessonId] = r.completed;
        }
        resolve(map);
      };
      req.onerror = () => resolve({});
    });
  }

  public async setLessonProgress(lessonId: string, completed: boolean): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('learning_progress', 'readwrite');
      if (!store) return resolve();
      store.put({ lessonId, completed, updatedAt: new Date().toISOString() });
      resolve();
    });
  }

  // Image History (User-Scoped)
  public async getImageHistory(userId: string): Promise<GeneratedImageRecord[]> {
    return new Promise((resolve) => {
      if (!userId) return resolve([]);
      const store = this.getStore('image_history');
      if (!store) return resolve([]);
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const records = (req.result as GeneratedImageRecord[]) || [];
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(records);
      };
      req.onerror = () => resolve([]);
    });
  }

  public async saveImageRecord(record: GeneratedImageRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('image_history', 'readwrite');
      if (!store) return resolve();
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteImageRecord(id: string, userId: string): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('image_history', 'readwrite');
      if (!store) return resolve();
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as GeneratedImageRecord | undefined;
        if (record && record.userId === userId) {
          const delReq = store.delete(id);
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        } else {
          resolve();
        }
      };
      getReq.onerror = () => resolve();
    });
  }

  // Admin Helpers across all users & stores
  public async getAllImageHistory(): Promise<GeneratedImageRecord[]> {
    return new Promise((resolve) => {
      const store = this.getStore('image_history');
      if (!store) return resolve([]);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result as GeneratedImageRecord[]) || [];
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(records);
      };
      req.onerror = () => resolve([]);
    });
  }

  public async adminDeleteImageRecord(id: string): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('image_history', 'readwrite');
      if (!store) return resolve();
      const delReq = store.delete(id);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => resolve();
    });
  }

  public async getAllMessages(): Promise<Message[]> {
    return new Promise((resolve) => {
      const store = this.getStore('messages');
      if (!store) return resolve([]);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as Message[]) || []);
      req.onerror = () => resolve([]);
    });
  }

  // Support Tickets
  public async getSupportTickets(): Promise<SupportTicket[]> {
    return new Promise((resolve) => {
      const store = this.getStore('support_tickets');
      if (!store) return resolve([]);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as SupportTicket[]) || [];
        rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    });
  }

  public async saveSupportTicket(ticket: SupportTicket): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('support_tickets', 'readwrite');
      if (!store) return resolve();
      const req = store.put(ticket);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteSupportTicket(id: string): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('support_tickets', 'readwrite');
      if (!store) return resolve();
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  // Client Activity Logs
  public async getActivityLogs(): Promise<AdminActivityLog[]> {
    return new Promise((resolve) => {
      const store = this.getStore('activity_logs');
      if (!store) return resolve([]);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as AdminActivityLog[]) || [];
        rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    });
  }

  public async addActivityLog(entry: Omit<AdminActivityLog, 'id' | 'timestamp'>): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('activity_logs', 'readwrite');
      if (!store) return resolve();
      const log: AdminActivityLog = {
        ...entry,
        id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        source: 'client',
      };
      const req = store.put(log);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  public async clearActivityLogs(): Promise<void> {
    return new Promise((resolve) => {
      const store = this.getStore('activity_logs', 'readwrite');
      if (!store) return resolve();
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  // Export full SQLite/JSON backup
  public async exportFullBackup(): Promise<string> {
    const convs = await this.getConversations();
    const allMsgs: Message[] = [];
    for (const c of convs) {
      const msgs = await this.getMessages(c.id);
      allMsgs.push(...msgs);
    }
    const docs = await this.getDocuments();
    const notes = await this.getNotes();
    const folders = await this.getFolders();
    const settings = await this.getSettings();
    const progress = await this.getLessonProgress();

    const backup = {
      app: 'OfflineGPT',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        conversations: convs,
        messages: allMsgs,
        documents: docs,
        notes,
        folders,
        settings,
        progress,
      },
    };
    return JSON.stringify(backup, null, 2);
  }

  public async clearAllData(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      const storeNames = [
        'conversations',
        'messages',
        'documents',
        'notes',
        'folders',
        'settings',
        'learning_progress',
        'image_history',
        'support_tickets',
        'activity_logs',
      ].filter((name) => this.db!.objectStoreNames.contains(name));
      const tx = this.db.transaction(storeNames, 'readwrite');
      for (const name of storeNames) {
        tx.objectStore(name).clear();
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
}

export const db = new LocalDatabase();
