-- ============================================================================
-- Offnex AI / OfflineGPT - Complete Backend SQL Schema (Supabase / PostgreSQL)
-- Run this script inside Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Safe & idempotent: can be re-run cleanly to upgrade existing tables.
-- ============================================================================

-- 0. Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (synced 1-to-1 with auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT 'User',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'business_owner')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================================
-- 2. AUTH LOGIN AUDIT HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auth_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sign_up', 'sign_in', 'sign_out', 'password_reset')),
  role TEXT NOT NULL DEFAULT 'user',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_history_user ON public.auth_login_history(user_id, created_at DESC);

-- ============================================================================
-- 3. CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  title TEXT NOT NULL DEFAULT 'New Offline Chat',
  model_name TEXT NOT NULL DEFAULT 'gemini-3.1-flash-lite',
  language TEXT NOT NULL DEFAULT 'ur' CHECK (language IN ('en', 'ur', 'roman_ur', 'ar', 'hi')),
  mode TEXT NOT NULL DEFAULT 'online' CHECK (mode IN ('online', 'offline')),
  messages_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'online';

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON public.conversations(user_id, updated_at DESC);

-- ============================================================================
-- 4. MESSAGES TABLE
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id, created_at DESC);

-- ============================================================================
-- 5. GENERATED IMAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.generated_images (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'Realistic Photography',
  aspect_ratio TEXT NOT NULL DEFAULT '1:1' CHECK (aspect_ratio IN ('1:1', '16:9', '9:16', '4:3')),
  quality TEXT NOT NULL DEFAULT 'standard' CHECK (quality IN ('standard', 'high')),
  count INTEGER NOT NULL DEFAULT 1,
  model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
  provider TEXT NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'local', 'openai', 'pinterest')),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_reference_image BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.generated_images ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.generated_images ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Ensure existing provider CHECK constraint includes 'pinterest'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'generated_images_provider_check'
      AND conrelid = 'public.generated_images'::regclass
  ) THEN
    ALTER TABLE public.generated_images DROP CONSTRAINT generated_images_provider_check;
  END IF;
  ALTER TABLE public.generated_images
    ADD CONSTRAINT generated_images_provider_check
    CHECK (provider IN ('gemini', 'local', 'openai', 'pinterest'));
END $$;

CREATE INDEX IF NOT EXISTS idx_generated_images_user_created ON public.generated_images(user_id, created_at DESC);

-- ============================================================================
-- 6. DOCUMENTS TABLE (RAG Knowledge Files)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT,
  name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'text/plain',
  page_count INTEGER NOT NULL DEFAULT 1,
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS user_email TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id, uploaded_at DESC);

-- ============================================================================
-- 7. KNOWLEDGE FOLDERS & NOTES
-- ============================================================================
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

-- ============================================================================
-- 8. USER SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- ============================================================================
-- 9. SUPPORT TICKETS (User -> Admin Reply)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  message TEXT NOT NULL,
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_reply TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id, updated_at DESC);

-- ============================================================================
-- 10. ACTIVITY LOGS (Admin Panel)
-- ============================================================================
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

