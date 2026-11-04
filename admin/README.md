# PowerMySport — Admin

Internal operations console for PowerMySport. Next.js 16 (App Router, Turbopack), React 19. Runs on port 3001 and talks to the same backend API as `client/` and `community/` (`NEXT_PUBLIC_API_URL`, cookie-based session auth via an axios instance with `withCredentials: true`).

## Getting started

```bash
npm install        # from the repo root — this app is an npm workspace
npm run dev         # admin/ — next dev -p 3001
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:5000/api`, i.e. a local `server/`).

## Scripts

| Script                            | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| `npm run dev`                     | Dev server on port 3001                      |
| `npm run build` / `npm start`     | Production build / serve                     |
| `npm run lint`                    | ESLint                                       |
| `npm run typecheck`               | `tsc --noEmit` against `tsconfig.check.json` |
| `npm test` / `npm run test:watch` | Vitest                                       |

## Structure

```
src/
  app/         Next.js App Router routes — the admin panel's page tree lives under app/admin/*
  modules/     Feature modules (business logic + components, grouped by domain)
  lib/         API client (axios instance, concierge API), toast helper
  types/       Shared TS types
  utils/       Generic helpers (cn, format)
```

### `src/modules/`

- `admin` — core admin-panel logic: components, hooks, services, utils shared across admin sections
- `analytics` — analytics dashboards and their data services
- `expert` — expert-management components and services
- `geo` — geo/location services (no UI)
- `onboarding` — academy/venue onboarding flows
- `shared` — cross-module UI primitives (`Button`, `AdminDataTable`, etc.)
- `sports` — sports config and components

### Admin panel sections (`src/app/admin/*`)

academies, academy-onboarding, admins, analytics, audit-log, bookings, change-password, coach-verification, coaches, community-reports, concierge-requests, data-sources, disputes, experts, login, notifications, orders, pathways, payouts, products, profile, promo-codes, refunds, reviews, screenings, support-tickets, user-safety, users, venue-approval, venues, webhook-recovery.

## Testing

A small Vitest suite (`tests/`) covers onboarding-flow hooks and a couple of UI helpers — no architecture-ratchet tests here yet (unlike `client/`, which pins module shape, import boundaries, and file-size budgets).

## Environment variables

See `.env.example`. Only `NEXT_PUBLIC_API_URL` is required to point this app at a running `server/`.
