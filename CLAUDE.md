# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Dulce Fresita is a Spanish-language POS (Point of Sale) and inventory management system for a small business. It's a Next.js 16 PWA with a local SQLite database on disk, designed as a mobile-first/tablet app. All data persists in `data/dulce-fresita.db`.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (uses `--max-old-space-size=8192`)
- `npm run lint` — run ESLint
- No test framework is configured

## Architecture

### Tech Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **better-sqlite3** for local SQLite database on disk (`data/dulce-fresita.db`)
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
- **Server layer** (`src/app/api/db/route.ts`):
  - Single POST endpoint that executes all DB operations against SQLite
  - Handles SELECT (with JOINs), INSERT, UPDATE, DELETE, UPSERT
  - Implements RPCs: `fn_deduct_inventory`, `fn_reverse_inventory` with transactions
  - `src/lib/db/sqlite.ts` — Database initialization, schema creation, singleton instance

**Data file**: `data/dulce-fresita.db` (auto-created on first run, gitignored). This file can be backed up/copied.

**Multi-tenant by company_id**: All data queries are scoped to the active company. Each page calls `createClient()` from `src/lib/db/client.ts` and manually chains `.eq("company_id", companyId)`.

**Auth**: `AuthContext` manages users, companies, and login state. User credentials stored in SQLite `users` table. Session flag kept in localStorage (`dulce-fresita-session`). The `AuthGate` component in `AppShell` redirects unauthenticated users to `/login`.

**Provider hierarchy** (in `providers.tsx`): `AuthProvider` → `AuthGate` → `CajaProvider`. The `CartProvider` is scoped locally within the POS page only, not global.

**CajaContext** (cash register): Tracks whether a register is open/closed via local `cash_registers` table. Polls for company changes every 500ms and auto-refreshes register state on company switch.

### Route Structure
- `/` — redirects to `/pos`
- `/pos` — point of sale (product grid + cart)
- `/caja` — cash register management (open/close/history)
- `/inventario` — inventory management
- `/categorias` — category CRUD
- `/productos` — product catalog CRUD
- `/proveedores` — supplier management and pricing
- `/recetas` — recipe management
- `/reportes` — sales reports and analytics
- `/dashboard` — overview dashboard
- `/settings` — app settings
- `/login` — authentication
- `/api/db` — internal DB API (POST only)

### Layout
`AppShell` wraps all authenticated routes with a `Sidebar` navigation, `OfflineBanner`, `KeyboardShortcuts`, and `ServiceWorkerRegister`. Only renders shell when user is authenticated AND an active company is selected. Login page renders without the shell.

### Styling
Custom pink primary color (`#e84c65`) is configured in `tailwind.config.ts`. The app uses shadcn/ui components and plain Tailwind CSS for styling.

### Conventions
- All UI text is in **Spanish**
- Currency formatting uses Colombian peso (COP) conventions with `es-CO` locale (via `src/lib/utils/format.ts`)
- The `@/` path alias maps to `src/`
