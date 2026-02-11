-- ═══════════════════════════════════════════════════════════════
-- Markup Comments — Database Schema for Supabase
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    webhook_url TEXT DEFAULT '',
    initials TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    text TEXT NOT NULL,
    page_url TEXT DEFAULT '',
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    assignee TEXT DEFAULT NULL,
    priority TEXT DEFAULT 'medium',
    tags TEXT DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    assignee TEXT DEFAULT NULL,
    priority TEXT DEFAULT 'medium',
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — Allow public access with anon key
-- ═══════════════════════════════════════════════════════════════

-- Disable RLS for simple public access (single-user app)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key
CREATE POLICY "Allow all on team_members" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on comments" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
