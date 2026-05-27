# AI Agents Guide

This file helps AI-assisted coding tools understand the project's architecture, conventions, and intent.

## Overview

DoIt Tracker v2 is a rewrite of doit-tracker (SvelteKit) using Hono + Inertia + React. It runs on Cloudflare Workers with D1 database.

## Key Architecture Decisions

### Inertia.js Monolith (No SPA/API split)
Pages are served via `c.render("ComponentName", props)` on the Hono server. The client never fetches raw JSON for page data — Inertia handles that automatically. API routes prefixed `/api/*` exist only for real-time interactions (tracking habits) that need POST without full page navigation.

### Auth.js runs on the Worker
`@auth/core` handles Google OAuth directly in the Cloudflare Worker. Sessions are JWT-based (no session store needed). The `getSession(c)` helper calls the Auth.js `/auth/session` endpoint internally.

### Database
Drizzle ORM with Cloudflare D1 (SQLite). Schema is defined in `src/db/schema.ts`. Raw migrations live in `src/db/migrations.sql`. The DB is initialized once per request via `initializeDb(env)`.

### Momentum Calculation (src/lib/habits.ts)
This is the core business logic. It's complex — 4 public functions:
- `createOrUpdateRecord` — handles tracking with automatic momentum calculation
- `dailyMomentum` / `weeklyMomentum` — momentum for a single day/week
- `momentumHistory` — builds 30-day history by iterating dates and accumulating deltas

The logic accounts for streaks, gaps, consecutive misses, and weekly target bonuses. Tests should cover edge cases in this module.

### Pages API (src/server/routes/pages.ts)
Every route calls `c.render("PageName", props)`. Protected routes use `ensureSession(c)` which redirects to `/login` if no session. The inertia middleware at `src/server/index.ts` wraps all page routes.

### Frontend (src/client/)
React components use `@inertiajs/react` for navigation (`router.post`, `router.reload`). No client-side routing library — Inertia handles that via the server. Data mutations use `router.post('/api/...', data, { preserveScroll: true, ... })` followed by `router.reload()`.

### Styling
daisyUI 5 with a custom `doit-tracker` theme defined in `src/client/app.css`. Tailwind CSS v4 with `@tailwindcss/vite` plugin. The theme uses indigo/purple primary colors.

## Common Tasks

### Adding a new page
1. Add route in `src/server/routes/pages.ts` with `c.render("MyPage", props)`
2. Create `src/client/pages/MyPage.tsx`
3. Client auto-discovers via `import.meta.glob` in `main.tsx`

### Adding an API endpoint
Add handler in `src/server/routes/api.ts`. Prefix with `/api`. No inertia middleware runs on these.

### Modifying database
1. Update `src/db/schema.ts`
2. Update `src/db/migrations.sql`
3. Run migrations on D1: `wrangler d1 execute doit-tracker --file=src/db/migrations.sql`

## Build & Deploy

- **Dev**: `npm run dev` starts Vite with `@cloudflare/vite-plugin`
- **Build**: `vite build` produces `dist/client/` (browser bundle) and `dist/doit_tracker_v2/` (worker bundle)
- **Deploy**: `npm run deploy` runs build then `wrangler deploy`
