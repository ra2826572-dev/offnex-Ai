-- ============================================================================
-- Offnex AI / OfflineGPT - Standalone PostgreSQL Backend Schema
-- Use this file if deploying on any standard PostgreSQL server (non-Supabase)
-- Exact table mirror of server-side backend persistence & Admin Panel entities
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT 'User',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'business_owner')),
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  title TEXT NOT NULL DEFAULT 'New Offline Chat',
  model_used TEXT NOT NULL DEFAULT 'gemini-3.1-flash-lite',
  language TEXT NOT NULL DEFAULT 'ur' CHECK (language IN ('en', 'ur', 'roman_ur', 'ar', 'hi')),
  mode TEXT NOT NULL DEFAULT 'online' CHECK (mode IN ('online', 'offline')),
  messages_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_conversations_user ON conversations(user_id, updated_at DESC);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  timestamp_label TEXT,
  model_used TEXT,
  sources JSONB,
  suggested_actions TEXT[],
  image_generation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_messages_conv ON messages(conversation_id, created_at ASC);

-- 4. Generated Images Table
CREATE TABLE IF NOT EXISTS generated_images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'Realistic Photography',
  aspect_ratio TEXT NOT NULL DEFAULT '1:1' CHECK (aspect_ratio IN ('1:1', '16:9', '9:16', '4:3')),
  quality TEXT NOT NULL DEFAULT 'standard' CHECK (quality IN ('standard', 'high')),
  count INTEGER NOT NULL DEFAULT 1,
  model_used TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'local', 'openai', 'pinterest')),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_reference_image BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_images_user ON generated_images(user_id, created_at DESC);

-- 5. Uploaded Documents Metadata Table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT,
  name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'text/plain',
  page_count INTEGER NOT NULL DEFAULT 1,
  summary TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_documents_user ON documents(user_id, uploaded_at DESC);

-- 6. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'User',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_tickets_status ON support_tickets(status, updated_at DESC);

-- 7. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT,
  source TEXT NOT NULL DEFAULT 'server' CHECK (source IN ('client', 'server')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_logs_created ON activity_logs(created_at DESC);

-- 8. Runtime Config & System Settings Tables
CREATE TABLE IF NOT EXISTS platform_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_chat_model TEXT NOT NULL DEFAULT 'gemini-3.1-flash-lite',
  default_image_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
  high_quality_image_model TEXT NOT NULL DEFAULT 'gemini-nano-banana-2.1',
  image_rate_limit_max INTEGER NOT NULL DEFAULT 10,
  image_rate_limit_window_minutes INTEGER NOT NULL DEFAULT 1440,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  allow_local_fallback BOOLEAN NOT NULL DEFAULT TRUE,
  ollama_host TEXT NOT NULL DEFAULT 'http://localhost:11434',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  language TEXT NOT NULL DEFAULT 'ur',
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  default_model TEXT NOT NULL DEFAULT 'gemini-3.1-flash-lite',
  ollama_host TEXT NOT NULL DEFAULT 'http://localhost:11434',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  context_window INTEGER NOT NULL DEFAULT 4096,
  speech_speed NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  tts_voice TEXT NOT NULL DEFAULT 'default',
  offline_strict BOOLEAN NOT NULL DEFAULT FALSE,
  auto_save_history BOOLEAN NOT NULL DEFAULT TRUE,
  enable_sound_effects BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 9. Daily Image Quotas Table (10 Images / Day)
CREATE TABLE IF NOT EXISTS image_quotas (
  user_key TEXT PRIMARY KEY,
  request_timestamps BIGINT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
