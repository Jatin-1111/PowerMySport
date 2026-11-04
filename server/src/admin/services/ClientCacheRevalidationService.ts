import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("client-revalidate");

// ─── Telling the client app its cached copy is stale ─────────────────────────
//
// The client renders a guide on the server and caches the fetch, so a CMS edit
// is invisible to readers until that cache lets go. Waiting was not good enough:
// a guide edited on 20 Sept was still being served to parents on 22 Sept, an
// hour-long TTL notwithstanding. So the write side now says when it wrote.
//
// Deliberately fire-and-forget. A purge that fails must never fail the save the
// admin just made: the content is already in Mongo, the TTL will eventually pick
// it up, and an editor who cannot save because a cache call timed out is a worse
// failure than a page that is a minute behind.

const REQUEST_TIMEOUT_MS = 4000;

const clientBase = (): string | null => {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
};

/** Matches the client's own tag builder and the public endpoint's slugify. */
export const pathwayGuideTag = (sportSlug: string): string =>
  `pathway-guide:${sportSlug.trim().toLowerCase().replace(/\s+/g, "-")}`;

/**
 * Ask the client to drop every cached fetch carrying one of `tags`. Each tag
 * must be on the client's allow-list (client/src/app/api/revalidate/route.ts).
 */
const purgeClientCache = (tags: string[], what: string): void => {
  const base = clientBase();
  const secret = process.env.REVALIDATE_SECRET?.trim();

  // Both are deployment configuration, not per-request state, so a missing one
  // is worth one warning rather than silence on every save.
  if (!base || !secret) {
    log.warn(`Skipped a ${what} cache purge`, {
      reason: !base ? "FRONTEND_URL is not set" : "REVALIDATE_SECRET is not set",
    });
    return;
  }

  void fetch(`${base}/api/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
    .then((res) => {
      if (res.ok) {
        log.debug(`Purged the client ${what} cache`, { tags });
        return;
      }
      log.warn(`The client refused a ${what} cache purge`, { status: res.status, tags });
    })
    .catch((error: unknown) => {
      log.warn(`Could not reach the client to purge its ${what} cache`, {
        tags,
        error: error instanceof Error ? error.message : String(error),
      });
    });
};

/**
 * Drop the client's cached copy of a sport's guide, and of the lists it appears
 * on. `sportSlug` omitted purges every guide, which is what a delete or a
 * reorder of the sport list needs.
 */
export const revalidatePathway = (sportSlug?: string): void => {
  purgeClientCache(
    ["pathway-guides", sportSlug ? pathwayGuideTag(sportSlug) : "pathway-guide"],
    "pathway"
  );
};

/**
 * Drop every cached tournament list and detail page. Called after a calendar
 * is approved, so the new dates are on the site now rather than when each
 * page's five-minute window happens to run out.
 */
export const revalidateTournamentEditions = (): void => {
  purgeClientCache(["tournament-editions"], "tournament");
};

/** Drop the cached admissions and scholarships lists and detail pages. */
export const revalidateOpportunities = (): void => {
  purgeClientCache(["opportunities"], "opportunities");
};
