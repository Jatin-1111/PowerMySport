/* eslint-disable @typescript-eslint/no-var-requires */
// Stored profile-photo URLs are 7-day pre-signed links. refreshOwnedImageUrl
// re-signs them on read, but only for the owner's own key in the images bucket:
// the stored value is user input and must not become a way to mint a link to
// someone else's file.
process.env.AWS_REGION = "ap-south-1";
process.env.AWS_S3_IMAGES_BUCKET = "test-images";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { S3Service } = require("../shared/services/S3Service");

const HOST = "https://test-images.s3.ap-south-1.amazonaws.com";
const EXPIRED = "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=604800&X-Amz-Signature=old";

const service = () => {
  const s3 = new S3Service();
  const signed: string[] = [];
  s3.generateCachedDownloadUrl = async (key: string) => {
    signed.push(key);
    return `https://fresh.example/${key}`;
  };
  return { s3, signed };
};

describe("S3Service.refreshOwnedImageUrl", () => {
  it("re-signs the owner's own photo from the key inside the stored URL", async () => {
    const { s3 } = service();
    const out = await s3.refreshOwnedImageUrl(`${HOST}/users/u1/profile_1.png${EXPIRED}`, "u1");
    assert.equal(out, "https://fresh.example/users/u1/profile_1.png");
  });

  it("leaves another user's object alone and never signs it", async () => {
    const { s3, signed } = service();
    const url = `${HOST}/users/u2/profile_1.png${EXPIRED}`;
    assert.equal(await s3.refreshOwnedImageUrl(url, "u1"), url);
    assert.deepEqual(signed, []);
  });

  it("does not follow a path traversal out of the owner's folder", async () => {
    const { s3, signed } = service();
    const url = `${HOST}/users/u1/%2e%2e/u2/profile_1.png${EXPIRED}`;
    assert.equal(await s3.refreshOwnedImageUrl(url, "u1"), url);
    assert.deepEqual(signed, []);
  });

  it("leaves external and other-bucket URLs untouched", async () => {
    const { s3, signed } = service();
    for (const url of [
      "https://lh3.googleusercontent.com/a/photo.png",
      "https://other-bucket.s3.ap-south-1.amazonaws.com/users/u1/p.png",
      "not a url",
    ]) {
      assert.equal(await s3.refreshOwnedImageUrl(url, "u1"), url);
    }
    assert.deepEqual(signed, []);
  });

  it("returns the input when there is nothing to refresh", async () => {
    const { s3 } = service();
    assert.equal(await s3.refreshOwnedImageUrl(undefined, "u1"), undefined);
    assert.equal(
      await s3.refreshOwnedImageUrl(`${HOST}/users/u1/p.png`, undefined),
      `${HOST}/users/u1/p.png`
    );
  });

  it("falls back to the stored URL if signing fails", async () => {
    const s3 = new S3Service();
    s3.generateCachedDownloadUrl = async () => {
      throw new Error("no credentials");
    };
    const url = `${HOST}/users/u1/profile_1.png${EXPIRED}`;
    assert.equal(await s3.refreshOwnedImageUrl(url, "u1"), url);
  });
});
