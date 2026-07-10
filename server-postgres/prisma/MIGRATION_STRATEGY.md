# Migration strategy — MongoDB → PostgreSQL

End-to-end plan to stand up the Postgres schema and move existing production
data across with validation and a safe cutover.

## Phase 0 — Prereqs

- PostgreSQL 14+ reachable via `DATABASE_URL` (see `.env.example`).
- Redis + all the usual secrets unchanged (this port does not touch them).
- Access to the source Mongo database via `MONGODB_URI`.
- `npm install` (runs `prisma generate`).

## Phase 1 — Create the schema

```bash
npm run prisma:migrate          # dev: creates prisma/migrations + applies it
# production:
npm run prisma:migrate:deploy
```

Then apply the **manual SQL migrations** Prisma can't express (run once, via
`psql` or a follow-up empty migration):

1. Partial-unique for DM conversations:
   ```sql
   CREATE UNIQUE INDEX participantkey_dm_unique
     ON community_conversations (participant_key)
     WHERE conversation_type = 'DM' AND participant_key IS NOT NULL;
   ```
2. (Optional now, required before geo search) PostGIS / earthdistance for
   venue/coach radius queries — see `SCHEMA_CHANGES.md` §7.
3. (Optional) Full-text GIN indexes for blog/post/expert search — §9.

## Phase 2 — Dry-run the ETL against a copy

```bash
# point DATABASE_URL at a scratch Postgres, MONGODB_URI at a Mongo dump/replica
npm run etl:from-mongo
npm run etl:validate            # row-count + child-expansion parity checks
```

The ETL preserves Mongo `_id` as the Postgres PK, so all references stay valid.
`etl.ts` fully implements 7 core entities (sports, users, coaches, venues,
bookings, wallets, reviews) as the canonical template; extend `RUN_ORDER` for
the remaining collections using `COVERAGE.md` (each is a mechanical repeat of an
existing migrator). `validate.ts` fails non-zero if counts don't reconcile.

## Phase 3 — Complete the code port

Finish the controller/service query port per `PORTING_GUIDE.md` on a machine
where `prisma generate` + `tsc` run, so each file is type-checked green before
moving on. Run the (Postgres-adapted) test suites as you go.

## Phase 4 — Cutover

Recommended low-risk sequence:

1. Freeze writes to Mongo (maintenance window) or run a final incremental sync.
2. Run `etl:from-mongo` against production Postgres; run `etl:validate`.
3. Deploy `server-postgres` pointing at Postgres. Frontends need **no change**
   (API contracts preserved).
4. Smoke-test the critical flows: auth/login, venue/coach discovery, booking +
   PhonePe webhook settlement, community messaging, admin back-office.
5. Keep Mongo read-only as a rollback target for a defined window.

## Rollback

Because the frontends and API are unchanged, rollback is: repoint DNS/deploy
back to the old Mongo `server`. Mongo data was never mutated by the ETL (it only
reads), so it remains a valid fallback for the cutover window.

## Operational deltas to schedule

- **TTL sweeper**: schedule `npm run ttl:sweep` (e.g. every 5–15 min) — replaces
  Mongo TTL auto-expiry. Wire into the existing node-cron worker set in
  `server.ts` or an external scheduler.
- **Connection pool**: sized via `?connection_limit=` on `DATABASE_URL` (was
  `MONGO_MAX_POOL_SIZE`).
