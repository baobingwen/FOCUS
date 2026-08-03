-- 学习标签：科目之下的知识点二级细分
-- 扁平全局标签库 + 记录多对多关联（级联删除）
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS record_tags (
  record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_record_tags_tag ON record_tags(tag_id);
