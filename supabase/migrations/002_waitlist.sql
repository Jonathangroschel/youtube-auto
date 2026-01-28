-- Waitlist table for collecting emails
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT DEFAULT 'landing_page',
  ip_address TEXT,
  user_agent TEXT
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Create index for created_at for sorting
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- Enable Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts from anyone (for public signups)
CREATE POLICY "Allow public inserts" ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only authenticated users with admin role can read (optional - adjust as needed)
-- For now, we'll allow service role to read all
CREATE POLICY "Allow service role to read" ON waitlist
  FOR SELECT
  USING (auth.role() = 'service_role');
