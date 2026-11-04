# PowerMySport — Client

The main player/customer-facing app: sport discovery, bookings (venues/coaches/experts/academies), tournaments and federations, the shop, and the AI guidance/roadmap flows. Next.js 16 (App Router, Turbopack), React 19. Runs on port 3000.

## Getting started

```bash
npm install        # from the repo root — this app is an npm workspace
npm run dev         # client/ — next dev -p 3000
```

Copy `.env.example` to `.env.local` — it is heavily commented in-repo (required vars, route-protection JWT, public URLs, feature flags) and is the source of truth; don't duplicate its contents here.

## Scripts

| Script                            | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `npm run dev`                     | Dev server on port 3000                             |
| `npm run build` / `npm start`     | Production build / serve (prebuild clears `.next`)  |
| `npm run lint`                    | ESLint (includes module-boundary rules — see below) |
| `npm run typecheck`               | `tsc --noEmit` against `tsconfig.check.json`        |
| `npm test` / `npm run test:watch` | Vitest                                              |

## Structure

```
src/
  app/         Next.js App Router routes, grouped as (auth) (booking) (expert) (marketing) (shop)
  modules/     Feature modules — business logic + components per domain (see below)
  components/  Shared cross-app UI: layout, legal, seo
  flow/        Custom flow/state-machine layer (defineFlow, policy, session, useFlow)
  hooks/       App-wide hooks (useFriendSocket, useNotifications)
  lib/         API client, query setup, community/shop helpers, seo, toast, indianStates
  types/       Shared TS types
  utils/       Pure helpers (cn, date, format, location, venueImages)
  proxy.ts     Next's edge proxy — route protection
```

### `src/modules/` (feature domains)

analytics, auth, booking, coach, community, discovery, expert, federations, find-sport, geo, guidance, legal, marketing, onboarding, pathway, player, rankings, review, shared (cross-module UI primitives/store/services), shop, sports, venue, venue-inquiry, wallet.

**Module boundary rule:** `src/modules/*` must never import from `src/app/*` (routes are composition, not shared logic — the reverse direction is fine). Shared code goes in `src/modules/shared`. This is enforced by an ESLint `no-restricted-imports` rule, itself guarded by `tests/boundaries.test.ts` (a flat-config rule can be silently shadowed by a later block redeclaring the same rule — that test exists specifically to catch that).

## Architecture-ratchet tests (`tests/`)

Beyond ordinary component/page tests (coach billing, coach/venue detail clients, contact page, expert onboarding, etc.), three tests actively pin the codebase's shape:

- **`moduleShape.test.ts`** — every `src/modules/<feature>/` subdirectory name must be one of a fixed canonical set (`components`, `config`, `data`, `hooks`, `services`, `store`, `types`, `ui`, `utils`).
- **`boundaries.test.ts`** — lints synthetic files at real paths to confirm the module-boundary ESLint rule actually fires.
- **`oversizedFiles.test.ts`** + `oversizedFiles.json` — a one-way ratchet capping `src/app/*` file line counts at 400 by default. A new file over 400 lines, or a tracked file growing past its recorded budget, fails outright. A tracked entry that's gone stale (file shrunk or was deleted) also fails — the budget list must be actively maintained, not just appended to. When a file must legitimately exceed budget, either extract logic into `src/modules/` first, or bump the recorded number as a deliberate commit (never silently).

## Environment variables

See `.env.example` — read it directly; it documents _why_ each variable exists, not just its name.
