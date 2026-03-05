# Good Deeds - Family Allowance Tracker

A mobile-first web app for tracking children's good and bad deeds and calculating weekly allowances. Built for the Romani family, with a Hebrew (RTL) interface.

## Tech Stack

- **React 18** with Vite 5
- **localStorage** for offline data persistence
- **Supabase** for free realtime cloud sync across devices
- **CSS-in-JS** inline styles with dark theme

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm (comes with Node.js)

## Installation

```bash
npm install
```

## Running

### Development server

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173) by default.

### Production build

```bash
npm run build
npm run preview
```

`build` creates an optimized bundle in the `dist/` folder. `preview` serves it locally.

## How It Works

- **3 children** are tracked with individual profiles (name, age, avatar, color)
- **Good deeds** (12 predefined + custom) add points; **bad deeds** (10 predefined) subtract points
- **Allowance calculation**: Each good deed earns ~₪0.125. 40 good deeds = ₪5 base, 20 more = ₪2.50 bonus (max ₪7.50/week)
- **Bad deeds subtract from money earned** (₪0.125 each) but the balance never goes below ₪0. Good deeds always count — bad deeds only reduce the amount earned
- **Special deeds** (marked with a trophy or stop sign) count double
- **Weekly cycle** runs Sunday to Saturday with navigation between weeks
- All data is saved to the browser's localStorage and persists across sessions
- **Multi-device sync** via Supabase (see below)

## Multi-Device Sync

### One-time Supabase setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of [`public/setup.sql`](public/setup.sql) — this creates 4 tables: `kids`, `logs`, `custom_good_deeds`, `custom_bad_deeds`
3. Enable Realtime on all 4 tables: go to **Database > Replication** and toggle them on
4. Kids are auto-seeded by the app on first load

### Environment variables

Copy your **Project URL** and **anon key** from Supabase (Settings > API) and set them as environment variables:

```bash
# .env (local development)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

On **Vercel**, add these same variables in Settings > Environment Variables.

See `.env.example` for reference. The anon key is safe to expose — it's a public key restricted by Row Level Security.

Without these variables, the app still works fine using localStorage only (no sync).

Changes sync instantly via Supabase Realtime (WebSocket). The app works offline too — localStorage is always kept as a fallback.

## Project Structure

```
good-deeds/
├── index.html          # HTML entry point (Hebrew, RTL, dark theme)
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
├── public/
│   └── favicon.svg     # Star emoji favicon
└── src/
    ├── main.jsx        # React entry point
    ├── App.jsx         # Entire application (components, styles, logic)
    └── sync.js         # Supabase sync utility
```
