import { Request, Response, NextFunction } from "express";

/**
 * `Cache-Control` for GET routes that would otherwise be recomputed from
 * scratch on every request — mainly the community/blog read endpoints that
 * serve shared links and guest traffic. Express already sets a weak `ETag`
 * on every response by default, but without a `Cache-Control` alongside it
 * that ETag rarely gets exercised (clients don't send `If-None-Match`
 * without a caching hint telling them to revalidate), so it was previously
 * just per-request hashing cost with no payoff.
 *
 * `visibility: "private"` is the default and the right choice for anything
 * whose payload embeds viewer-specific fields (likedByMe, myVote, isMine,
 * isMember, canAccept, ...) — nearly every community/blog response does,
 * since even a guest-safe endpoint renders differently once you're signed
 * in. `"private"` still lets the browser skip a refetch on repeat
 * navigation/back-forward for the same viewer; it just isn't shared across
 * viewers by a CDN or proxy cache. Use `"public"` only for responses that
 * are byte-identical regardless of who's asking (e.g. search results, which
 * don't carry any per-viewer field).
 */
export const cacheControl = (
  maxAgeSeconds: number,
  visibility: "private" | "public" = "private",
) => {
  const header = `${visibility}, max-age=${maxAgeSeconds}`;
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", header);
    next();
  };
};
