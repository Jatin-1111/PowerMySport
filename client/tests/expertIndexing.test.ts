import { isExcludedFromSearch } from "@/lib/expertIndexing";
import { expertJsonLd, stableImageUrl } from "@/lib/seo";
import { afterEach, describe, expect, it, vi } from "vitest";

const SIGNED =
  "https://bucket.s3.ap-south-1.amazonaws.com/users/1/profile.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAEXAMPLE%2F20260725%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20260725T114649Z&X-Amz-Expires=604800&X-Amz-Signature=abc123";

describe("stableImageUrl", () => {
  it("drops pre-signed S3 URLs, which expire and carry a key id", () => {
    expect(stableImageUrl(SIGNED)).toBeUndefined();
  });

  it("drops CloudFront signed URLs", () => {
    expect(stableImageUrl("https://d1.cloudfront.net/a.png?Signature=x&Key-Pair-Id=K1")).toBe(
      undefined
    );
  });

  it("keeps a plain, stable URL", () => {
    expect(stableImageUrl("https://powermysport.com/og-image.png")).toBe(
      "https://powermysport.com/og-image.png"
    );
  });

  it("returns undefined for empty input", () => {
    expect(stableImageUrl(undefined)).toBeUndefined();
    expect(stableImageUrl("")).toBeUndefined();
  });
});

describe("expertJsonLd image", () => {
  const base = { name: "Asha", path: "/experts/abc" };

  it("omits a signed image rather than publish an expiring URL", () => {
    expect(expertJsonLd({ ...base, image: SIGNED })).not.toHaveProperty("image");
  });

  it("keeps a stable image", () => {
    expect(expertJsonLd({ ...base, image: "https://cdn.example.com/a.png" })).toHaveProperty(
      "image",
      "https://cdn.example.com/a.png"
    );
  });
});

describe("isExcludedFromSearch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("excludes the committed test profile", () => {
    expect(isExcludedFromSearch("6a649c2da23135da4b5a7a03")).toBe(true);
  });

  it("does not exclude other experts", () => {
    expect(isExcludedFromSearch("6a649c2da23135da4b5a7a99")).toBe(false);
    expect(isExcludedFromSearch(undefined)).toBe(false);
  });

  it("adds ids from SEO_EXCLUDED_EXPERT_IDS, trimming spaces and blanks", () => {
    vi.stubEnv("SEO_EXCLUDED_EXPERT_IDS", " aaa , ,bbb ");
    expect(isExcludedFromSearch("aaa")).toBe(true);
    expect(isExcludedFromSearch("bbb")).toBe(true);
    expect(isExcludedFromSearch("ccc")).toBe(false);
  });
});
