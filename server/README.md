# PowerMySport — Server

The backend API for all three frontend apps (`client/`, `admin/`, `community/`). Express 5 + TypeScript, MongoDB (Mongoose), Redis, Socket.IO.

## Getting started

```bash
npm install
npm run dev         # nodemon + ts-node, src/server.ts
```

Copy `.env.example` to `.env`. It documents the real var name (`MONGO_URI`, fixed as of 2026-09-14 — it used to say `MONGODB_URI`, which didn't match `src/config/database.ts`).

**Database split (as of 2026-09-14):** the shared Atlas cluster hosts two separate databases — `dev` (local work, safe to break) and `test` (production — the name is historical and intentionally not renamed; renaming would have required a full data copy against a nearly-full free-tier storage quota). Local `.env` must point `MONGO_URI` at `/dev` explicitly; the deployed production environment's `MONGO_URI` must point at `/test` explicitly. `src/config/database.ts` logs a loud warning on boot if a non-production run ever resolves to `test`, so a misconfigured URI doesn't fail silently again.

## Scripts

| Script                        | Purpose                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                 | Dev server (ts-node + nodemon)                                                   |
| `npm run build` / `npm start` | Compile to `dist/` and clean first / run compiled server                         |
| `npm run lint`                | ESLint on `src`                                                                  |
| `npm run migrate`             | Run `src/migrations/index.ts` (the migration runner)                             |
| `npm run migrate:<name>`      | Run one specific numbered migration directly (~40 of these — see `package.json`) |
| `npm test`                    | Build, then `node --test --test-concurrency=1` against `dist/tests/*.test.js`    |

Numerous other one-off `seed:*`, `scrape:*`, `embed:*`, `backfill:*`, `purge:*` scripts exist for ops tasks — check `package.json` before assuming one doesn't exist.

## Structure

Each domain below follows the same internal shape: `controllers/ models/ routes/ services/ (sockets/)`.

```
src/
  admin/       Admin panel domain — academy onboarding, admin CRUD, data-source admin, pathway guide admin, payouts, stats
  client/      Consumer domain — bookings, coach, venue, experts, wallet, reminders, notifications, roadmap, reviews, support tickets
  community/   Social domain — blog/experience posts, community feed/Q&A
  shop/        Ecommerce domain
  shared/      Cross-cutting domain — auth, sports/federations, geo, AITA rankings, pathway, tournament editions, PhonePe webhook, concierge
  config/      database.ts (Mongoose connect), env.ts, redis.ts
  constants/   Admin permissions enum, Indian states list
  middleware/  auth, rate limiting, caching, error handling, security, zod validation, observability, response transform
  migrations/  42 sequential numbered scripts + index.ts runner — see "Migrations" below
  scripts/     ~60 ops scripts (seeding, scraping, S3 setup/verify, email tests, data fixes)
  tests/       node:test suite (unit + *.integration.test.ts), mongodb-memory-server + supertest
  types/, utils/  Shared types; schedulers (AITA ranking, reminders, experience nudges, scraper), email, JWT, payment/booking helpers, logger
```

## Migrations

Migrations are numbered and one-way (`src/migrations/NN_description.ts`). Run them **before** deploying the code that depends on them — a push to `master` auto-deploys the server, so a migration that loses the race against its own dependent code is a real, previously-hit incident, not a hypothetical.

## Testing

`npm test` builds first, then runs Node's built-in test runner with `--test-concurrency=1` **on purpose** — the suite hits a real (in-memory) MongoDB, and parallel workers contend for it. A red run with an unusually low test count usually means MongoMemoryServer contention, not a real regression; re-run before treating it as a genuine failure.

## Payments

PhonePe is the payment gateway (`@phonepe-pg/pg-sdk-node`) — there is no Stripe or Razorpay dependency despite either being a common assumption.

## AI

Both `@google/genai` (Gemini) and `openai` SDKs are present as dependencies; check which is actually wired into a given feature (roadmap chat, guidance) before assuming one over the other.

## Environment variables

Categories in `.env.example`: MongoDB, JWT/auth cookie, server (`PORT`, `NODE_ENV`), Redis, email (Nodemailer), AWS S3, Google OAuth, `CLIENT_URL`, Web Push VAPID keys, PhonePe, Gemini, pathway scraper config, feature flags (`SHOP_IS_LIVE`, `BOOKING_IS_LIVE`), and pricing/commission rates (`SERVICE_FEE_RATE`, `TAX_RATE`, `PLATFORM_COMMISSION_RATE`, `COMMISSION_GST_RATE` + subscription overrides). A separate `.env.docker` also exists for containerized runs.
