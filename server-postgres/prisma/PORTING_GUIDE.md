# Porting guide — Mongoose → Prisma (controllers & services)

Every controller/service was **copied verbatim** from the original server, so no
logic is lost. Completing the port = replacing Mongoose query calls with Prisma
calls, file by file. The public function signatures and JSON response shapes
**must stay identical** (frontends depend on them). Work on a machine where
`prisma generate` + `tsc` run so each file compiles green before you move on.

Worked reference: **`prisma/examples/SportsService.prisma.ts`** (full port of
`src/shared/services/SportsService.ts`).

## 0. Access pattern

Replace `import { Model } from "../models/X"` with:

```ts
import prisma from "../../lib/prisma";   // or "../lib/prisma" per depth
```

There are no per-model files anymore — the models live in `schema.prisma` and
are reached as `prisma.<model>` (camelCase, e.g. `prisma.coachSubscription`).
For types, import from `@prisma/client`: `import type { User, Booking } from "@prisma/client"`.

## 1. Query cheat-sheet (patterns actually used in this repo)

| Mongoose | Prisma |
|---|---|
| `Model.find(q)` / `.lean()` | `prisma.model.findMany({ where })` |
| `Model.find(q).sort({f:1}).limit(n).skip(s)` | `findMany({ where, orderBy:{f:'asc'}, take:n, skip:s })` |
| `Model.findById(id)` | `findUnique({ where:{ id } })` |
| `Model.findOne(q)` | `findFirst({ where })` (or `findUnique` on a unique field) |
| `Model.countDocuments(q)` | `count({ where })` |
| `new Model(d).save()` / `Model.create(d)` | `create({ data })` |
| `Model.insertMany(arr)` | `createMany({ data: arr })` |
| `Model.findByIdAndUpdate(id, u, {new:true})` | `update({ where:{id}, data:u })` |
| `Model.updateOne(q,u)` / `updateMany` | `updateMany({ where, data })` |
| `Model.findOneAndUpdate(q,u,{upsert:true,new:true})` | `upsert({ where, create, update })` |
| `Model.deleteOne/deleteMany(q)` | `delete/deleteMany({ where })` |
| `Model.aggregate([...])` | `groupBy` / `aggregate`, or `prisma.$queryRaw` for complex pipelines |
| `.populate('userId')` | `include:{ user:true }` **only if** a relation exists; for our String-FK refs, do a second `findMany({ where:{ id:{ in:[...] } } })` and join in code (helper below) |

### Operator translation

| Mongo | Prisma |
|---|---|
| `{ f: v }` | `{ f: v }` |
| `{ f: { $in: arr } }` | `{ f: { in: arr } }` / arrays: `{ f: { hasSome: arr } }` |
| `{ f: { $ne: v } }` | `{ f: { not: v } }` |
| `{ f: { $gte:a,$lte:b } }` | `{ f: { gte:a, lte:b } }` |
| `{ $or:[...] }` / `{ $and:[...] }` | `{ OR:[...] }` / `{ AND:[...] }` |
| `{ f: /re/i }` | `{ f: { contains:'re', mode:'insensitive' } }` (see §4) |
| array field `{ tags: t }` | `{ tags: { has: t } }` |
| `{ f: { $exists:true } }` | `{ f: { not: null } }` |

### Populate helper for String-FK refs (no relation defined)

```ts
async function attachUsers<T extends { userId: string }>(rows: T[]) {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map(r => r.userId))] } },
  });
  const byId = new Map(users.map(u => [u.id, u]));
  return rows.map(r => ({ ...r, user: byId.get(r.userId) ?? null }));
}
```

## 2. Transactions

Mongoose sessions / multi-step writes → `prisma.$transaction`:

```ts
await prisma.$transaction(async (tx) => {
  const booking = await tx.booking.create({ data });
  await tx.bookingPaymentLeg.createMany({ data: legs });
});
```

Use this for booking creation, payment settlement, wallet debit/credit,
subscription activation — anywhere the Mongo code relied on ordered writes.

## 3. Relocated hook logic (see SCHEMA_CHANGES §11)

- `AuthService` / `AdminService`: bcrypt-hash password before `create`/`update`
  (was a pre-save hook).
- `AcademyOnboardingService`: encrypt/decrypt bank fields with the crypt helper
  + `BANK_ENCRYPTION_KEY` (was getter/setter).
- `EcommerceService`: set `Product.totalStock` and `Inventory.quantityAvailable`
  explicitly before writing (were pre-save hooks).
