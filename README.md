# OfflineGPT — Your AI. Your Device. Your Freedom.

OfflineGPT is a private, multilingual, production-grade on-device AI assistant designed to run 100% locally on user hardware without relying on cloud servers or active internet connectivity.

---

## 🌟 Key Capabilities

1. **100% Local AI & Ollama Integration**
   - Connects to **Ollama** running locally on `localhost:11434` or uses the built-in embedded offline reasoning engine.
   - Compatible with Google Gemma 2 (2B / 9B), Qwen 2.5 (1.5B / 7B), Meta Llama 3.2 (3B), and Phi-3.5.
   - Model memory and hardware checker (detects RAM, CPU cores, AVX2).
   - Zero-cloud telemetry: Prompts and weights never leave the device.

2. **Multilingual Support (Urdu, Roman Urdu, English, Arabic, Hindi)**
   - Native Urdu typography and formatting (`Noto Nastaliq Urdu`).
   - Roman Urdu dialect understanding (e.g. *"Mujhe Pakistan ki economy per complete report do"*).
   - Instant language switching.

3. **Document AI & PDF Reader (Local RAG)**
   - Client-side PDF text extraction and chunking (300 words with 50-word overlap).
   - Local TF-IDF & vector similarity ranking for question answering with exact page citations.
   - On-device Executive Summarizer and interactive Quiz Generator directly from uploaded documents.

4. **Voice Assistant**
   - Local speech-to-text (STT) without sending audio to remote APIs.
   - Web Audio API real-time soundwave/waveform visualizer.
   - Local text-to-speech (TTS) with playback speed controls (0.75x, 1x, 1.25x).

5. **AI Learning Hub**
   - Offline courses: *Web Development for Beginners*, *AI Basics Made Easy*, *English Speaking Practice*, *Python for Data*.
   - Interactive lessons, code snippets, step-by-step AI Tutor Q&A, and MCQ quizzes with celebration confetti.

6. **Private Knowledge Base**
   - Folders, notes, tags, full-text search, and markdown editor.
   - SQLite and IndexedDB hybrid persistence with full backup export/import.

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend Bridge:** Express server in `server.ts` providing CORS-free proxy to local Ollama endpoints and system hardware introspection.
- **Persistence:** Local IndexedDB (`OfflineGPT_DB`) structured with relational SQLite schema mapping (`conversations`, `messages`, `documents`, `notes`, `folders`, `settings`, `learning_progress`).
- **Desktop Packaging:** Tauri ready (Windows, macOS, Linux).

---

## 🚀 Getting Started

### 1. Run in Development
```bash
npm install
npm run dev
```
The server will start at `http://localhost:3000`.

### 2. Connect with Local Ollama (Optional)
If you have Ollama installed on your machine:
```bash
# Pull lightweight Gemma 2 (2B)
ollama run gemma2:2b

# Or pull multilingual Qwen 2.5 (1.5B)
ollama run qwen2.5:1.5b
```
OfflineGPT will auto-detect the daemon at `http://localhost:11434`.

---

## 🪟 Windows Desktop Installation (Tauri Packaging)

To bundle OfflineGPT as a standalone native Windows `.exe` / `.msi`:

1. Install Rust and Tauri CLI:
   ```bash
   cargo install tauri-cli
   ```
2. Build the production frontend assets:
   ```bash
   npm run build
   ```
3. Generate the native Windows executable:
   ```bash
   cargo tauri build
   ```
The installer will be generated in `src-tauri/target/release/bundle/msi/OfflineGPT.msi`.

---

## 🔒 Privacy Guarantee

All inferences, vector embeddings, transcripts, documents, and notes remain strictly sandboxed on the user's physical machine.
