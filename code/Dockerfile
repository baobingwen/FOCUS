# ============================================================
# FOCUS 学习计时器 —— Fly.io 多阶段构建
# ============================================================

# ---- Stage 1: 安装依赖 + 构建前端 ----
FROM node:22-slim AS builder
WORKDIR /app

# 服务端：只安装生产依赖（better-sqlite3 提供 linux-x64 预编译）
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# 客户端：安装全部依赖 + 构建
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# ---- Stage 2: 运行 ----
FROM node:22-slim AS runtime
WORKDIR /app

# 只复制运行时所需，不携带构建工具
COPY --from=builder /app/server/node_modules   ./server/node_modules
COPY --from=builder /app/client/dist           ./client/dist/
COPY server/                                   ./server/

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/focus.db

EXPOSE 8080

CMD ["node", "server/index.js"]