- `CoachService`: set default `serviceRadiusKm`/`travelBufferTime` for
  FREELANCE/HYBRID (was a pre-save hook).
- Socket-emitting post-save hooks (Booking, CoachSubscription, community
  group/report): call the existing emit helper after the Prisma write. The emit
  helpers/sockets themselves are unchanged.

## 4. Search / geo / TTL (behavioral — see SCHEMA_CHANGES §7–9)

- **Text search** (`SportsService`, `BlogService`, `CommunityService`,
  `ExpertsService`): swap regex for `contains`/`mode:'insensitive'`; for the
  old `$text` endpoints add a `tsvector`+GIN index and query via `$queryRaw`.
- **Geo radius** (`VenueService`, `CoachService`, academy discovery): the old
  `$near`/`$geoWithin` must become PostGIS/earthdistance `$queryRaw`. These are
  the only endpoints that need a genuinely different query, not a mechanical
  swap — do them deliberately.
- **TTL**: remove any reliance on auto-expiry; `ttlSweeper.ts` handles it.

## 5. Normalized children

Where a Mongo doc embedded an array you now write the parent + nested `create`,
or write children separately. Reads that need the children use `include`:

```ts
const booking = await prisma.booking.findUnique({
  where: { id },
  include: { payments: true, participants: true },
});
```

## 6. File-by-file checklist (ordered by dependency / value)

Tick each once its queries compile under `tsc`. Shared/auth first (everything
depends on it), then client core, then the rest.

**shared/** (do first)
- [ ] services/AuthService.ts  ← + password hashing
- [ ] services/EmailVerificationService.ts
- [ ] services/OutboxService.ts
- [ ] services/PaymentService.ts, PhonePeService.ts (PhonePe SDK unchanged; only the txn table writes change)
- [ ] services/SportsService.ts  ← **done in examples/**
- [ ] services/PathwayService.ts, PathwayExpertVerificationService.ts
- [ ] services/guidanceChatService.ts, roadmapChatService.ts, guidanceAiService.ts, chatRateLimitService.ts
- [ ] services/tournamentCalendarService.ts, RealDataScraperService.ts, UserPresenceService.ts, S3Service.ts (S3 unchanged)
- [ ] controllers/WebhookController.ts, ConciergeController.ts, emailVerificationController.ts

**client/** (core booking/venue/coach/expert)
- [ ] services/BookingService.ts  ← transactions + slot locks
- [ ] services/VenueService.ts, VenueOnboardingService.ts  ← geo
- [ ] services/CoachService.ts  ← geo + defaults hook
- [ ] services/ExpertsService.ts, ExpertAvailabilityService.ts
- [ ] services/WalletService.ts  ← transactions
- [ ] services/ReviewService.ts, DisputeService.ts, RefundService.ts
- [ ] services/NotificationService.ts, ScheduledNotificationService.ts, ReminderMonitoringService.ts, pushNotificationService.ts
- [ ] services/FriendService.ts, PromoCodeService.ts, VenueInquiryService.ts
- [ ] services/CoachSubscription*.ts (Service/Package/Payment), CoachClientService.ts
- [ ] services/*AnalyticsService.ts (Academy/Coach/Venue)  ← aggregate → groupBy/$queryRaw
- [ ] controllers/*  (thin — mostly pass-through to the services above)

**community/**
- [ ] services/CommunityService.ts, BlogService.ts, CommunityRealtimeService.ts
- [ ] services/communityPolicy.ts, communityQnaUtils.ts (pure logic — likely no DB changes)
- [ ] controllers/communityController.ts, blogController.ts

**admin/**
- [ ] services/AdminService.ts  ← password hashing
- [ ] services/AcademyOnboardingService.ts  ← bank encryption
- [ ] services/AnalyticsService.ts, AuditLogService.ts, InfraMonitoringService.ts
- [ ] controllers/*  (adminController, statsController ← aggregate, payout, pathwayAdmin, concierge, infra)

**shop/**
- [ ] services/EcommerceService.ts  ← derived fields, transactions
- [ ] services/shopScheduledJobs.ts
- [ ] controllers/EcommerceController.ts, SellerController.ts, WaitlistController.ts

**scripts/** — seeders/scrapers/purge/migration one-offs (port as needed).
**migrations/** — the old numbered Mongo data migrations are historical; do NOT
re-run them against Postgres. Fresh schema comes from `prisma migrate`.
