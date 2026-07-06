# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

学习计时器 (Study Timer) — a full-stack study timer app with Pomodoro-style tracking, tag management, statistics, daily summaries, and todo lists. The project lives under `111日常学习计时器-第三方项目/` (the root repo only tracks config files).

## Commands

The app has two separate servers:

```bash
# Start backend (Express + SQLite, port 3001)
cd 111日常学习计时器-第三方项目/server && npm run dev

# Start frontend (Vite + React, port 5173, proxies /api to backend)
cd 111日常学习计时器-第三方项目/client && npm run dev

# Or both at once via the batch file
.\111日常学习计时器-第三方项目\启动.bat
```

Dependencies (install in each directory): `cd server && npm install`, `cd client && npm install`

## Architecture

### Client (`client/`)

- **Framework**: React 18 with Vite 6, Tailwind CSS 3, Recharts, PostCSS + Autoprefixer
- **Mobile-first layout**: Max width 430px, bottom nav with 5 tabs (Timer, History, Stats, Summary, Export)
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Key components**: `TimerDisplay`, `TimerControls`, `RecordList`, `BottomNav`, `StatsPanel`, `CalendarSummary`, `ExportPanel`, `TagSelector`, `TodoList`
- **Custom hook**: `useTimer.js` — dual-track timing core using absolute `Date.now()` timestamps (not accumulators), with crash recovery via `localStorage` backup
- **API layer**: `src/utils/api.js` — vanilla `fetch` wrapper, no framework client

### Server (`server/`)

- **Framework**: Express 4 (ESM modules) + better-sqlite3 with WAL mode
- **Port**: 3001 (configurable via `PORT` env)
- **Database**: SQLite at `server/data/study_timer.db` with auto-migration on startup
- **Routes** (all under `/api/`):
  - `records` — CRUD for time records with `auto_type`/`manual_type` classification
  - `tags` — CRUD for secondary sub-tags under a primary tag
  - `primaryTags` — CRUD for user-customizable primary tags
  - `stats` — Aggregated stats by day/week/month with learning/rest breakdowns by tag
  - `todos` — Todo CRUD with auto-rollover of incomplete items to next day
  - `summary` — Monthly summary: daily note aggregation + manual daily summaries
  - `dailySummary` — Manual daily summary text CRUD
  - `export` — Export records as .txt or .docx
- Production: serves `client/dist/` as static files

### Database Schema

- **records** — time segments with mode, duration, auto_type/manual_type, tags, notes, session_id
- **tags** — secondary sub-tags under primary tags (unique constraint on primary_tag + name)
- **primary_tags** — user-managed top-level categories with sort_order
- **daily_summaries** — hand-written daily notes (one per date)
- **todos** — daily todo items with completed flag and rollover tracking

### Key Concepts

- **Three timer modes**: `study` (auto-classify ≥10min → learning, <10min → short_rest), `functional` (always learning), `rest` (always short_rest)
- **Dual-track timing**: Uses absolute `Date.now()` timestamps in refs, never `time += N` accumulators, so timers survive page visibility/sleep events correctly
- **Auto-save**: 3s debounce after records change; immediate save on pause; `sendBeacon` + `localStorage` double backup on page close
- **10-minute threshold**: Segments ≥10min in study mode auto-classify as "learning"; shorter ones as "short_rest". Users can toggle per-record manually.
- **Effective type**: `manual_type` overrides `auto_type` (handled server-side via `getEffectiveType()`)
- **Todo rollover**: Daily auto-copy of incomplete previous-day todos into today's list with `rolled_over` flag
