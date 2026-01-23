-- AutoClip Sessions table for storing session state
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS autoclip_sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_autoclip_sessions_updated_at 
ON autoclip_sessions(updated_at DESC);

-- Auto-delete old sessions (older than 24 hours)
-- This runs as a scheduled job - set up in Supabase Dashboard > Database > Extensions > pg_cron
-- Or manually clean up with: DELETE FROM autoclip_sessions WHERE updated_at < NOW() - INTERVAL '24 hours';
