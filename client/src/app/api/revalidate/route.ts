import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

// ─── POST /api/revalidate ────────────────────────────────────────────────────
//
// Lets the server drop this app's cached copy of content the moment an admin
// changes it, instead of the page waiting out a blind TTL.
//
// This exists because a TTL alone was not enough: a pathway edited in the CMS
// went on being served from a stale data-cache entry long after its hour was up,
// and the only thing that showed the new version was a URL whose cache key
// happened to differ. The TTL is still there as a backstop, but the admin write
// is what should clear the cache, and this is the door it knocks on.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tags callers are allowed to purge, by prefix.
 *
 * A purge is cheap but not free, and an endpoint that accepts any tag at all is
 * a way to make this app refetch everything it has on someone else's schedule.
 * The caller is authenticated, so this is depth rather than the only defence.
 */
const ALLOWED_TAG_PREFIXES = ["pathway-guide", "pathway-guides", "tournament-editions"];

const isAllowed = (tag: string): boolean =>
  ALLOWED_TAG_PREFIXES.some((prefix) => tag === prefix || tag.startsWith(`${prefix}:`));

/** Constant-time compare that does not leak the secret's length. */
const matches = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  // Unset means this deployment never opted in. Say so plainly rather than
  // accepting the call and silently doing nothing, which would look like a
  // working invalidation until someone noticed the page was still stale.
  if (!secret) {
    return NextResponse.json(
      { revalidated: false, message: "REVALIDATE_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (!matches(request.headers.get("x-revalidate-secret") ?? "", secret)) {
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const requested = Array.isArray(body?.tags) ? body.tags : [];
  const tags = requested.filter((tag): tag is string => typeof tag === "string" && isAllowed(tag));

  if (tags.length === 0) {
    return NextResponse.json(
      { revalidated: false, message: "No revalidatable tags in the request." },
      { status: 400 }
    );
  }

  // The second argument is required as of Next 16 and is a cacheLife profile:
  // "max" expires every entry carrying the tag, which is what a purge means
  // here. (`updateTag`, the read-your-own-writes version, is Server Actions
  // only, and this is a route handler called by another service.)
  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: true, tags });
}
