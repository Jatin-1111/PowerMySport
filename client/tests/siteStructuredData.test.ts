import robots from "@/app/robots";
import { ORGANIZATION_ID, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { describe, expect, it } from "vitest";

describe("site structured data", () => {
  it("does not describe a search box the site does not have", () => {
    expect(websiteJsonLd).not.toHaveProperty("potentialAction");
  });

  it("keeps the Organization @id the community app also uses", () => {
    expect(organizationJsonLd["@id"]).toBe(ORGANIZATION_ID);
    expect(ORGANIZATION_ID).toMatch(/\/#organization$/);
  });
});

describe("robots.txt sitemaps", () => {
  it("lists the community sitemap beside the main one", () => {
    const sitemaps = ([] as string[]).concat(robots().sitemap ?? []);
    expect(
      sitemaps.some((url) => url.endsWith("/sitemap.xml") && !url.includes("/community/"))
    ).toBe(true);
    expect(sitemaps.some((url) => url.endsWith("/community/sitemap.xml"))).toBe(true);
  });
});
