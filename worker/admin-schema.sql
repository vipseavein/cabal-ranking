CREATE TABLE IF NOT EXISTS quiz_admin_audit (
 id TEXT PRIMARY KEY,
 action TEXT NOT NULL,
 question_id TEXT NOT NULL,
 before_json TEXT,
 after_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_question ON quiz_admin_audit(question_id,changed_at DESC);
