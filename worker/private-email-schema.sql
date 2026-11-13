-- Email is private metadata, physically separated from the public quiz_results table.
-- Idempotent: safe on every staging deployment.
CREATE TABLE IF NOT EXISTS quiz_player_contacts (
  session_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  supplied_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES quiz_results(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_quiz_player_contacts_email ON quiz_player_contacts(email);
