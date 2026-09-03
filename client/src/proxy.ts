import { NextResponse, type NextRequest } from "next/server";
import { loginUrlFor, resolveAccess, safeReturnPath } from "@/flow/policy";
import { AUTH_COOKIE_NAME, readSessionFromCookie } from "@/flow/session";

/**
 * The server-side access checkpoint.
 *
 * This is Next.js's `proxy` convention (what used to be `middleware` — the
 * `middleware` filename is deprecated in Next 16). It must live at `src/proxy.ts`
 * and export a function named `proxy` or a default export; `config.matcher`
 * still applies. Unlike the old middleware, a proxy ALWAYS runs on the Node.js
 * runtime, and Next rejects any route-segment `runtime` config here.
 *
 * Until now every access decision in this app was made in a client component
 * after hydration, which meant a protected route could not fail closed and had
 * to ship its shell to whoever asked for it. This is where that changes.
 *
 * It holds no rules of its own. `resolveAccess` in `src/flow/policy.ts` decides,
 * exactly as it does for the client-side guard, so the two can never disagree —
 * which is the whole reason that function was written pure and React-free.
 *
 * ── What this does and does not enforce ──────────────────────────────────────
 *
 * Verified here: the token's signature, its expiry, and the role claim against
 * the route policy.
 *
 * NOT verified here: revocation. The API checks a Redis revocation list on every
 * request. A proxy runs on Node.js, so reaching Redis is not technically
 * impossible — but this app has no Redis connection or credentials of its own,
 * and giving the frontend its own handle on the API's revocation store would
 * duplicate ownership of that state. So a revoked-but-unexpired token passes
 * this checkpoint and is refused by the API. That is defence in depth working as
 * intended: this layer exists to stop serving the wrong UI, not to be the last
 * line.
 *
 * Requires `JWT_SECRET` in this app's server environment to verify anything. See
 * `src/flow/session.ts` for what happens without it (short version: it degrades
 * to letting the client-side guard decide, rather than locking anyone out).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const session = await readSessionFromCookie(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  const decision = resolveAccess(pathname, session);

  // "wait" means the session could not be determined here. Let the request
  // through and let the client-side guard resolve it once it has hydrated.
  if (decision.kind === "allow" || decision.kind === "wait") {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  destination.search = "";

  if (decision.preserveReturnPath) {
    const returnTo = safeReturnPath(`${pathname}${search}`);
    const loginUrl = loginUrlFor(returnTo);
    // `loginUrlFor` returns a path with its query already encoded, so parse it
    // rather than assigning pathname and search separately.
    const parsed = new URL(loginUrl, request.nextUrl.origin);
    destination.pathname = parsed.pathname;
    destination.search = parsed.search;
  } else {
    destination.pathname = decision.to;
  }

  return NextResponse.redirect(destination);
}

/**
 * Only run on the protected consoles. Marketing, shop, rankings and the auth
 * pages are public, and running the proxy on them would add latency to the
 * pages that most need to be fast.
 *
 * This list has to stay in step with `CONSOLE_POLICIES`; a policy whose prefix
 * is missing here is simply never enforced, silently. `tests/proxyMatcher.test.ts`
 * asserts the two agree, because Next.js requires this to be a static literal
 * and so it cannot be derived from the policy at runtime.
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/coach/:path*",
    "/venue-lister/:path*",
    "/academy/:path*",
    "/expert/:path*",
  ],
};
