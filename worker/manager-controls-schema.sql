CREATE TABLE IF NOT EXISTS quiz_tier_timers (
  tier_size INTEGER PRIMARY KEY CHECK(tier_size IN (15,30,50)),
  seconds INTEGER NOT NULL CHECK(seconds BETWEEN 5 AND 120),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO quiz_tier_timers(tier_size,seconds,version,updated_at) VALUES(15,15,1,0),(30,15,1,0),(50,15,1,0);
CREATE TABLE IF NOT EXISTS quiz_session_limits(
  session_id TEXT PRIMARY KEY,
  limit_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_tier_timer_audit(
  id TEXT PRIMARY KEY,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_deleted_records(
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  record_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  batch_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deleted_records_batch ON quiz_deleted_records(batch_id);
CREATE TABLE IF NOT EXISTS quiz_delete_previews(
  id TEXT PRIMARY KEY,
  session_ids TEXT NOT NULL,
  tier_size INTEGER NOT NULL,
  mode TEXT NOT NULL,
  period_key TEXT,
  total INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);
