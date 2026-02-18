-- ═══════════════════════════════════════════════════════════════
-- Markup Comments — Database Schema v2 (Multi-user with Auth)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Drop old policies and tables
DROP POLICY IF EXISTS "Allow all on team_members" ON team_members;
DROP POLICY IF EXISTS "Allow all on comments" ON comments;
DROP POLICY IF EXISTS "Allow all on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all on settings" ON settings;

DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Create tables with user_id
-- ═══════════════════════════════════════════════════════════════

-- Team Members (per user)
CREATE TABLE team_members (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    webhook_url TEXT DEFAULT '',
    initials TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

-- Comments (per user)
CREATE TABLE comments (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    text TEXT NOT NULL,
    page_url TEXT DEFAULT '',
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    assignee TEXT DEFAULT NULL,
    priority TEXT DEFAULT 'medium',
    tags TEXT DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

-- Tasks (per user)
CREATE TABLE tasks (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id TEXT NOT NULL,
    text TEXT NOT NULL,
    assignee TEXT DEFAULT NULL,
    priority TEXT DEFAULT 'medium',
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

-- Settings (per user, key-value)
CREATE TABLE settings (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT DEFAULT '',
    PRIMARY KEY (user_id, key)
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Enable RLS and create per-user policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Each user can only see/modify their own data
CREATE POLICY "Users manage own team_members"
    ON team_members FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own comments"
    ON comments FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own tasks"
    ON tasks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own settings"
    ON settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
