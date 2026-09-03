import { SITE_URL } from "@/lib/seo";

/**
 * Validation for post-login return paths (`?redirect=`, `?next=`).
 *
 * These values are attacker-controlled: anyone can hand out
 * `powermysport.com/login?redirect=https://evil.example/harvest`. The login
 * page used to test only `/^https?:\/\//` and then assign
 * `window.location.href = target`, which meant any absolute URL was honoured —
 * an open redirect on the authentication endpoint, and a convincing one,
 * because the victim really does land on our real login form first.
 *
 * Cross-origin returns cannot simply be banned: the community app bounces
 * unauthenticated users here with `?next=https://community.powermysport.com/...`
 * and needs a full navigation back so the browser carries the session cookie.
 * So the rule is an allowlist of origins we own, not a same-origin-only rule.
 */

/**
 * Written with char codes rather than a regex range so that no literal control
 * character ever appears in this source file.
 */
const hasControlChar = (value: string): boolean => {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
};

/** Origins a return path is permitted to point at, beyond relative paths. */
const buildAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();

  const add = (value: string | undefined) => {
    if (!value) return;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // A malformed env var must not widen the allowlist.
    }
  };

  add(SITE_URL);
  add(process.env.NEXT_PUBLIC_COMMUNITY_APP_URL);
  if (typeof window !== "undefined") {
    origins.add(window.location.origin);
  }

  return origins;
};

/**
 * Narrow a raw `?redirect=` / `?next=` value to something safe to navigate to.
 *
 * @returns the target if it is a site-relative path or an allowlisted origin,
 *   otherwise `null` — callers fall back to their own default destination.
 */
export const safeReturnPath = (raw: string | null | undefined): string | null => {
  if (!raw) return null;

  const target = raw.trim();
  if (!target) return null;

  // Control characters (including decoded newlines and tabs) are used to
  // smuggle past naive prefix checks and to split headers.
  if (hasControlChar(target)) return null;

  // Backslashes are normalised to forward slashes by some browsers, so
  // `/\evil.example` can escape a plain `startsWith("/")` test.
  if (target.includes("\\")) return null;

  if (target.startsWith("/")) {
    // `//evil.example` is a protocol-relative URL: it starts with a slash but
    // navigates off-origin.
    if (target.startsWith("//")) return null;
    return target;
  }

  // Anything else must be an absolute URL on an origin we own. This also
  // rejects `javascript:`, `data:` and bare hostnames, since none of them
  // parse to an allowlisted origin.
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!buildAllowedOrigins().has(parsed.origin)) return null;

  return parsed.toString();
};

/** True when `target` needs a full document navigation rather than the router. */
export const isExternalReturnPath = (target: string): boolean => /^https?:\/\//i.test(target);

/**
 * A validated return path for the page the visitor is currently on.
 *
 * Takes `pathname` explicitly rather than reading `window.location`: callers in
 * React should pass the router's pathname, so the value cannot disagree with the
 * one the routing decision was made from. `search` defaults to the live query
 * string, which is only read on the client.
 */
export const currentReturnPath = (pathname: string, search?: string): string | null => {
  const query = search ?? (typeof window !== "undefined" ? window.location.search : "");
  return safeReturnPath(`${pathname}${query}`);
};
