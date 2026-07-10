# Schema changes & assumptions — MongoDB → PostgreSQL (Prisma)

This documents every structural decision taken porting the ~64 Mongoose models
into the normalized Prisma schema (`prisma/schema.prisma` — 106 tables, 89
enums), plus behaviors that differ from MongoDB. Read alongside
`MIGRATION_STRATEGY.md`.

## 1. Identity / primary keys

- Every PK is `id String @id @default(cuid())`.
- **Rows migrated from Mongo keep their original 24-char ObjectId hex string as
  `id`.** New rows created by the app get a `cuid()`. This lets every existing
  cross-document reference (`userId`, `coachId`, `bookingId`, …) survive the ETL
  with **no id remapping**.
- Consequence: id columns are variable-length strings (hex *or* cuid), not
  Postgres `uuid`. This is intentional and required for a zero-remap migration.

## 2. References & foreign keys (the big decision)

Mongo "refs" are just ObjectIds with **no enforced constraint**. We split them
into two categories:

- **Structural / ownership relations → real Prisma relations with FKs and
  `onDelete: Cascade`.** These are the embedded arrays/objects that were
  normalized out of a parent document and have no independent existence, e.g.
  `Booking → payments/participants`, `Coach → documents/availability/…`,
  `Order → items`, `Product → variants → inventory`, `Wallet → transactions`,
  `Review → reports`, `User → addresses/pushSubscriptions/refundMethods`,
  community group members, conversation participants, message receipts, etc.
- **Document-to-document references → plain indexed `String` columns, no FK**
  (e.g. `Booking.userId`, `Booking.coachId`, `Notification.userId`,
  `CoachSubscription.packageId`). This mirrors Mongo exactly (no integrity
  enforcement), keeps the 106-table graph tractable, and — importantly — means
  the ETL does not have to satisfy a strict global insert order.

**Why not FK-everything?** A 106-table graph with many optional and cross-domain
references, plus genuinely polymorphic references (below), would make both the
schema and the ETL brittle for little practical gain over Mongo's current
(zero) integrity guarantees. If you want stricter integrity later, promote
specific `String` FK columns to relations incrementally.

## 3. Polymorphic references → `targetType` + `targetId` strings

Relational databases can't point one FK at several tables. These stay as an
enum/string discriminator + a string id, exactly as in Mongo:

- `Review.targetType/targetId` (VENUE | Coach | PRODUCT)
- `CommunityVote.targetType/targetId`, `BlogLike.targetType/targetId`,
  `CommunityReport.targetType/targetId`
- `BookingSlotLock.resourceType/resourceId`
- `SupportTicketNote.authorType/authorId`

## 4. Embedded arrays & maps → child tables (normalization)

Every embedded sub-document array and every `Map<string,…>` became a child
table with a FK to its parent. Highlights:

| Mongo (embedded) | Postgres (table) |
|---|---|
| `Booking.payments[]`, `.participants[]` | `booking_payment_legs`, `booking_participants` |
| `User.addresses[]`, `.pushSubscriptions[]`, `.refundMethods[]` | `user_addresses`, `user_push_subscriptions`, `user_refund_methods` |
| `Coach.sportPricing{}` (Map) | `coach_sport_pricing` |
| `Coach.availabilityBySport{}` (Map→array) | `coach_sport_availability` |
| `Coach/Venue/Expert.payoutMethods[]` | `*_payout_methods` |
| `Venue.openingHours{}` (7-day object) | `venue_opening_hours` (one row/day; `slots` kept as JSON) |
| `Venue.sportImages{}` / `sportImageKeys{}` | `venue_sport_images` |
| `Wallet.transactions[]` | `wallet_transactions` (subdoc `id` → `externalId`) |
| `Product.variants[]` (+ `Inventory` 1:1) | `product_variants`, `inventory` |
| `Order.items[]` | `order_items`; `shippingAddress` flattened onto `orders` |
| `Cart.items[]` | `cart_items` |
| `Wishlist.products[]` | `wishlist_items` |
| `PromoCode.usedBy[]` | `promo_code_usages` |
| `Community* / Blog*` member/participant/receipt/tag arrays | dedicated link tables |
| chat `messages[]` (guidance/roadmap) | `guidance_chat_messages`, `roadmap_chat_messages` |
| `ConciergeRequest.documents[]` | `concierge_request_documents` |

Single embedded objects were **flattened onto the parent** with a prefix (e.g.
`CommunityProfile.socialLinks.*` → `sl*`, `CommunityMessage.metadata.*` →
`meta*`, `ScheduledNotification.channels.*` → `ch*`, `Product.dimensions.*` →
`dim*`, `Order.shippingAddress.*` → `ship*`, `Player.pathwayState.*` → `ps*`,
`Sport.attributes.*` → `attr*`, `Tournament.federation.*` → `fed*`,
`SportStatePath.stateAssociation/feeRange` → `sa*`/`fee*`).

## 5. Documented deviation: scalar arrays stay as `String[]`

Atomic scalar arrays (`sports`, `tags`, `amenities`, `certifications`,
`languages`, `ageGroups`, S3 key lists, `sourceUrls`, `prerequisiteGuide`, …)
are kept as **native Postgres `String[]`**, not join tables. Normalizing atoms
would add ~30 trivial tables with no relational benefit; Postgres arrays are
first-class and Prisma filters (`has`, `hasSome`, `hasEvery`) map cleanly to the
old Mongo `$in` / equality-on-array queries. **This is the single place we did
not "turn every array into a table."** Say the word if you want strict
normalization of these too.

## 6. Fields kept as `Json` (pragmatic, documented)

