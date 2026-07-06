import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './database.js';
import { recordsRouter } from './routes/records.js';
import { subjectsRouter } from './routes/subjects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// 初始化数据库
getDb();

// 中间件
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/records', recordsRouter);
app.use('/api/subjects', subjectsRouter);

// 生产环境：托管前端构建文件
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const server = app.listen(PORT, () => {
  console.log(`🎯 FOCUS 学习计时器后端已启动: http://localhost:${PORT}`);
  console.log(`📁 数据库位置: ${path.join(__dirname, 'data', 'focus.db')}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用！`);
  } else {
    console.error('❌ 服务器启动失败:', err.message);
  }
  process.exit(1);
});
