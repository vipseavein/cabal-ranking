PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  category_vi TEXT NOT NULL,
  category_en TEXT NOT NULL,
  subtopic_vi TEXT,
  subtopic_en TEXT,
  difficulty_vi TEXT,
  difficulty_en TEXT,
  question_vi TEXT NOT NULL,
  question_en TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct TEXT NOT NULL CHECK (correct IN ('A','B','C','D'))
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id TEXT PRIMARY KEY,
  question_ids TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS quiz_results (
  session_id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  player_name_key TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  week_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  year_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_results_all ON quiz_results(score DESC,duration_ms ASC,completed_at ASC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_day ON quiz_results(day_key,score DESC,duration_ms ASC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_week ON quiz_results(week_key,score DESC,duration_ms ASC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_month ON quiz_results(month_key,score DESC,duration_ms ASC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_year ON quiz_results(year_key,score DESC,duration_ms ASC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_name ON quiz_results(player_name_key);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_expiry ON quiz_sessions(expires_at);
