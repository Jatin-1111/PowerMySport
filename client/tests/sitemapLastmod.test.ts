import { buildSitemapEntries } from "@/modules/marketing/services/sitemapEntries";
import { afterEach, describe, expect, it, vi } from "vitest";

function stubApi(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const hit = Object.entries(routes).find(([path]) => url.includes(path));
      if (!hit) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => hit[1] };
    })
  );
}

describe("sitemap lastmod", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("states no lastmod when the API gives no date, rather than the build time", async () => {
    stubApi({});
    const entries = await buildSitemapEntries();
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });

  it("uses the record's own date, and the newest one for the index page", async () => {
    stubApi({
      "/federations": {
        success: true,
        data: [
          { slug: "aita", updatedAt: "2026-09-01T00:00:00.000Z" },
          { slug: "bai", updatedAt: "2026-10-05T00:00:00.000Z" },
        ],
      },
    });
    const entries = await buildSitemapEntries();
    const byPath = (path: string) => entries.find((entry) => entry.url.endsWith(path));
    expect(byPath("/federations/aita")?.lastModified).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(byPath("/federations/bai")?.lastModified).toEqual(new Date("2026-10-05T00:00:00.000Z"));
    expect(byPath("/federations")?.lastModified).toEqual(new Date("2026-10-05T00:00:00.000Z"));
    expect(byPath("/about")?.lastModified).toBeUndefined();
  });
});
