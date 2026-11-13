-- Every change to D1 question bank or Quiz Rules keeps the fast pool in sync.
-- Use uppercase BEGIN/END; Cloudflare D1 has sensitive multi-SQL trigger parsing.
CREATE TRIGGER IF NOT EXISTS trg_quiz_pool_insert
AFTER INSERT ON quiz_questions
BEGIN
  INSERT OR REPLACE INTO quiz_question_pool(question_id,pool_type,random_key)
  VALUES(
    NEW.id,
    CASE WHEN EXISTS (
      SELECT 1 FROM json_each((SELECT rules_json FROM quiz_rule_config WHERE id=1),'$.topics') topic
      WHERE LOWER(TRIM(topic.value))=LOWER(TRIM(NEW.category_en))
    ) THEN 1 ELSE 0 END,
    ((CAST(SUBSTR(NEW.id,2) AS INTEGER) * 1103515245) % 2147483647)
  );
END;
CREATE TRIGGER IF NOT EXISTS trg_quiz_pool_category
AFTER UPDATE OF category_en ON quiz_questions
BEGIN
  UPDATE quiz_question_pool SET pool_type=CASE WHEN EXISTS (
    SELECT 1 FROM json_each((SELECT rules_json FROM quiz_rule_config WHERE id=1),'$.topics') topic
    WHERE LOWER(TRIM(topic.value))=LOWER(TRIM(NEW.category_en))
  ) THEN 1 ELSE 0 END
  WHERE question_id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_quiz_pool_delete
AFTER DELETE ON quiz_questions
BEGIN
  DELETE FROM quiz_question_pool WHERE question_id=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_quiz_pool_rules
AFTER UPDATE OF rules_json ON quiz_rule_config
BEGIN
  UPDATE quiz_question_pool
  SET pool_type=CASE WHEN EXISTS (
     SELECT 1 FROM quiz_questions q, json_each(NEW.rules_json,'$.topics') topic
     WHERE q.id=quiz_question_pool.question_id
       AND LOWER(TRIM(q.category_en))=LOWER(TRIM(topic.value))
  ) THEN 1 ELSE 0 END;
END;
