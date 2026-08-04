-- 标签自定义排列顺序：tags 增加 sort_order 列，存量标签回填为创建顺序（id）
ALTER TABLE tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE tags SET sort_order = id;
