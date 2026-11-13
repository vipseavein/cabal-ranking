CREATE TABLE IF NOT EXISTS quiz_question_timers (
 session_id TEXT PRIMARY KEY,
 question_index INTEGER NOT NULL DEFAULT 0,
 started_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_question_timers_started ON quiz_question_timers(started_at);
