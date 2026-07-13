// code/server/index.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './database.js';
import { recordsRouter } from './routes/records.js';
import { subjectsRouter } from './routes/subjects.js';

/**
 * @import { Server } from 'http'
 */

/** @type { string } */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// 初始化数据库 + 执行迁移
getDb();

// 中间件
app.use(cors());
app.use(express.json());

// 健康检查 + 版本信息
import { getVersion } from './version.js';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: getVersion(), timestamp: Date.now() });
});

app.get('/api/version', (_req, res) => {
  res.json({ version: getVersion() });
});

// API 路由
app.use('/api/records', recordsRouter);
app.use('/api/subjects', subjectsRouter);

// 生产环境：托管前端构建文件
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

/**
 * 处理前端路由
 * @param {express.Request} req - Express 请求对象
 * @param {express.Response} res - Express 响应对象
 * @param {express.NextFunction} next - Express 下一个中间件函数
 */
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

export { app };

// 测试环境下由 supertest 驱动，不启动监听
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
if (!isTest) {
  /** @type { Server } */
  const server = app.listen(PORT, () => {
    console.log(`🎯 FOCUS 学习计时器后端已启动: http://localhost:${PORT}`);
    console.log(`📁 数据库位置: ${process.env.DB_PATH || path.join(__dirname, 'data', 'focus.db')}`);
  });

  /**
   * 检查错误是否具有 code 属性
   * @param {unknown} err - 错误对象
   * @returns {err is NodeJS.ErrnoException}
   */
  function isNodeError(err) {
    return err instanceof Error && 'code' in err;
  }

  server.on('error', (err) => {
    if (isNodeError(err) && err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${PORT} 已被占用！`);
    } else {
      console.error('❌ 服务器启动失败:', err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  });

  // 关闭
  process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
}