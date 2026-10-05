/**
 * Retention and index definitions for `analyticsevents`, defined once.
 *
 * `AnalyticsEvent.ts` (its `schema.index` call) and migration 51 both read this,
 * so the model and the migration cannot drift. Plain data on purpose, with no
 * mongoose import: the migration must not load the model, because importing a
 * model while `autoIndex` is on creates its indexes in whatever database the
 * connection points at.
 *
 * Why a TTL, and why only on guest events. The guest ingest endpoint is public
 * and unauthenticated, so it is the one writer anybody on the internet can drive,
 * and this collection had no retention at all: the only way events left was an
 * admin deleting everything by hand. The TTL is PARTIAL on `guestId`:
 *   • guest events are the abuse surface and are only ever read through windows
 *     of at most 90 days (`getGuestActivity` caps `days` at 90), so expiring them
 *     at 90 days loses nothing the admin views can show;
 *   • signed-in funnel events and `unsupported_sport_search` carry no `guestId`
 *     and are untouched. The unsupported-sports view reads up to 365 days, so a
 *     blanket TTL here would have silently shortened it.
 */
export const GUEST_EVENT_TTL_DAYS = 90;

export const GUEST_EVENT_TTL_INDEX = {
  name: "guest_events_ttl",
  key: { createdAt: 1 } as Record<string, 1 | -1>,
  expireAfterSeconds: GUEST_EVENT_TTL_DAYS * 24 * 60 * 60,
  partialFilterExpression: { guestId: { $type: "string" } } as Record<string, unknown>,
};

/**
 * Single-field indexes that another index already serves. Each is the leading
 * key of a compound index that stays, or (`source`) too low in cardinality to
 * help any query here. They cost write amplification and, on M0, quota: about
 * 0.76 MB of the collection's 2.68 MB of index at the 2026-10-04 probe.
 */
export const REDUNDANT_ANALYTICS_INDEXES: Array<{
  name: string;
  key: Record<string, 1 | -1>;
  /** Why it can go. */
  coveredBy: string;
  /** An index that must exist before this one is dropped, so no query loses its index. */
  requires?: string;
}> = [
  {
    name: "userId_1",
    key: { userId: 1 },
    coveredBy: "userId_1_createdAt_-1",
    requires: "userId_1_createdAt_-1",
  },
  {
    name: "eventName_1",
    key: { eventName: 1 },
    coveredBy: "eventName_1_createdAt_-1",
    requires: "eventName_1_createdAt_-1",
  },
  {
    name: "guestId_1",
    key: { guestId: 1 },
    coveredBy: "guestId_1_createdAt_-1",
    requires: "guestId_1_createdAt_-1",
  },
  // Three values (WEB, MOBILE, SERVER): an index on it alone never narrows a scan.
  { name: "source_1", key: { source: 1 }, coveredBy: "nothing; too low in cardinality to help" },
];
