-- ============================================================================
-- Offnex AI / OfflineGPT - Sign In & Sign Up SQL (Supabase / PostgreSQL)
-- Copy & paste into Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Required extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. User Profiles Table (linked 1-to-1 with Supabase Auth auth.users)
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

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. Sign In / Sign Up Audit History Table
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

-- 4. Auto-update updated_at column trigger function
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

-- 5. Sign Up Trigger: Automatically create profile when a user registers in auth.users
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

-- 6. Sign In Helper RPC: Upsert profile if missing, update last_login_at, and record Sign In
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

  INSERT INTO public.profiles (id, first_name, last_name, email, role, last_login_at)
  SELECT
    u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), ''), SPLIT_PART(u.email, '@', 1)),
    COALESCE(TRIM(u.raw_user_meta_data->>'last_name'), ''),
    LOWER(u.email),
    CASE WHEN COALESCE(u.raw_user_meta_data->>'role', 'user') = 'business_owner' THEN 'business_owner' ELSE 'user' END,
    NOW()
  FROM auth.users u
  WHERE u.id = v_uid
  ON CONFLICT (id) DO UPDATE SET
    last_login_at = NOW();

  SELECT email, role INTO v_email, v_role FROM public.profiles WHERE id = v_uid;

  IF v_email IS NOT NULL THEN
    INSERT INTO public.auth_login_history (user_id, email, event_type, role)
    VALUES (v_uid, v_email, 'sign_in', COALESCE(v_role, 'user'));
  END IF;
END;
$$;

-- Backfill any existing Supabase auth.users into public.profiles
INSERT INTO public.profiles (id, first_name, last_name, email, role, created_at, last_login_at)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), ''), SPLIT_PART(u.email, '@', 1)),
  COALESCE(TRIM(u.raw_user_meta_data->>'last_name'), ''),
  LOWER(u.email),
  CASE WHEN COALESCE(u.raw_user_meta_data->>'role', 'user') = 'business_owner' THEN 'business_owner' ELSE 'user' END,
  COALESCE(u.created_at, NOW()),
  COALESCE(u.last_sign_in_at, NOW())
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 7. Admin Role Check Helper (avoids recursive RLS lookups)
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

-- 8. Row Level Security (RLS) Policies for Sign In / Sign Up
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile or admin views all" ON public.profiles;
CREATE POLICY "Users can view own profile or admin views all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile or admin updates all" ON public.profiles;
CREATE POLICY "Users can update own profile or admin updates all"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users view own login history or admin views all" ON public.auth_login_history;
CREATE POLICY "Users view own login history or admin views all"
  ON public.auth_login_history FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users insert own login events" ON public.auth_login_history;
CREATE POLICY "Authenticated users insert own login events"
  ON public.auth_login_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
