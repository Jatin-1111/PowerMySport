// ─── In-process cache for an admin's role, permissions and active flag ──────
//
// `requirePermission` and its siblings looked the admin up in Mongo on every
// request, so an admin page that fires several calls on load paid that round
// trip once per call. This keeps the answer in memory for a few seconds.
//
// It is deliberately in-process rather than Redis: it works with Redis off, and
// a cache hit costs nothing instead of a network hop.
//
// Staleness: a demoted or deactivated admin keeps their old access for at most
// TTL_MS. Writes made through the Admin model clear the cache at once on the
// instance that made them (see the hooks in models/Admin.ts); other instances,
// and scripts run from a shell, are covered by the TTL alone. The TTL matches
// the 15 s account-status cache in middleware/auth.ts: do not lengthen it
// without re-confirming that trade-off.

export interface AdminAuthRecord {
  role: string;
  permissions: string[];
  isActive: boolean;
}

export const ADMIN_AUTH_TTL_MS = 15_000;
// Admins are a handful of people; the cap only guards against a runaway.
const MAX_ENTRIES = 500;

const entries = new Map<string, { record: AdminAuthRecord; expiresAt: number }>();

export const getCachedAdminAuth = (
  id: string,
  now: number = Date.now()
): AdminAuthRecord | null => {
  const hit = entries.get(id);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    entries.delete(id);
    return null;
  }
  return hit.record;
};

export const cacheAdminAuth = (
  id: string,
  record: AdminAuthRecord,
  now: number = Date.now()
): void => {
  if (entries.size >= MAX_ENTRIES && !entries.has(id)) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(id, { record, expiresAt: now + ADMIN_AUTH_TTL_MS });
};

/** Drop one admin, or everyone when no id is given (a query write has no single id). */
export const invalidateAdminAuth = (id?: string): void => {
  if (id === undefined) entries.clear();
  else entries.delete(id);
};
