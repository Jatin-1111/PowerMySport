import { describe, expect, it } from "vitest";
import { config } from "../src/proxy";
import { CONSOLE_POLICIES, resolveAccess } from "../src/flow/policy";

/**
 * Next.js requires `config.matcher` to be a static literal, so it cannot be
 * derived from `CONSOLE_POLICIES` at runtime. That makes drift possible in the
 * worst way: a policy whose prefix is missing from the matcher is never
 * enforced, and nothing anywhere reports it.
 *
 * This closes that gap the same way `navLinks.test.ts` closes the dead-link gap.
 */

/** `/coach/:path*` → `/coach` */
const prefixOf = (matcher: string): string => matcher.replace(/\/:path\*$/, "");

describe("proxy matcher", () => {
  const matchers = config.matcher;
  const prefixes = matchers.map(prefixOf);

  it("covers every governed console", () => {
    for (const policy of CONSOLE_POLICIES) {
      expect(
        prefixes,
        `${policy.prefix} is governed by policy but the proxy never runs on it`
      ).toContain(policy.prefix);
    }
  });

  it("does not claim routes that no policy governs", () => {
    // A matcher without a policy costs latency on those routes and enforces
    // nothing.
    const governed = CONSOLE_POLICIES.map((p) => p.prefix);
    for (const prefix of prefixes) {
      expect(governed, `the proxy runs on ${prefix} but no policy covers it`).toContain(prefix);
    }
  });

  it("matches the console root as well as its descendants", () => {
    // `:path*` is zero-or-more, so /dashboard and /dashboard/x both match. If
    // this ever became `:path+`, the console root would slip through unguarded.
    for (const matcher of matchers) {
      expect(matcher).toMatch(/:path\*$/);
    }
  });

  it("leaves public surfaces alone", () => {
    for (const publicPath of [
      "/",
      "/booking",
      "/shop",
      "/rankings",
      "/login",
      "/register",
      "/coaches/abc",
      "/experts",
      "/federations",
    ]) {
      const claimed = prefixes.some(
        (prefix) => publicPath === prefix || publicPath.startsWith(`${prefix}/`)
      );
      expect(claimed, `the proxy should not run on ${publicPath}`).toBe(false);
    }
  });

  it("still lets policy exempt public paths inside a matched console", () => {
    // /academy/onboarding is inside a matched prefix, so the proxy DOES run on
    // it — the exemption has to come from the policy, not the matcher.
    expect(prefixes.some((prefix) => "/academy/onboarding".startsWith(prefix))).toBe(true);
    expect(resolveAccess("/academy/onboarding", { status: "anonymous" }).kind).toBe("allow");
  });
});
