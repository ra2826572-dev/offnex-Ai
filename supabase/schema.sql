-- ============================================================================
-- Offnex AI / OfflineGPT - Supabase PostgreSQL Schema & RLS Policies
-- Run this complete script inside Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (synced with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT 'User',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'business_owner')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automatically create a profile row whenever a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Offline Chat',
  model_name TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  language TEXT NOT NULL DEFAULT 'ur' CHECK (language IN ('en', 'ur', 'roman_ur', 'ar', 'hi')),
  messages_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON public.conversations(user_id, updated_at DESC);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  timestamp_label TEXT,
  model_used TEXT,
  sources JSONB,
  suggested_actions TEXT[],
  image_generation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);

-- 4. Generated Images History Table
CREATE TABLE IF NOT EXISTS public.generated_images (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  style TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1' CHECK (aspect_ratio IN ('1:1', '16:9', '9:16', '4:3')),
  quality TEXT NOT NULL DEFAULT 'standard' CHECK (quality IN ('standard', 'high')),
  count INTEGER NOT NULL DEFAULT 1,
  model_used TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'local', 'openai')),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_reference_image BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_images_user_created ON public.generated_images(user_id, created_at DESC);

-- 5. Documents (RAG Knowledge Files)
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'text/plain',
  page_count INTEGER NOT NULL DEFAULT 1,
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id, uploaded_at DESC);

-- 6. Knowledge Folders & Notes
CREATE TABLE IF NOT EXISTS public.knowledge_folders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7547FF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.knowledge_notes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES public.knowledge_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. User Preferences & App Settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ur',
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  default_model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  ollama_host TEXT NOT NULL DEFAULT 'http://localhost:11434',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  context_window INTEGER NOT NULL DEFAULT 4096,
  speech_speed NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  tts_voice TEXT NOT NULL DEFAULT 'default',
  offline_strict BOOLEAN NOT NULL DEFAULT TRUE,
  auto_save_history BOOLEAN NOT NULL DEFAULT TRUE,
  enable_sound_effects BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Support Tickets (Admin Panel)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, updated_at DESC);

-- 9. Activity Logs (Admin Panel)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT,
  source TEXT NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'server')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- 10. Platform Runtime Config (Admin Panel Singleton Row)
CREATE TABLE IF NOT EXISTS public.platform_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_chat_model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  default_image_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
  high_quality_image_model TEXT NOT NULL DEFAULT 'gemini-nano-banana-2.1',
  image_rate_limit_max INTEGER NOT NULL DEFAULT 15,
  image_rate_limit_window_minutes INTEGER NOT NULL DEFAULT 10,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  allow_local_fallback BOOLEAN NOT NULL DEFAULT TRUE,
  ollama_host TEXT NOT NULL DEFAULT 'http://localhost:11434',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Helper Function: Check if Current User is Admin (business_owner)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'business_owner'
  );
$$;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile or admin can view all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile or admin can update all"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

-- Conversations
CREATE POLICY "Users manage own conversations or admin reads all"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Messages
CREATE POLICY "Users manage own messages or admin reads all"
  ON public.messages FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Generated Images
CREATE POLICY "Users manage own images or admin reads all"
  ON public.generated_images FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Documents
CREATE POLICY "Users manage own documents or admin reads all"
  ON public.documents FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Knowledge Folders & Notes
CREATE POLICY "Users manage own folders"
  ON public.knowledge_folders FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users manage own notes"
  ON public.knowledge_notes FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- User Settings
CREATE POLICY "Users manage own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Support Tickets
CREATE POLICY "Users can view/create own tickets; admin manages all"
  ON public.support_tickets FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Activity Logs
CREATE POLICY "Admins can view/manage logs; users can insert own logs"
  ON public.activity_logs FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete activity logs"
  ON public.activity_logs FOR DELETE
  USING (public.is_admin());

-- Platform Config
CREATE POLICY "Anyone authenticated can read platform config"
  ON public.platform_config FOR SELECT
  USING (TRUE);

CREATE POLICY "Only admins can update platform config"
  ON public.platform_config FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
