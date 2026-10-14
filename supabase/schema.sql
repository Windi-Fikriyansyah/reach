-- =======================================================
-- ReachOwl: Skema Tabel browser_social_accounts
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor
-- =======================================================

-- 1. Buat tabel browser_social_accounts
CREATE TABLE IF NOT EXISTS public.browser_social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Akun Pengguna',
    platform TEXT NOT NULL CHECK (platform IN ('Facebook', 'Instagram')),
    avatar_url TEXT,
    account_id TEXT,
    last_logged_in TIMESTAMPTZ,
    is_connected BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    min_interval_seconds INTEGER DEFAULT 30,
    max_interval_seconds INTEGER DEFAULT 60,
    warmup_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_browser_social_accounts_platform 
ON public.browser_social_accounts(platform);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.browser_social_accounts ENABLE ROW LEVEL SECURITY;

-- 4. Policy RLS: Memungkinkan pembacaan data
CREATE POLICY "Allow read access for browser_social_accounts"
ON public.browser_social_accounts
FOR SELECT
USING (true);

-- 5. Policy RLS: Memungkinkan insert, update, dan delete (untuk aplikasi web & ekstensi)
CREATE POLICY "Allow write access for browser_social_accounts"
ON public.browser_social_accounts
FOR ALL
USING (true)
WITH CHECK (true);

-- 6. Masukkan data inisial akun Facebook dan Instagram ke dalam tabel
INSERT INTO public.browser_social_accounts (name, platform, avatar_url, is_connected, is_primary)
VALUES 
  ('Akun Facebook', 'Facebook', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces', false, false),
  ('Akun Instagram', 'Instagram', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces', false, false);

-- =======================================================
-- 7. Tabel browser_profiles (Info Browser & Status Ekstensi Riil)
-- =======================================================
CREATE TABLE IF NOT EXISTS public.browser_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_agent TEXT NOT NULL,
    browser_name TEXT DEFAULT 'Chrome',
    system_os TEXT DEFAULT 'Windows',
    ip_address TEXT,
    extension_installed BOOLEAN DEFAULT FALSE,
    extension_version TEXT DEFAULT '2.1.0',
    last_active TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.browser_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for browser_profiles"
ON public.browser_profiles
FOR SELECT
USING (true);

CREATE POLICY "Allow write access for browser_profiles"
ON public.browser_profiles
FOR ALL
USING (true)
WITH CHECK (true);

-- =======================================================
-- 8. Tabel facebook_groups (Penyimpanan Grup Hasil Scrape)
-- =======================================================
CREATE TABLE IF NOT EXISTS public.facebook_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    image_url TEXT,
    privacy TEXT DEFAULT 'Joined Group',
    last_scraped_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facebook_groups_name ON public.facebook_groups(name);
CREATE INDEX IF NOT EXISTS idx_facebook_groups_group_id ON public.facebook_groups(group_id);

ALTER TABLE public.facebook_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for facebook_groups"
ON public.facebook_groups
FOR SELECT
USING (true);

CREATE POLICY "Allow write access for facebook_groups"
ON public.facebook_groups
FOR ALL
USING (true)
WITH CHECK (true);


