import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";

import {
  escapeRegex,
  buildSafeSearchRegexSource,
  MAX_SEARCH_TERM_LENGTH,
} from "../utils/regex";
import { registerSchema } from "../middleware/schemas";
import { S3Service } from "../shared/services/S3Service";

// jwt.ts reads JWT_SECRET at import time, so set it before we require the module.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

// ───────────────────────────── H5: regex injection / ReDoS ─────────────────
describe("H5 — search input is escaped before regex use", () => {
  it("escapes all regex metacharacters", () => {
    assert.equal(escapeRegex("(a+)+$"), "\\(a\\+\\)\\+\\$");
    assert.equal(escapeRegex("a.b*c?"), "a\\.b\\*c\\?");
  });

  it("trims and length-caps the raw term before escaping", () => {
    const long = "a".repeat(200);
    // 'a' needs no escaping, so the result reflects the raw cap exactly.
    assert.equal(buildSafeSearchRegexSource(long).length, MAX_SEARCH_TERM_LENGTH);
    assert.equal(buildSafeSearchRegexSource("  Foo.*Bar  "), "Foo\\.\\*Bar");
  });

  it("a catastrophic pattern becomes a literal match (no backtracking)", () => {
    const re = new RegExp(buildSafeSearchRegexSource("(a+)+$"), "i");
    assert.equal(re.test("(a+)+$"), true); // matches the literal text
    assert.equal(re.test("aaaaaaaaaa"), false); // NOT interpreted as a regex
  });
});

// ───────────────────────────── H1: JWT hardening ───────────────────────────
describe("H1 — JWT secret required + algorithm pinned", () => {
  // Required after env is set above.
  const { generateToken, verifyToken } = require("../utils/jwt");
  const SECRET = process.env.JWT_SECRET as string;

  it("round-trips a valid HS256 token", () => {
    const token = generateToken({ id: "u1", email: "a@b.com", role: "PLAYER" });
    const decoded = verifyToken(token);
    assert.equal(decoded.id, "u1");
    assert.equal(decoded.role, "PLAYER");
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ id: "u1", role: "ADMIN" }, "some-other-secret");
    assert.throws(() => verifyToken(forged), /Invalid or expired token/);
  });

  it('rejects an "alg: none" (unsigned) token', () => {
    const none = jwt.sign({ id: "u1", role: "ADMIN" }, "", {
      algorithm: "none",
    });
    assert.throws(() => verifyToken(none), /Invalid or expired token/);
  });
});

// ───────────────────────────── C1: Google credential verification ──────────
describe("C1 — Google login refuses unverifiable / client-supplied identity", () => {
  const { verifyGoogleCredential } = require("../shared/services/AuthService");

  it("rejects a missing / empty / non-string credential", async () => {
    await assert.rejects(
      verifyGoogleCredential(undefined),
      /Missing Google credential/,
    );
    await assert.rejects(verifyGoogleCredential(""), /Missing Google credential/);
    await assert.rejects(
      verifyGoogleCredential(12345),
      /Missing Google credential/,
    );
    // The old attack shape — a raw {googleId,email} object — is not a string,
    // so it is rejected outright instead of being trusted.
    await assert.rejects(
      verifyGoogleCredential({ googleId: "x", email: "victim@x.com" }),
      /Missing Google credential/,
    );
  });
});

// ───────────────────────────── H2: registration role/type ──────────────────
describe("H2 — registration cannot self-assign privileged role/type", () => {
  const base = {
    name: "Test User",
    email: "test@example.com",
    phone: "9999999999",
    password: "password123",
    acceptedTerms: true,
    acceptedPrivacy: true,
  };

  it("defaults to PLAYER / Recreational", () => {
    const r = registerSchema.safeParse({ ...base });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.role, "PLAYER");
      assert.equal(r.data.userType, "Recreational");
    }
  });

  it('rejects userType "Admin"', () => {
    const r = registerSchema.safeParse({ ...base, userType: "Admin" });
    assert.equal(r.success, false);
  });

  it('rejects role "ADMIN"', () => {
    const r = registerSchema.safeParse({ ...base, role: "ADMIN" });
    assert.equal(r.success, false);
  });

  it("still allows legitimate COACH self-registration", () => {
    const r = registerSchema.safeParse({ ...base, role: "COACH" });
    assert.equal(r.success, true);
  });
});

// ───────────────────────────── M6: upload content-type allowlist ───────────
describe("M6 — S3 uploads validate content-type + sanitize extension", () => {
  const svc = new S3Service() as any;

  it("accepts allowed image/pdf types and returns a safe extension", () => {
    assert.equal(svc.resolveSafeExtension("photo.PNG", "image/png"), "png");
    assert.equal(svc.resolveSafeExtension("doc.pdf", "application/pdf"), "pdf");
    assert.equal(svc.resolveSafeExtension("x.jpeg", "image/jpeg"), "jpeg");
  });

  it("rejects dangerous / non-allowed content types", () => {
    assert.throws(
      () => svc.resolveSafeExtension("evil.html", "text/html"),
      /Unsupported upload content type/,
    );
    assert.throws(
      () => svc.resolveSafeExtension("evil.svg", "image/svg+xml"),
      /Unsupported upload content type/,
    );
    assert.throws(
      () => svc.resolveSafeExtension("x.bin", "application/octet-stream"),
      /Unsupported upload content type/,
    );
  });
});

// ───────────────────────────── M1: CORS subdomain allowlist ────────────────
// Mirrors the allowedOriginPatterns in app.ts (kept in sync intentionally).
describe("M1 — CORS trusts only explicit subdomains, not a wildcard", () => {
  const allowedOriginPatterns = [
    /^https:\/\/(www|admin|community|api)\.powermysport\.com$/i,
    /^http:\/\/localhost:\d+$/i,
  ];
  const matches = (o: string) => allowedOriginPatterns.some((p) => p.test(o));

  it("allows known app subdomains + localhost", () => {
    assert.equal(matches("https://admin.powermysport.com"), true);
    assert.equal(matches("https://community.powermysport.com"), true);
    assert.equal(matches("http://localhost:3000"), true);
  });

  it("rejects arbitrary / attacker-controlled subdomains and origins", () => {
    assert.equal(matches("https://evil.powermysport.com"), false);
    assert.equal(matches("https://powermysport.com.evil.com"), false);
    assert.equal(matches("https://evil.com"), false);
  });
});
