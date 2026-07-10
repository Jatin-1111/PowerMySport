# PowerMySport — PostgreSQL / Prisma backend (`server-postgres`)

This is the PostgreSQL port of the original MongoDB/Mongoose `server`. It keeps
**the same API surface, routes, middleware, auth, sockets, workers, and all
external integrations** (Redis, Socket.IO, PhonePe, AWS S3, email, web-push,
Gemini) — only the **data layer** moves from Mongoose to **Prisma + PostgreSQL**
(full Prisma query API). The three frontends need no changes.

> **Read this whole file before running anything.** It covers current status,
> what's missing / to improve, how to run the server, and how to migrate data.
> Deep-dives live in `prisma/SCHEMA_CHANGES.md`, `prisma/MIGRATION_STRATEGY.md`,
> and `prisma/PORTING_GUIDE.md`.

---

## 1. Current status (be honest about this)

| Area | Status |
|---|---|
| **Prisma schema** — 64 Mongo models → **106 tables, 89 enums**, normalized, **validated** | ✅ Complete |
| DB connection layer (drop-in for the old Mongoose `connectDB`) | ✅ Complete (`src/config/database.ts`, `src/lib/prisma.ts`) |
| Project config (`package.json`, `.env.example`, Prisma scripts) | ✅ Complete |
| Baseline seed + TTL sweeper (replaces Mongo TTL indexes) | ✅ Complete (`prisma/seed.ts`, `src/scripts/ttlSweeper.ts`) |
| Mongo → Postgres ETL + validation | ✅ Framework + 7 core entities; rest documented in `prisma/migrate-from-mongo/COVERAGE.md` |
| Documentation (schema changes, migration, porting guide) | ✅ Complete |
| Reference query port (worked Mongoose→Prisma example) | ✅ Complete (`prisma/examples/SportsService.prisma.ts`) |
| **Controllers/services query port (~90 files, ~52k LOC)** | 🚧 **Partial** — see below |

### Which service files are already ported to Prisma

- `src/shared/services/SportsService.ts`
- `src/shared/services/EmailVerificationService.ts`
- `src/shared/services/OutboxService.ts`
- `src/shared/controllers/emailVerificationController.ts`

**Everything else under `src/**/controllers` and `src/**/services` still
contains the original Mongoose code** (copied verbatim, so no logic is lost) and
must be ported following `prisma/PORTING_GUIDE.md`. The old Mongoose model files
under `src/**/models/*` are kept **only as reference** for the port — they are no
longer the source of truth (the schema is) and should be deleted once their
consumers are ported.

> ⚠️ **The project will not `tsc`-build green until the port is finished**,
> because un-ported files still `import` from `../models/*` (Mongoose) while
> `mongoose` has been removed from `package.json`. This is expected mid-port.
> Port + delete model files domain by domain to reach a green build.

---

## 2. What's missing / still to do

**A. Finish the query port (largest remaining task).** Work the checklist in
`prisma/PORTING_GUIDE.md` §6, in this order (each depends on the previous):

1. `shared/` — **AuthService.ts** (critical: move bcrypt hashing into the
   service; ~1k lines), PaymentService, WebhookController, PathwayService,
   PathwayExpertVerificationService, ConciergeController, chat/pathway services.
2. `client/` core — BookingService (+ transactions/slot locks), VenueService &
   CoachService (**geo — see B**), WalletService, NotificationService,
   ReviewService, ExpertsService, subscriptions, analytics, then controllers.
3. `community/`, `admin/` (AdminService bcrypt; AcademyOnboardingService bank
   encryption), `shop/` (derived fields + transactions).

**B. Geo / radius search (needs deliberate rework, not a mechanical swap).**
GeoJSON became `lng`/`lat` float columns. Mongo `$near` / `$geoWithin` used by
venue & coach discovery has **no Prisma equivalent**. Enable PostGIS (or the
`cube` + `earthdistance` extensions) and implement distance filtering via
`prisma.$queryRaw`. Until then, fall back to city/sports + bounding-box filters.
Affected: `VenueService`, `CoachService`, academy discovery.

**C. Full-text search.** Mongo `$text` indexes on `BlogPost`, `CommunityPost`,
`Expert` are not recreated. Add Postgres `tsvector` + GIN (or `pg_trgm`) via a
manual SQL migration; simple cases can use `contains` + `mode:'insensitive'`.

**D. Manual SQL migrations Prisma can't express** (run once after
`prisma migrate`): the partial-unique index for DM conversations, and the geo /
full-text indexes above. Exact SQL is in `prisma/MIGRATION_STRATEGY.md` §1.

**E. Complete the ETL.** `prisma/migrate-from-mongo/etl.ts` implements 7 core
entities as the template; add the remaining collections per
`prisma/migrate-from-mongo/COVERAGE.md` (each is a mechanical repeat) and extend
`validate.ts`'s count checks accordingly.

**F. Tests.** The `node --test` suites under `src/tests` (security, community,
coach-subscriptions, email) still target Mongo/`mongodb-memory-server`. Re-point
them at a disposable Postgres (e.g. a Docker `postgres` container or
`pg-mem`/Testcontainers) and update fixtures. Not yet done.

**G. Relocated model behavior** (was Mongoose hooks — see `SCHEMA_CHANGES.md`
§11): password hashing, Academy bank-field AES-GCM encryption (needs
`BANK_ENCRYPTION_KEY`), derived fields (`Product.totalStock`,
`Inventory.quantityAvailable`, Coach defaults), and socket emits after writes.

## 3. What should be improved (recommendations)

