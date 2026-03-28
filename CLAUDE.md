# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Dulce Fresita is a Spanish-language POS (Point of Sale) and inventory management system for a small business. It's a Next.js 16 PWA with Supabase as the backend, designed as a mobile-first/tablet app with offline support.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- No test framework is configured

## Architecture

### Tech Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** for database (auth is localStorage-based, not Supabase Auth)
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **shadcn/ui** components in `src/components/ui/`
- **Framer Motion** for animations
- **PWA** via service worker (`public/sw.js`) and web manifest

### Key Patterns

**Multi-tenant by company_id**: All Supabase data queries are scoped to the active company. Use `createCompanyClient()` from `src/lib/supabase/company-client.ts` for queries — it auto-injects `company_id` filters on select/insert/upsert. For hooks/effects, `useCompanySupabase()` and `getCompanySupabase()` from `useCompanyQuery.ts` provide the client + companyId pair.

**Auth is localStorage-only**: `AuthContext` manages users, companies, and login state entirely in localStorage (no Supabase Auth). The `AuthGate` component in `AppShell` redirects unauthenticated users to `/login`.

**Provider hierarchy** (in `providers.tsx`): `RouterProvider` → `AuthProvider` → `AuthGate` → `CajaProvider`. The `CartProvider` is used locally within the POS page, not globally.

**CajaContext** (cash register): Tracks whether a register is open/closed via Supabase `cash_registers` table. Caches state in localStorage for offline resilience. Polls for company changes every 500ms.

### Route Structure
- `/` — redirects to `/pos`
- `/pos` — point of sale (product grid + cart)
- `/caja` — cash register management (open/close/history)
- `/inventario` — inventory management
- `/productos` — product catalog CRUD
- `/recetas` — recipe management
- `/reportes` — sales reports and analytics
- `/dashboard` — overview dashboard
- `/settings` — app settings
- `/login` — authentication

### Layout
`AppShell` wraps all authenticated routes with a `Sidebar` navigation, `OfflineBanner`, `KeyboardShortcuts`, and `ServiceWorkerRegister`. Login page renders without the shell.

### Database Setup
`scripts/setup-db.js` creates the Supabase schema and `scripts/seed.js` seeds sample data. These run directly against the database.

### Styling
Custom pink primary color (`#e84c65`) is configured in `tailwind.config.ts`. The app uses shadcn/ui components and plain Tailwind CSS for styling.

### Conventions
- All UI text is in **Spanish**
- Currency formatting uses Mexican peso conventions (via `src/lib/utils/format.ts`)
- The `@/` path alias maps to `src/`
