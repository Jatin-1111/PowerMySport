import { organizationSchema, websiteSchema } from "@/modules/community/components/seo/JsonLd";
import { SITE_URL } from "@/lib/seo";
import { describe, expect, it } from "vitest";

describe("community structured data", () => {
  it("shares the main site's Organization @id instead of declaring a second company", () => {
    expect(organizationSchema["@id"]).toBe(`${SITE_URL}/#organization`);
  });

  it("lists only real social profiles, matching the main site", () => {
    expect(organizationSchema.sameAs).toEqual([
      "https://www.instagram.com/powermysport",
      "https://www.linkedin.com/company/powermysport-pvt-ltd/",
    ]);
  });

  it("has no SearchAction pointing at a route the app does not have", () => {
    expect(websiteSchema).not.toHaveProperty("potentialAction");
    expect(websiteSchema.publisher).toEqual({ "@id": `${SITE_URL}/#organization` });
  });
});
