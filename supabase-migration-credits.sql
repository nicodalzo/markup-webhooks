-- ═══════════════════════════════════════════════════════════════
-- Migration: Credits System, Admin Panel & Stripe Config
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. User Profiles ────────────────────────────────────────
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'master')),
    monthly_limit INTEGER NOT NULL DEFAULT 200,
    credits_used INTEGER NOT NULL DEFAULT 0,
    credits_extra INTEGER NOT NULL DEFAULT 0,
    billing_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    suspended BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Credit Packages ─────────────────────────────────────
CREATE TABLE credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    label TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. App Config (Stripe keys etc.) ───────────────────────
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- user_profiles: users read own, masters manage all
CREATE POLICY "Users read own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users update own credits"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Masters read all profiles"
    ON user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND role = 'master'
        )
    );

CREATE POLICY "Masters manage all profiles"
    ON user_profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND role = 'master'
        )
    );

-- credit_packages: everyone reads active, masters manage all
CREATE POLICY "Anyone reads active packages"
    ON credit_packages FOR SELECT
    USING (active = true);

CREATE POLICY "Masters manage packages"
    ON credit_packages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND role = 'master'
        )
    );

-- app_config: only masters
CREATE POLICY "Masters manage config"
    ON app_config FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND role = 'master'
        )
    );

-- ═══════════════════════════════════════════════════════════════
-- Auto-create profile on signup
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (user_id) DO UPDATE SET email = NEW.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- Set nicolo.dalzotto@gmail.com as master
-- ═══════════════════════════════════════════════════════════════

-- First, ensure the profile exists for this user
INSERT INTO user_profiles (user_id, email, role)
SELECT id, email, 'master' FROM auth.users WHERE email = 'nicolo.dalzotto@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'master', email = 'nicolo.dalzotto@gmail.com';

-- ═══════════════════════════════════════════════════════════════
-- Default credit packages
-- ═══════════════════════════════════════════════════════════════

INSERT INTO credit_packages (credits, price_cents, label, position) VALUES
    (50,  499,  '50 Crediti',  1),
    (100, 799,  '100 Crediti', 2),
    (200, 1299, '200 Crediti', 3);

-- ═══════════════════════════════════════════════════════════════
-- Default Stripe config placeholders
-- ═══════════════════════════════════════════════════════════════

INSERT INTO app_config (key, value) VALUES
    ('stripe_secret_key', ''),
    ('stripe_webhook_secret', '')
ON CONFLICT (key) DO NOTHING;
