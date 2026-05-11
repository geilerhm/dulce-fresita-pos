# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Dulce Fresita is a Spanish-language POS (Point of Sale) and inventory management system for a small business. It's a Next.js 16 PWA backed by a local SQLite database, designed as a mobile-first/tablet app and also packaged as an Electron desktop app (auto-updating via GitHub releases). Default data location is `$HOME/.dulce-fresita/dulce-fresita.db` (override with `DULCE_DB_PATH`).

## Commands

- `npm run dev` — start dev server on **port 3847**. `predev` automatically runs `rebuild:web` (rebuilds `better-sqlite3` + `usb` against Node's ABI).
- `npm run build` — production build with `--max-old-space-size=8192` and `NEXT_TURBOPACK=0` (Turbopack is deliberately disabled).
- `npm run start` / `npm run serve` — run the built Next.js standalone server (`.next/standalone/server.js`).
- `npm run lint` — run ESLint
- `npm run tunnel` — expose local dev via cloudflared (used for the public `/pedir` ordering page).
- `npm run electron:dev` — build web + launch Electron pointed at the standalone server.
- `npm run electron:build` — produce installer via `electron-builder` (NSIS for Windows, DMG for Mac).
- `npm run rebuild:web` / `npm run rebuild:electron` — manually rebuild native modules for Node vs Electron ABI. **You will need to re-run the right one whenever switching between `npm run dev` and `electron:dev`.**
- No test framework is configured.

## Architecture

### Tech Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **better-sqlite3** for local SQLite database on disk (path resolved via `DULCE_DB_PATH`, see *Data file* below)
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **shadcn/ui** components in `src/components/ui/`
- **Framer Motion** for animations
- **PWA** via service worker (`public/sw.js`) and web manifest

### Key Patterns

**Local SQLite database** — two-layer architecture:
- **Client layer** (`src/lib/db/`):
  - `query-builder.ts` — Fluent builder mimicking Supabase API (`from().select().eq().order()` → `{data, error}`). Serializes operations and POSTs to `/api/db`.
  - `client.ts` — `createClient()` returns builder with `.from()` and `.rpc()` methods
  - `company.ts` — `getActiveCompanyId()` reads from localStorage
- **Server layer** (`src/app/api/db/route.ts`, ~570 lines):
  - Single POST endpoint that executes all DB operations against SQLite
  - Handles SELECT (with JOINs), INSERT, UPDATE, DELETE, UPSERT
  - Implements RPCs in transactions: `fn_deduct_inventory`, `fn_reverse_inventory`, `fn_complete_order`. Inventory deduction goes through `convertQuantity` in `src/lib/utils/units.ts` — recipe/ingredient unit mismatches are *skipped with a console warning*, not silently coerced (this was a real bug; see commit `d271262`).
  - `src/lib/db/sqlite.ts` — Database initialization, schema creation, singleton instance. Uses lazy init (`getDb()`) so the DB is never opened during build.

**Data file**: defaults to `$HOME/.dulce-fresita/dulce-fresita.db`. Electron overrides this to `app.getPath("userData")/data/` via the `DULCE_DB_PATH` env var. On first Electron install, `scripts/seed-database.db` is copied in as initial data. The repo-root `data/` directory is gitignored and only used if the env points there.

**Multi-tenant by company_id**: All data queries are scoped to the active company. Each page calls `createClient()` from `src/lib/db/client.ts` and manually chains `.eq("company_id", companyId)`.

**Auth**: `AuthContext` manages users, companies, and login state. User credentials stored in SQLite `users` table. Session flag kept in localStorage (`dulce-fresita-session`). The `AuthGate` component in `AppShell` redirects unauthenticated users to `/login`.

**Provider hierarchy** (in `providers.tsx`): `AuthProvider` → `AuthGate` → `CajaProvider`. The `CartProvider` is scoped locally within the POS page only, not global.

**CajaContext** (cash register): Tracks whether a register is open/closed via local `cash_registers` table. Polls for company changes every 500ms and auto-refreshes register state on company switch.

### Route Structure
- `/` — redirects to `/pos`
- `/pos` — point of sale (product grid + cart)
- `/caja` — cash register management (open/close/history)
- `/inventario` — inventory management
- `/categorias`, `/productos`, `/proveedores`, `/recetas` — CRUD pages
- `/reportes` — sales reports and analytics
- `/dashboard` — overview dashboard
- `/pedidos` — incoming orders from the public ordering page
- `/pedir/...` — **public** customer-facing ordering page (no auth, no shell — see `AppShell.tsx`)
- `/settings`, `/login`
- `/api/db` — internal DB API (POST only)
- `/api/print` — POSIX path: drives the Jaltech POS 80mm thermal printer via USB / `node-thermal-printer`. Hardcoded `VENDOR_ID/PRODUCT_ID` and a 32-char `LINE_WIDTH`. All receipt layout is done by string concat with `padStart`/`padEnd` — *never* via ESC/POS alignment commands (see the "GOLDEN RULE" comment).
- `/api/update-check` — version check for the Electron auto-updater

### Layout
`AppShell` wraps all authenticated routes with a `Sidebar` navigation, `OfflineBanner`, `KeyboardShortcuts`, and `ServiceWorkerRegister`. Renders shell only when user is authenticated AND an active company is selected AND the path is not public. `/login` and `/pedir/*` always render without the shell.

### Electron desktop app
- Entry: `electron/main.js`. Spawns the standalone Next.js server on a free port, then loads it in a `BrowserWindow`.
- On first launch (or after version change), extracts `.next/standalone` from `resources/` into `userData/server/` and renames `_node_modules → node_modules` (electron-builder ships them prefixed to avoid being stripped).
- `fixNativeModules()` overwrites `better_sqlite3.node` copies under `.next/node_modules/` with the correct ABI binary from root `node_modules/` — Next.js sometimes copies a wrong-ABI build during `next build`.
- `electron/preload.js` exposes `window.electronAPI` to the renderer: `getPrinters()` and `printSilent(html, printerName)`. **There are therefore two printing paths**: USB ESC/POS via `/api/print` (for the Jaltech POS), and Electron's silent HTML print via IPC (for any OS-installed printer). Renderer code should feature-detect `window.electronAPI`.
- Auto-update via `electron-updater` against GitHub releases (`geilerhm/dulce-fresita-pos`).

### Optional cloud sync
`src/lib/supabase-cloud.ts` + `src/lib/hooks/useCloudSync.ts` push local products/categories into a Supabase mirror (`*_cache` tables) and pull orders submitted from `/pedir` back into the local DB. Sync runs every 10s when `CloudSyncProvider` is mounted. The hardcoded Supabase URL/anon key in `supabase-cloud.ts` are *publishable* keys (not secrets) — the cloud DB is intentionally a thin relay, not the source of truth.

### Styling
Custom pink primary color (`#e84c65`) is configured in `tailwind.config.ts`. The app uses shadcn/ui components and plain Tailwind CSS for styling.

### Conventions
- All UI text is in **Spanish**
- Currency formatting uses Colombian peso (COP) conventions with `es-CO` locale (via `src/lib/utils/format.ts`)
- The `@/` path alias maps to `src/`
