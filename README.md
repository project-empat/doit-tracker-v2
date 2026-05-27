# DoIt Tracker v2

A guilt-free habit tracker with a momentum-based scoring system. Rewritten on **HonoJS + Vite + Inertia.js + React + daisyUI**.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | [Hono](https://hono.dev) |
| Database | Cloudflare D1 + [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [Auth.js](https://authjs.dev) (Google OAuth) |
| Frontend | [React 19](https://react.dev) with [Inertia.js](https://inertiajs.com) |
| Styling | [daisyUI 5](https://daisyui.com) on Tailwind CSS v4 |
| Icons | [Lucide React](https://lucide.dev) |
| Build | [Vite 8](https://vite.dev) + `@cloudflare/vite-plugin` |

## Getting Started

```bash
# install dependencies
npm install

# start dev server (worker + client HMR)
npm run dev

# build for production
npm run build

# deploy to Cloudflare
npm run deploy
```

## Project Structure

```
src/
├── server/            # Hono worker entry & routes
│   ├── index.ts       # App entry point with inertia middleware
│   ├── root-view.tsx  # Inertia HTML shell
│   ├── auth.ts        # Auth.js integration
│   └── routes/
│       ├── pages.ts   # Page routes (Home, Dashboard, Habits, etc.)
│       └── api.ts     # API routes (dashboard data, habit CRUD)
├── client/            # React + Inertia frontend
│   ├── main.tsx       # Client entry with createInertiaApp
│   ├── app.css        # Tailwind + daisyUI theme
│   ├── Layout.tsx     # Shared layout (navbar, drawer, footer)
│   ├── MomentumChart.tsx
│   └── pages/         # Page components (per Inertia route name)
├── db/
│   ├── schema.ts      # Drizzle schema (users, habits, habit_records)
│   ├── index.ts       # D1 client
│   └── migrations.sql # Raw SQL migration
├── lib/
│   ├── habits.ts      # Business logic: momentum, CRUD, history
│   ├── user.ts        # User DB helpers
│   └── logger.ts
└── cron/
    └── handler.ts     # Daily/weekly missed habit processing
```

## Momentum System

- **Daily habits**: +1 per completion, streak bonus up to +7, penalty for misses (min -3)
- **Weekly habits**: +1 per tracking, +10 bonus when reaching weekly minimum, consecutive success bonus up to +40
- Momentum accumulates over time and is visualized in a 30-day history chart

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with integrated worker |
| `npm run build` | Build client and worker bundles |
| `npm run deploy` | Build + deploy to Cloudflare Workers |
| `npm run cf-typegen` | Generate Cloudflare Workers types |
