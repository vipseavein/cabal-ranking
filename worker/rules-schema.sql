CREATE TABLE IF NOT EXISTS quiz_rule_config (
  id INTEGER PRIMARY KEY CHECK (id=1),
  rules_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_rule_history (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_rule_history_time ON quiz_rule_history(changed_at DESC);
INSERT OR IGNORE INTO quiz_rule_config (id,rules_json,version,updated_at)
VALUES (1,'{"topics":["Skill","Skills","Myth","Merit","Stellar Force","Stellar","Overload Mastery","OLV","Wing","Wings","Wing System","Wing Mastery"],"quotas":{"15":1,"30":2,"50":3}}',1,0);
