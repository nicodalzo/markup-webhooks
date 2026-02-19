-- ═══════════════════════════════════════════════════════════════
-- FIX: RLS infinite recursion on user_profiles
-- Run this in the Supabase SQL Editor AFTER the initial migration
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Create a SECURITY DEFINER function to check master role
-- This bypasses RLS so it won't cause recursion
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid() AND role = 'master'
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Step 2: Drop ALL existing policies on user_profiles
DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users update own credits" ON user_profiles;
DROP POLICY IF EXISTS "Masters read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Masters manage all profiles" ON user_profiles;

-- Step 3: Recreate policies using the helper function (no recursion)

-- Users can read their own profile
CREATE POLICY "Users read own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can insert their own profile (for auto-create on first login)
CREATE POLICY "Users insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Masters can read ALL profiles (uses helper function, no recursion)
CREATE POLICY "Masters read all profiles"
    ON user_profiles FOR SELECT
    USING (public.is_master());

-- Masters can update ALL profiles
CREATE POLICY "Masters update all profiles"
    ON user_profiles FOR UPDATE
    USING (public.is_master());

-- Masters can delete profiles
CREATE POLICY "Masters delete profiles"
    ON user_profiles FOR DELETE
    USING (public.is_master());

-- Step 4: Fix credit_packages and app_config policies too

DROP POLICY IF EXISTS "Masters manage packages" ON credit_packages;
DROP POLICY IF EXISTS "Masters manage config" ON app_config;

CREATE POLICY "Masters manage packages"
    ON credit_packages FOR ALL
    USING (public.is_master());

CREATE POLICY "Masters manage config"
    ON app_config FOR ALL
    USING (public.is_master());

-- Step 5: Allow all authenticated users to read app_config
-- (needed for Stripe checkout to read the secret key... actually no,
-- Stripe key is read server-side. But packages need to be readable.)
CREATE POLICY "Authenticated read config"
    ON app_config FOR SELECT
    USING (auth.uid() IS NOT NULL);
