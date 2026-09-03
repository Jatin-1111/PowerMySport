import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Nav hrefs are untyped strings, so nothing relates them to the route tree.
 * Five had rotted into 404s — four of them in the academy console, which is the
 * console partners are onboarded into.
 *
 * This test closes the gap without retyping every nav array: it reads the real
 * route tree off disk and asserts that every internal href in a nav config
 * resolves to a page that exists.
 */

const APP_DIR = path.resolve(__dirname, "../src/app");

/** Files that define navigation. */
const NAV_SOURCES = [
  "src/app/(booking)/(player)/dashboard/LayoutShell.tsx",
  "src/app/(booking)/(venue-lister)/venue-lister/LayoutShell.tsx",
  "src/app/(booking)/academy/LayoutShell.tsx",
  "src/app/(booking)/coach/LayoutShell.tsx",
  "src/app/(expert)/expert/LayoutShell.tsx",
  "src/components/layout/Navigation.tsx",
];

/** Every URL path served by a page.tsx, with route groups stripped. */
const collectRoutes = (): string[] => {
  const routes: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "page.tsx") {
        const rel = path
          .relative(APP_DIR, path.dirname(full))
          .split(path.sep)
          .filter((segment) => !/^\(.*\)$/.test(segment)) // route groups
          .join("/");
        routes.push(`/${rel}`.replace(/\/+$/, "") || "/");
      }
    }
  };

  walk(APP_DIR);
  return routes;
};

/** True when `href` is served by `route`, allowing for dynamic segments. */
const routeMatches = (route: string, href: string): boolean => {
  const routeParts = route.split("/").filter(Boolean);
  const hrefParts = href.split("/").filter(Boolean);

  // A catch-all segment absorbs the remainder.
  const hasCatchAll = routeParts.some((p) => p.startsWith("[..."));
  if (!hasCatchAll && routeParts.length !== hrefParts.length) return false;

  return routeParts.every((part, i) => {
    if (part.startsWith("[...")) return true;
    if (part.startsWith("[")) return hrefParts[i] !== undefined;
    return part === hrefParts[i];
  });
};

/** Static `href: "..."` values, excluding externals and interpolated values. */
const collectHrefs = (source: string): string[] => {
  const hrefs = new Set<string>();
  for (const match of source.matchAll(/href:\s*"([^"]+)"/g)) {
    hrefs.add(match[1]);
  }
  return [...hrefs];
};

describe("navigation links resolve to real routes", () => {
  const routes = collectRoutes();

  it("finds the route tree", () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(routes).toContain("/dashboard");
    expect(routes).toContain("/coach/verification");
  });

  for (const relativePath of NAV_SOURCES) {
    it(`${relativePath} has no dead links`, () => {
      const absolute = path.resolve(__dirname, "..", relativePath);
      expect(fs.existsSync(absolute), `${relativePath} not found`).toBe(true);

      const hrefs = collectHrefs(fs.readFileSync(absolute, "utf8"));
      const dead: string[] = [];

      for (const href of hrefs) {
        // Only internal paths are checkable here. External URLs are built from
        // env vars at runtime.
        if (!href.startsWith("/")) continue;

        const pathOnly = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

        // The admin console is a separate Next.js app, not part of this route
        // tree, so its paths cannot be resolved from here.
        if (pathOnly.startsWith("/admin")) continue;

        if (!routes.some((route) => routeMatches(route, pathOnly))) {
          dead.push(href);
        }
      }

      expect(dead, `dead nav links in ${relativePath}`).toEqual([]);
    });
  }
});

describe("route policy prefixes exist", () => {
  it("every governed console has at least one real page", async () => {
    const { CONSOLE_POLICIES } = await import("../src/flow/policy");
    const routes = collectRoutes();

    for (const policy of CONSOLE_POLICIES) {
      const hasPage = routes.some(
        (route) => route === policy.prefix || route.startsWith(`${policy.prefix}/`)
      );
      expect(hasPage, `no pages under ${policy.prefix}`).toBe(true);
    }
  });
});
