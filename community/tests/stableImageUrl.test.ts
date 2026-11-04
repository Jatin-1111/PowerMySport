import { describe, expect, it } from "vitest";
import { stableImageUrl } from "@/lib/seo";

describe("stableImageUrl", () => {
  it("passes a permanent URL through", () => {
    expect(stableImageUrl("https://cdn.example.com/blog/cover.jpg")).toBe(
      "https://cdn.example.com/blog/cover.jpg"
    );
  });

  it("drops a pre-signed S3 URL, which expires and carries an access key id", () => {
    expect(
      stableImageUrl(
        "https://bucket.s3.ap-south-1.amazonaws.com/a.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAEXAMPLE&X-Amz-Signature=abc"
      )
    ).toBeUndefined();
  });

  it("drops a CloudFront signed URL", () => {
    expect(
      stableImageUrl("https://d1.cloudfront.net/a.jpg?Signature=abc&Key-Pair-Id=K1")
    ).toBeUndefined();
  });

  it("treats a missing value as no image", () => {
    expect(stableImageUrl(undefined)).toBeUndefined();
    expect(stableImageUrl(null)).toBeUndefined();
    expect(stableImageUrl("")).toBeUndefined();
  });
});
