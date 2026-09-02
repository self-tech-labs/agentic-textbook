CREATE TABLE IF NOT EXISTS guest_sessions (
  guest_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  active_runs INTEGER NOT NULL DEFAULT 0 CHECK (active_runs IN (0, 1))
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'video')),
  mime_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed', 'expired')),
  caption TEXT NOT NULL,
  attribution TEXT NOT NULL,
  alt TEXT,
  transcript TEXT,
  captions_vtt TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (guest_id) REFERENCES guest_sessions(guest_id)
);

CREATE INDEX IF NOT EXISTS idx_assets_guest_lesson
  ON assets(guest_id, lesson_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_expiry
  ON assets(expires_at);
CREATE INDEX IF NOT EXISTS idx_assets_content_hash
  ON assets(content_hash);

CREATE TABLE IF NOT EXISTS code_exercises (
  exercise_id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('javascript', 'typescript', 'python')),
  test_manifest TEXT NOT NULL,
  visible_tests TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'failed', 'expired')),
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (guest_id) REFERENCES guest_sessions(guest_id)
);

CREATE INDEX IF NOT EXISTS idx_code_exercises_guest
  ON code_exercises(guest_id, lesson_id, status);
CREATE INDEX IF NOT EXISTS idx_code_exercises_expiry
  ON code_exercises(expires_at);

CREATE TABLE IF NOT EXISTS code_run_events (
  run_id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  cold_state TEXT NOT NULL CHECK (cold_state IN ('cold', 'warm')),
  FOREIGN KEY (guest_id) REFERENCES guest_sessions(guest_id)
);

CREATE INDEX IF NOT EXISTS idx_code_run_events_window
  ON code_run_events(guest_id, started_at);

CREATE TABLE IF NOT EXISTS sandbox_activity (
  sandbox_id TEXT PRIMARY KEY,
  last_used_at INTEGER NOT NULL
);
