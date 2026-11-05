/* eslint-disable @typescript-eslint/no-var-requires */
// Unit tests for which Google OAuth client IDs the server accepts.
//
// Moving the Google client to another Google Cloud project means the server must accept the old and
// the new ID for a while, because the website and the mobile app switch at different moments. What
// matters is that a token for ANY listed ID is accepted, a token for an unlisted ID is not, and an
// empty setting never means "accept everything". Google's network call is stubbed.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const {
  parseGoogleClientIds,
  verifyGoogleCredential,
  googleOAuthClient,
} = require("../shared/services/AuthService/googleAuth");

const OLD_ID = "111111111111-old.apps.googleusercontent.com";
const NEW_ID = "222222222222-new.apps.googleusercontent.com";

const original = googleOAuthClient.verifyIdToken;
const originalEnv = process.env.GOOGLE_CLIENT_ID;

/** Behaves like Google's check: the token's audience must be one of the accepted IDs. */
const stubGoogle = (tokenAudience: string) => {
  const seen: { audience?: unknown } = {};
  googleOAuthClient.verifyIdToken = async (options: { audience: string | string[] }) => {
    seen.audience = options.audience;
    const accepted = Array.isArray(options.audience) ? options.audience : [options.audience];
    if (!accepted.includes(tokenAudience))
      throw new Error("Wrong recipient, payload audience != requiredAudience");
    return {
      getPayload: () => ({
        sub: "google-sub-123",
        email: "parent@example.test",
        email_verified: true,
        name: "Test Parent",
      }),
    };
  };
  return seen;
};

afterEach(() => {
  googleOAuthClient.verifyIdToken = original;
  if (originalEnv === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalEnv;
});

describe("parseGoogleClientIds", () => {
  it("reads one ID, or a comma separated list, ignoring spaces and empty entries", () => {
    assert.deepEqual(parseGoogleClientIds(OLD_ID), [OLD_ID]);
    assert.deepEqual(parseGoogleClientIds(`${OLD_ID}, ${NEW_ID} `), [OLD_ID, NEW_ID]);
    assert.deepEqual(parseGoogleClientIds(` ,${NEW_ID},, `), [NEW_ID]);
  });

  it("returns nothing for an unset or blank setting", () => {
    assert.deepEqual(parseGoogleClientIds(undefined), []);
    assert.deepEqual(parseGoogleClientIds(""), []);
    assert.deepEqual(parseGoogleClientIds(" , "), []);
  });
});

describe("verifyGoogleCredential", () => {
  it("accepts a token issued for either ID while both are listed", async () => {
    process.env.GOOGLE_CLIENT_ID = `${OLD_ID},${NEW_ID}`;

    stubGoogle(OLD_ID);
    assert.equal((await verifyGoogleCredential("token")).googleId, "google-sub-123");

    stubGoogle(NEW_ID);
    assert.equal((await verifyGoogleCredential("token")).email, "parent@example.test");
  });

  it("passes every listed ID to Google as the accepted audience", async () => {
    process.env.GOOGLE_CLIENT_ID = `${OLD_ID}, ${NEW_ID}`;
    const seen = stubGoogle(NEW_ID);
    await verifyGoogleCredential("token");
    assert.deepEqual(seen.audience, [OLD_ID, NEW_ID]);
  });

  it("rejects a token issued for an ID that is not listed", async () => {
    process.env.GOOGLE_CLIENT_ID = NEW_ID;
    stubGoogle(OLD_ID);
    await assert.rejects(() => verifyGoogleCredential("token"), /Invalid Google credential/);
  });

  it("stops accepting the old ID once it is removed from the list", async () => {
    process.env.GOOGLE_CLIENT_ID = `${OLD_ID},${NEW_ID}`;
    stubGoogle(OLD_ID);
    await verifyGoogleCredential("token");

    process.env.GOOGLE_CLIENT_ID = NEW_ID;
    await assert.rejects(() => verifyGoogleCredential("token"), /Invalid Google credential/);
  });

  it("refuses everything when no ID is configured, instead of accepting any token", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    stubGoogle(OLD_ID);
    await assert.rejects(() => verifyGoogleCredential("token"), /not configured/);

    process.env.GOOGLE_CLIENT_ID = " , ";
    await assert.rejects(() => verifyGoogleCredential("token"), /not configured/);
  });

  it("rejects a missing or non-string credential", async () => {
    process.env.GOOGLE_CLIENT_ID = NEW_ID;
    stubGoogle(NEW_ID);
    await assert.rejects(() => verifyGoogleCredential(undefined), /Missing Google credential/);
    await assert.rejects(() => verifyGoogleCredential({ token: "x" }), /Missing Google credential/);
  });
});
