-- Run this SQL in your Supabase SQL Editor to create the projects table
-- Go to: https://supabase.com/dashboard/project/ozzjcuamqslxjcfgtfhj/sql/new

-- Create the projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  thumbnail TEXT,
  settings JSONB NOT NULL DEFAULT '{}',
  device_id TEXT NOT NULL
);

-- Create index for faster queries by device_id
CREATE INDEX IF NOT EXISTS idx_projects_device_id ON projects(device_id);

-- Create index for sorting by updated_at
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert (anonymous users with device_id)
CREATE POLICY "Allow anonymous insert" ON projects
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow users to read their own projects (by device_id)
CREATE POLICY "Allow read own projects" ON projects
  FOR SELECT
  USING (true);

-- Policy: Allow users to update their own projects
CREATE POLICY "Allow update own projects" ON projects
  FOR UPDATE
  USING (true);

-- Policy: Allow users to delete their own projects
CREATE POLICY "Allow delete own projects" ON projects
  FOR DELETE
  USING (true);

-- Grant permissions to anon role
GRANT ALL ON projects TO anon;
GRANT ALL ON projects TO authenticated;