- **Mongo `Mixed`** → `Json`: outbox/webhook payloads, PhonePe callback/status
  payloads, `Notification.data`, `ScheduledNotification.data`,
  `AdminAuditLog.metadata`, `AnalyticsEvent.metadata`, `UserPathwayProfile.*`.
- **AI / content documents** kept as structured `Json` rather than ~15 child
  tables, because they are produced and consumed as whole documents:
  `GuidanceSubmission.request/response`, and the nested arrays on
  `SportPathway` (`levels/tournaments/scholarships/universities/equipment/
  careers`), `SportBasePath`, `SportStatePath`. Top-level pathway fields and
  indexes are preserved; only the deep nested content is JSON.
- **User preference blobs** (`legalConsents`, `notificationPreferences`,
  `reminderPreferences`, `shippingAddress`) kept as `Json` — pure config,
  never queried relationally (would otherwise be ~30 boolean columns).
- `Academy.academyVenues/academyCoaches` were already `Mixed` in Mongo → `Json`.
  `Academy.operatingHours` → `Json` (7-day object).

## 7. GeoJSON → lat/lng columns (behavioral change ⚠️)

`{ type:"Point", coordinates:[lng,lat] }` (with a `2dsphere` index) became two
`Float` columns: `lng`, `lat` (`baseLng/baseLat` on Coach). **Mongo `$near` /
`$geoWithin` radius queries have no direct Prisma equivalent** and must be
re-implemented. Recommended: enable PostGIS (or the `earthdistance` +
`cube` extensions) and do distance filtering in a `prisma.$queryRaw` for the
venue/coach discovery endpoints. Affected: `venues`, `coaches` (baseLocation +
ownVenue), `academies`. Flagged again in `PORTING_GUIDE.md`.

## 8. TTL indexes → cron sweeper (behavioral change ⚠️)

Postgres has no TTL. The Mongo `expireAfterSeconds` indexes are replaced by
`src/scripts/ttlSweeper.ts` (run on a schedule). Affected tables keep their
`expiresAt`/`resetAt`/`lastLockedAt` column + index: `notifications`,
`booking_slot_locks`, `booking_invitations`, `scheduled_notifications`,
`email_verifications`, `rate_limits`, `carts`.

## 9. Full-text / regex search (behavioral change ⚠️)

- Mongo `$text` indexes (on `BlogPost`, `CommunityPost`, `Expert`) are **not**
  recreated as-is. Use Postgres full-text (`tsvector` + GIN) or `pg_trgm`, added
  via a manual SQL migration. For simple cases, Prisma `contains` +
  `mode:'insensitive'` (ILIKE) is enough (see the SportsService reference port).
- Regex `find({ field: /re/i })` → `contains`/`startsWith` with
  `mode:'insensitive'`. Anchored/complex regex needs `$queryRaw` with `~*`.

## 10. Partial / sparse unique indexes

- **Partial unique** `CommunityConversation.participantKey` (DM-only) can't be
  expressed in Prisma schema → add via raw SQL migration:
  `CREATE UNIQUE INDEX participantkey_dm_unique ON community_conversations
  (participant_key) WHERE conversation_type = 'DM' AND participant_key IS NOT NULL;`
- **Sparse unique** (`User.googleId`, `CommunityGroup.inviteCode`,
  `CommunityProfile.username`, `Tournament.slug`) → in Postgres a `UNIQUE` on a
  nullable column is already "sparse" (multiple NULLs allowed). Handled natively.

## 11. App-layer logic that used to be Mongoose hooks

Prisma has no schema hooks/virtuals/methods. Move these into the service layer:

- **Password hashing** (`User`, `Admin` pre-save bcrypt) → hash in AuthService /
  AdminService before `create`/`update`.
- **Academy bank-field AES-256-GCM encryption** (getter/setter) → a small crypt
  helper called on read/write. Requires `BANK_ENCRYPTION_KEY` (added to
  `.env.example`). Encrypted values remain strings.
- **Derived fields**: `Product.totalStock` (sum of variant stock),
  `Inventory.quantityAvailable` (onHand − reserved), `Coach` default
  `serviceRadiusKm/travelBufferTime` for FREELANCE/HYBRID → compute in the
  service before writing.
- **Socket-emitting post-save hooks** (Booking, CoachSubscription, community
  group/report) → call the existing socket emit helpers from the service after
  the Prisma write (the emit helpers themselves are unchanged).

## 12. Enums

Fixed-value fields whose values are valid identifiers became **native Prisma
enums** (89 of them). Enums whose values contain spaces, ampersands, hyphens or
leading digits stay `String` with app-layer validation (unchanged from Mongo):
`Sport.category` / `Academy`+`Product` free-form-ish, `CommunityPost.category`
("Injury & Recovery"), `ScheduledNotification.interval` ("24_HOURS"),
`Notification.type` (30+ values — kept String), guidance verdict/burnout, sport
`interactionType` ("head-to-head"), `CommunityGroup.visibility`,
`TournamentEdition.status`, `SportPathway`/state statuses.

## 13. Misc mappings

- Money fields documented as *paise* are `Int` (never float).
- `timestamps:true` → `createdAt DateTime @default(now())` +
  `updatedAt DateTime @updatedAt`. Audit-log (createdAt-only) has no `updatedAt`.
- `CoachClientNote`, single-collection `User` discriminator (`userType`) → one
  `users` table with a `userType` enum column (no table-per-type).
- Duplicate index on `CommunityReport` collapsed to one.
- `ExpertSession` review fields stay inline on `expert_sessions` (they were
  embedded on the booking in Mongo, not in the `reviews` collection).
