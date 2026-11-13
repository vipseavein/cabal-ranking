-- CABAL Quiz fast random selection (staging). Re-runnable; source data never modified.
-- A deterministic permutation makes range-based random sampling inexpensive.
CREATE TABLE IF NOT EXISTS quiz_question_pool (
  question_id TEXT PRIMARY KEY,
  pool_type INTEGER NOT NULL CHECK (pool_type IN (0,1)),
  random_key INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_question_pool_type_random ON quiz_question_pool(pool_type,random_key,question_id);

-- Backfill only missing IDs. Triggers keep existing rows updated after bootstrap.
INSERT OR IGNORE INTO quiz_question_pool(question_id,pool_type,random_key)
SELECT q.id,
       CASE WHEN EXISTS (
         SELECT 1 FROM json_each(
           (SELECT rules_json FROM quiz_rule_config WHERE id=1),'$.topics'
         ) AS topic
         WHERE LOWER(TRIM(topic.value))=LOWER(TRIM(q.category_en))
       ) THEN 1 ELSE 0 END,
       ((CAST(SUBSTR(q.id,2) AS INTEGER) * 1103515245) % 2147483647)
FROM quiz_questions q;