-- ============================================================================
-- 11. PLATFORM RUNTIME CONFIG (Singleton Admin Settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_config (
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

INSERT INTO public.platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 12. DAILY IMAGE QUOTAS (10 Images / Day Persistence)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.image_quotas (
  user_key TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_timestamps BIGINT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. TRIGGERS & HELPER FUNCTIONS (RPCs)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatically create profile row on new auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_role TEXT;
BEGIN
  v_first_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );
  v_last_name := COALESCE(TRIM(NEW.raw_user_meta_data->>'last_name'), '');
  v_role := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''), 'user');
  IF v_role NOT IN ('user', 'business_owner') THEN
    v_role := 'user';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, email, role, last_login_at)
  VALUES (NEW.id, v_first_name, v_last_name, LOWER(NEW.email), v_role, NOW())
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    last_login_at = NOW();

  INSERT INTO public.auth_login_history (user_id, email, event_type, role)
  VALUES (NEW.id, LOWER(NEW.email), 'sign_up', v_role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sign-in audit RPC
CREATE OR REPLACE FUNCTION public.record_user_sign_in()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles SET last_login_at = NOW() WHERE id = v_uid;
  SELECT email, role INTO v_email, v_role FROM public.profiles WHERE id = v_uid;

  IF v_email IS NOT NULL THEN
    INSERT INTO public.auth_login_history (user_id, email, event_type, role)
    VALUES (v_uid, v_email, 'sign_in', COALESCE(v_role, 'user'));
  END IF;
END;
$$;

-- Admin check helper (no recursive RLS issues)
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

-- Atomic Daily Image Quota Consumer (10 images / 24h)
CREATE OR REPLACE FUNCTION public.consume_daily_image_quota(
  p_user_key TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, quota_limit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_window_ms BIGINT;
  v_now_ms BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_valid BIGINT[];
  v_i INTEGER;
BEGIN
  SELECT image_rate_limit_max, (image_rate_limit_window_minutes * 60 * 1000)::BIGINT
  INTO v_limit, v_window_ms
  FROM public.platform_config WHERE id = 1;

  v_limit := COALESCE(v_limit, 10);
  v_window_ms := COALESCE(v_window_ms, 86400000);

  INSERT INTO public.image_quotas (user_key, request_timestamps)
  VALUES (p_user_key, '{}')
  ON CONFLICT (user_key) DO NOTHING;

  SELECT ARRAY(
    SELECT ts FROM unnest(request_timestamps) AS ts
    WHERE (v_now_ms - ts) < v_window_ms
  )
  INTO v_valid
  FROM public.image_quotas
  WHERE user_key = p_user_key
  FOR UPDATE;

  v_valid := COALESCE(v_valid, '{}');

  IF array_length(v_valid, 1) IS NOT NULL AND (array_length(v_valid, 1) + p_count) > v_limit THEN
    UPDATE public.image_quotas SET request_timestamps = v_valid, updated_at = NOW() WHERE user_key = p_user_key;
    RETURN QUERY SELECT FALSE, GREATEST(0, v_limit - array_length(v_valid, 1)), v_limit;
    RETURN;
  END IF;

  FOR v_i IN 1..GREATEST(1, p_count) LOOP
    v_valid := array_append(v_valid, v_now_ms);
  END LOOP;

  UPDATE public.image_quotas SET request_timestamps = v_valid, updated_at = NOW() WHERE user_key = p_user_key;
  RETURN QUERY SELECT TRUE, GREATEST(0, v_limit - COALESCE(array_length(v_valid, 1), 0)), v_limit;
END;
$$;

-- ============================================================================
-- 14. ADMIN ANALYTICS VIEW (Per-User Chat & Image Usage)
-- ============================================================================
CREATE OR REPLACE VIEW public.admin_user_usage_summary AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  p.created_at,
  p.last_login_at,
  COALESCE(c.chat_count, 0) AS chat_count,
  COALESCE(m.message_count, 0) AS message_count,
  COALESCE(i.image_batches, 0) AS image_batches,
  COALESCE(i.total_images_generated, 0) AS total_images_generated,
  COALESCE(d.document_count, 0) AS document_count,
  COALESCE(t.open_tickets, 0) AS open_tickets
FROM public.profiles p
LEFT JOIN (
  SELECT user_id, COUNT(*)::INT AS chat_count
  FROM public.conversations GROUP BY user_id
) c ON c.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*)::INT AS message_count
  FROM public.messages GROUP BY user_id
) m ON m.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*)::INT AS image_batches, COALESCE(SUM(count), 0)::INT AS total_images_generated
  FROM public.generated_images GROUP BY user_id
) i ON i.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*)::INT AS document_count
  FROM public.documents GROUP BY user_id
) d ON d.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*)::INT AS open_tickets
  FROM public.support_tickets WHERE status <> 'resolved' GROUP BY user_id
) t ON t.user_id = p.id;

-- ============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES (Idempotent)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_login_history ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.image_quotas ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile or admin can view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admin views all" ON public.profiles;
CREATE POLICY "Users can view own profile or admin views all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile or admin can update all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admin updates all" ON public.profiles;
CREATE POLICY "Users can update own profile or admin updates all"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
CREATE POLICY "Only admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- Auth login history
DROP POLICY IF EXISTS "Users view own login history or admin views all" ON public.auth_login_history;
CREATE POLICY "Users view own login history or admin views all"
  ON public.auth_login_history FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users insert own login events" ON public.auth_login_history;
CREATE POLICY "Authenticated users insert own login events"
  ON public.auth_login_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Conversations
DROP POLICY IF EXISTS "Users manage own conversations or admin reads all" ON public.conversations;
CREATE POLICY "Users manage own conversations or admin reads all"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Messages
DROP POLICY IF EXISTS "Users manage own messages or admin reads all" ON public.messages;
CREATE POLICY "Users manage own messages or admin reads all"
  ON public.messages FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Generated Images
DROP POLICY IF EXISTS "Users manage own images or admin reads all" ON public.generated_images;
CREATE POLICY "Users manage own images or admin reads all"
  ON public.generated_images FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Documents
DROP POLICY IF EXISTS "Users manage own documents or admin reads all" ON public.documents;
CREATE POLICY "Users manage own documents or admin reads all"
  ON public.documents FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Knowledge Folders & Notes
DROP POLICY IF EXISTS "Users manage own folders" ON public.knowledge_folders;
CREATE POLICY "Users manage own folders"
  ON public.knowledge_folders FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage own notes" ON public.knowledge_notes;
CREATE POLICY "Users manage own notes"
  ON public.knowledge_notes FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- User Settings
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Support Tickets
DROP POLICY IF EXISTS "Users can view/create own tickets; admin manages all" ON public.support_tickets;
CREATE POLICY "Users can view/create own tickets; admin manages all"
  ON public.support_tickets FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Activity Logs
DROP POLICY IF EXISTS "Admins can view/manage logs; users can insert own logs" ON public.activity_logs;
CREATE POLICY "Admins can view/manage logs; users can insert own logs"
  ON public.activity_logs FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can delete activity logs" ON public.activity_logs;
CREATE POLICY "Admins can delete activity logs"
  ON public.activity_logs FOR DELETE
  USING (public.is_admin());

-- Platform Config
DROP POLICY IF EXISTS "Anyone authenticated can read platform config" ON public.platform_config;
CREATE POLICY "Anyone authenticated can read platform config"
  ON public.platform_config FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Only admins can update platform config" ON public.platform_config;
CREATE POLICY "Only admins can update platform config"
  ON public.platform_config FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Image Quotas
DROP POLICY IF EXISTS "Users view own quota or admin views all" ON public.image_quotas;
CREATE POLICY "Users view own quota or admin views all"
  ON public.image_quotas FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
