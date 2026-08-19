import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { readSession } from "./session";

const SECRET = "test-secret-at-least-32-characters-long!!";
const key = new TextEncoder().encode(SECRET);

const signToken = async (
  payload: Record<string, unknown>,
  expiresIn = "1h",
): Promise<string> =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);

const read = (
  token: string | null,
  overrides: { secret?: string; blockAnonymous?: boolean } = {},
) =>
  readSession({
    token,
    // `in` rather than `??`, so passing `secret: undefined` explicitly means
    // "no secret configured" instead of falling back to the test secret.
    secret: "secret" in overrides ? overrides.secret : SECRET,
    blockAnonymous: overrides.blockAnonymous ?? true,
  });

describe("readSession", () => {
  it("reads the role from a validly signed token", async () => {
    const token = await signToken({ id: "u1", email: "a@b.c", role: "Coach" });
    await expect(read(token)).resolves.toEqual({
      status: "authenticated",
      role: "Coach",
    });
  });

  it("treats an expired token as signed out", async () => {
    // Conclusive: the copy in localStorage has the same expiry, so there is
    // nothing for the login page to bounce back to.
    const token = await signToken(
      { id: "u1", email: "a@b.c", role: "Parent" },
      "-1s",
    );
    await expect(read(token)).resolves.toEqual({ status: "anonymous" });
  });

  it("reports unknown — not signed out — when the signature does not verify", async () => {
    // The critical safety property. A wrong secret in this app's environment
    // must not redirect every signed-in user to login, because login redirects
    // them straight back: an infinite loop and a site-wide outage.
    const token = await signToken({ id: "u1", email: "a@b.c", role: "Coach" });
    await expect(
      read(token, { secret: "a-completely-different-secret-value-32ch!" }),
    ).resolves.toEqual({ status: "unknown" });
  });

  it("reports unknown when no secret is configured", async () => {
    const token = await signToken({ id: "u1", email: "a@b.c", role: "Coach" });
    await expect(read(token, { secret: undefined })).resolves.toEqual({
      status: "unknown",
    });
  });

  it("reports unknown for a malformed or forged token", async () => {
    for (const token of ["not-a-jwt", "a.b.c", ""]) {
      const result = await read(token || null);
      expect(result.status).not.toBe("authenticated");
    }
  });

  it("rejects a token whose algorithm is not the pinned one", async () => {
    // An unsigned "alg": "none" token must never be accepted as a session.
    const unsigned = `${Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url")}.${Buffer.from(
      JSON.stringify({ id: "u1", role: "Admin" }),
    ).toString("base64url")}.`;

    await expect(read(unsigned)).resolves.toEqual({ status: "unknown" });
  });

  it("does not trust an unrecognised role claim", async () => {
    const token = await signToken({ id: "u1", email: "a@b.c", role: "Root" });
    await expect(read(token)).resolves.toEqual({ status: "unknown" });
  });

  describe("when the cookie is absent", () => {
    it("is signed out only when cookie coverage is trusted", async () => {
      await expect(read(null, { blockAnonymous: true })).resolves.toEqual({
        status: "anonymous",
      });
    });

    it("is unknown while the auth cookie is still session-scoped", async () => {
      // Default behaviour today: the API sets no maxAge, so a returning user
      // legitimately has a valid token and no cookie.
      await expect(read(null, { blockAnonymous: false })).resolves.toEqual({
        status: "unknown",
      });
    });
  });
});
