// code/server/database.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'focus.db');
/** 可通过环境变量 DB_PATH 覆盖，测试时设为 ':memory:' */
const DB_PATH = process.env.DB_PATH || DEFAULT_DB_PATH;
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * 数据库单例实例
 * @type {import('better-sqlite3').Database | undefined}
 */
let db;

/**
 * 获取数据库单例实例
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    try {
      db.pragma('journal_mode = WAL');
    } catch {
      // :memory: 数据库不支持 WAL 模式，忽略
    }
    db.pragma('foreign_keys = ON');
    initTables();
    runMigrations();
  }
  return db;
}

/**
 * 关闭数据库连接并重置单例（主要用于测试清理）
 * @returns {void}
 */
export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

/**
 * 初始化数据库表结构
 * @returns {void}
 * @throws {Error} 当表创建失败时抛出错误
 */
function initTables() {
  if (db == undefined) {
    console.error('初始化 table 时, db 未定义')
    return;
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL CHECK(mode IN ('study', 'rest')),
      subject TEXT,
      duration_ms INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at);
    CREATE INDEX IF NOT EXISTS idx_records_date ON records(DATE(created_at));

    INSERT OR IGNORE INTO subjects (name, sort_order) VALUES
      ('数学', 0), ('英语', 1), ('专业课', 2);
  `);
}

// ============================================================
// 幂等迁移系统 —— 新增变更记录至此，不删不改已有结构
// ============================================================

/**
 * 运行待执行的数据迁移脚本
 * 每次启动时自动调用。只会执行尚未在 _migrations 表中登记的迁移文件。
 * 迁移文件位于 server/migrations/ 目录，按文件名排序依次执行。
 * @returns {void}
 */
function runMigrations() {
  if (db == undefined) return;

  // 创建迁移追踪表
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 读出已执行的迁移
  const applied = new Set(
    db.prepare('SELECT name FROM _migrations ORDER BY id').all().map(r => r.name)
  );

  // 扫描迁移文件
  /** @type {string[]} */
  let files;
  try {
    files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch {
    // migrations/ 目录不存在，无迁移可执行
    return;
  }

  if (files.length === 0) return;

  const insert = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const file of files) {
    const name = file.replace(/\.sql$/, '');
    if (applied.has(name)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8').trim();
    if (!sql) continue;

    db.transaction(() => {
      db.exec(sql);
      insert.run(name);
    })();

    console.log(`✅ 迁移已执行: ${name}`);
  }
}
