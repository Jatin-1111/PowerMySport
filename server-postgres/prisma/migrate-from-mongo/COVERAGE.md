# ETL coverage & remaining collections

`etl.ts` implements the migration templates and fully wires **7 core entities**.
Every remaining Mongo collection maps to Postgres by the same mechanics; add a
migrator (copy the closest template) and append it to `RUN_ORDER`.

## Implemented (in `RUN_ORDER`)

`sports`, `users` (+addresses/pushSubscriptions/refundMethods), `coaches`
(+ownVenue/sportPricing/availability/sportAvailability/documents/blockedDates/
payoutMethods), `venues` (+sportPricing/sportImages/openingHours/venueCoaches/
documents/payoutMethods), `bookings` (+payment legs/participants), `wallets`
(+transactions), `reviews` (+reports).

## Remaining — template to reuse

**Flat (Template 1 — `migrateSports`):** `players`* , `disputes`,
`friendConnections`, `notifications`, `scheduledNotifications`*,
`userCalendarEvents`, `venueInquiries`, `coachSubscriptions`,
`coachSubscriptionPackages`, `coachSubscriptionPaymentTransactions`,
`coachClientNotes`, `subscriptionPlans`, `sessionPackages`,
`bookingSlotLocks`, `bookingWaitlists`, `bookingInvitations`,
`bookingPaymentTransactions`, `expertSessions`, `admins`, `adminAuditLogs`,
`analyticsEvents`, `emailVerifications`, `outboxMessages`,
`paymentWebhookEvents`, `rateLimits`, `scholarships`, `universities`,
`athleteStories`, `tournaments`, `tournamentEditions`,
`pathwayExpertVerifications`, `userPathwayProfiles`, `shopWaitlists`,
`shopPaymentTransactions`, `communityReputations`, `communityVotes`,
`blogLikes`.

*`players` has an embedded `paymentHistory[]` + flattened `pathwayState`;
`scheduledNotifications` has a flattened `channels` object — treat like
Template 2's flatten/child handling.

**Parent + children (Template 2 — `migrateUsers/Coaches/Venues`):**
- `experts` → `expert_availability_windows`, `expert_payout_methods`
- `guidanceChatSessions` / `roadmapChatSessions` → their `*_messages`
- `guidanceSubmissions` → `request`/`response` are Json (copy as-is)
- `promocodes` → `promo_code_usages`
- `conciergeRequests` → `concierge_request_documents`
- `communityProfiles` → `community_blocked_users` (+ flatten socialLinks)
- `communityGroups` → `community_group_members` (merge `members[]` + `admins[]`
  into one table with `role`)
- `communityConversations` → `conversation_participants`
- `communityMessages` → `message_read_receipts`, `message_delivery_receipts`
  (+ flatten metadata)
- `communityPosts` → `community_answers` (answers are their own collection —
  migrate posts first, then answers referencing postId)
- `communityReports` → flatten `messageAudit`
- `blogPosts` → `blog_comments`
- `academies` → flatten location/operatingHours(Json)/bank(encrypt);
  `academyVenues`/`academyCoaches` stay Json
- shop: `products` → `product_variants` → `inventory`; `orders` → `order_items`
  (+ flatten shippingAddress); `carts` → `cart_items`; `wishlists` →
  `wishlist_items`
- pathways: `sportpathways`, `sportbasepaths`, `sportstatepaths` — nested arrays
  stay Json (copy as-is; flatten the state-path association/feeRange objects).

## Notes

- Preserve `_id` → `id` for every collection (references depend on it).
- `createMany({ skipDuplicates:true })` for flat collections; per-row `create`
  with nested `create` for parents-with-children.
- Money fields: keep integers (paise). Dates via `new Date(...)`.
- Run `etl:validate` after; extend its `COUNT_CHECKS` as you add collections.
