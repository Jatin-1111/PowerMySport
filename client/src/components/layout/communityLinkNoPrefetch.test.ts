import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `/community` is a rewrite to the community app. A prefetch of it asks for a Next.js server-
// components payload that app does not serve, so each page load made one failed request. The
// links to it must not prefetch.
describe("links to the community app", () => {
  const nav = readFileSync(join(__dirname, "Navigation.tsx"), "utf8");

  it("the desktop link does not prefetch", () => {
    const link = nav.match(/<Link\s+href=\{COMMUNITY_PATH\}[\s\S]*?>/);
    expect(link, "the desktop Community link").not.toBeNull();
    expect(link?.[0]).toMatch(/prefetch=\{false\}/);
  });

  it("the mobile menu item does not prefetch", () => {
    expect(nav).toMatch(/href: COMMUNITY_PATH, label: "Community", prefetch: false/);
  });

  it("nothing links to the literal /community path through a prefetching Link", () => {
    expect(nav).not.toMatch(/<Link\s+href="\/community"/);
  });
});