- **Add real FKs incrementally.** Document-to-document refs are currently plain
  indexed `String` columns (mirroring Mongo's zero integrity). Promote the
  important ones (e.g. `Booking.userId → users`) to real Prisma relations for
  referential integrity once the port is stable.
- **Money as `Int` paise everywhere** is preserved; consider a domain type/helper
  to avoid unit mistakes.
- **Introduce a shared types package.** The frontends still hand-duplicate model
  shapes; Prisma's generated types could be re-exported to kill that drift.
- **Connection pooling / PgBouncer** for serverless/EB scale; size via
  `?connection_limit=` on `DATABASE_URL` (and `pgbouncer=true` if used).
- **Schedule the TTL sweeper** (see §4) — nothing auto-expires in Postgres.
- **Wrap all multi-step writes in `prisma.$transaction`** (booking + payment
  legs, wallet debit/credit, subscription activation) to match Mongo's implicit
  atomicity expectations.
- **CI**: add `prisma validate` + `prisma migrate diff` + `tsc` to the pipeline.

---

## 4. Steps to run the server

**Prerequisites:** Node 20+, PostgreSQL 14+, Redis (as before). On a machine
with network access to npm + Prisma's engine CDN (the sandbox this was built in
could not download Prisma engines, so generate the client on your own machine).

```bash
cd server-postgres

# 1. Environment
cp .env.example .env
#   Edit .env — at minimum set:
#     DATABASE_URL=postgresql://USER:PASS@localhost:5432/powermysport?schema=public&connection_limit=10
#     JWT_SECRET (>=32 chars), REDIS_URL, and the usual S3/PhonePe/email/Gemini keys.
#     BANK_ENCRYPTION_KEY=$(openssl rand -hex 32)   # for Academy bank encryption

# 2. Install deps (auto-runs `prisma generate` via postinstall)
npm install

# 3. Create the database schema
npm run prisma:migrate          # dev: creates + applies prisma/migrations
#   production: npm run prisma:migrate:deploy

# 4. Apply manual SQL Prisma can't express (see prisma/MIGRATION_STRATEGY.md §1)
#    e.g. the DM partial-unique index; geo/full-text indexes when needed.

# 5. Seed baseline data (starter sports)
npm run db:seed

# 6. Run it (same port/behavior as the old server)
npm run dev                     # http://localhost:5000
#   production: npm run build && npm start
```

**Schedule the TTL sweeper** (replaces Mongo TTL auto-expiry) — via cron, an EB
scheduled task, or node-cron inside `server.ts`:

```bash
npm run ttl:sweep               # run every ~5–15 minutes
```

Useful during development:

```bash
npm run prisma:studio           # browse the database in a GUI
npm run prisma:validate         # validate the schema
```

> Reminder: until the query port (§2A) is complete, `npm run build` will report
> type errors in un-ported files. `npm run dev` will run, but only ported routes
> behave correctly. Port + delete `models/*` per domain to reach a green build.

---

## 5. Steps / scripts to migrate the data (Mongo → Postgres)

Full plan in `prisma/MIGRATION_STRATEGY.md`. Scripts live in
`prisma/migrate-from-mongo/`. The ETL **preserves every Mongo `_id` as the
Postgres row `id`**, so all cross-references stay valid with zero remapping.

```bash
cd server-postgres

# 0. Prereqs: DATABASE_URL (target Postgres) + MONGODB_URI (source Mongo) in .env.
#    Create the schema first (Section 4, steps 3–4).

# 1. DRY RUN against a scratch/replica first (never test on prod data)
#    Point DATABASE_URL at a throwaway Postgres and MONGODB_URI at a Mongo dump.
npm run etl:from-mongo          # runs prisma/migrate-from-mongo/etl.ts

# 2. Validate the migration reconciled (row counts + child-table expansion).
#    Exits non-zero if anything doesn't match — do NOT cut over on failure.
npm run etl:validate            # runs prisma/migrate-from-mongo/validate.ts
```

**Coverage note:** `etl.ts` currently migrates 7 core entities end-to-end
(sports, users, coaches, venues, bookings, wallets, reviews — including their
normalized child tables). Before a real cutover, add the remaining collections
to `RUN_ORDER` in `etl.ts` using `prisma/migrate-from-mongo/COVERAGE.md` (each
one is a mechanical repeat of an existing migrator), and add matching checks to
`validate.ts`.

### Recommended production cutover

1. Freeze writes to Mongo (maintenance window) or take a consistent snapshot.
2. Run `etl:from-mongo` against production Postgres, then `etl:validate`.
3. Deploy `server-postgres` pointing at Postgres. **Frontends need no change.**
4. Smoke-test: login, venue/coach discovery, booking + PhonePe webhook
   settlement, community messaging, admin back-office.
5. Keep Mongo read-only as a rollback target for a defined window. (The ETL only
   reads Mongo, so it stays a valid fallback.)

### Rollback

Because the API/contract is unchanged, rollback = redeploy the old Mongo
`server`. Mongo data is never mutated by the ETL.

---

## 6. Reference docs in this repo

- `prisma/schema.prisma` — the schema (source of truth).
- `prisma/SCHEMA_CHANGES.md` — every normalization decision + behavioral diff.
- `prisma/MIGRATION_STRATEGY.md` — end-to-end cutover plan + manual SQL.
- `prisma/PORTING_GUIDE.md` — Mongoose→Prisma cheat-sheet + per-file checklist.
- `prisma/examples/SportsService.prisma.ts` — worked reference port.
- `prisma/migrate-from-mongo/{etl,validate}.ts` + `COVERAGE.md` — data migration.
