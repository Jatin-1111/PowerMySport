// Integration tests for `resolvePathwayContributor` — the lookup that turns a
// pathway's stored byline into what `/roadmap/[sport]` renders.
//
// Worth testing rather than eyeballing, because the interesting behaviour is
// what happens when the link goes BAD, and that state is invisible on a healthy
// database: a contributor whose coach profile is later unverified, deactivated
// or deleted must keep their written credit and lose only the booking button.
// The failure mode if this regresses — a "Book a session" button pointing at a
// profile the booking flow refuses — looks fine in the CMS and is only ever hit
// by a parent.
//
// Coaches and experts are gated on different flags (`isVerified` +
// `verificationStatus: VERIFIED` vs `isActive` + `verificationStatus: APPROVED`),
// so both are exercised: one shared helper hides that from the reader, and a
// change to either gate should fail here rather than in production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Coach } = require("../client/models/Coach");
const { Expert } = require("../client/models/ExpertProfile");
const { User } = require("../client/models/User");
const { resolvePathwayContributor } = require("../shared/services/pathwayContributorService");

let mongod: any;

const BYLINE = {
  name: "Lalit Akhade",
  organisation: "ChessMates Academy",
  url: "https://chessmates.in",
  blurb: "Chess player and coach.",
};

// `email` and `phone` are both unique on User, so fixtures are numbered rather
// than sharing constants — several of these tests create a user each, and a
// duplicate key here fails as a confusing validation error rather than as
// anything to do with contributors.
let fixtureCount = 0;

async function makeUser(name: string, photoUrl?: string) {
  fixtureCount += 1;
  return User.create({
    name,
    email: `contributor-${fixtureCount}@example.com`,
    phone: `900000${String(fixtureCount).padStart(4, "0")}`,
    password: "hashed-password-placeholder",
    ...(photoUrl ? { photoUrl } : {}),
  });
}

/** A user plus the coach profile that points at it. */
async function makeCoach(overrides: Record<string, unknown> = {}) {
  const user = await makeUser(
    "Lalit Akhade",
    "https://example.s3.ap-south-1.amazonaws.com/coach.jpg"
  );
  return Coach.create({
    userId: user._id,
    bio: "Coaches juniors.",
    sports: ["chess"],
    hourlyRate: 500,
    // Coach service modes are about WHERE they coach, not online/offline —
    // "ONLINE" is an expert's `sessionMode`, not a coach's.
    serviceMode: "FREELANCE",
    isVerified: true,
    verificationStatus: "VERIFIED",
    ...overrides,
  });
}

async function makeExpert(overrides: Record<string, unknown> = {}) {
  const user = await makeUser("Priya Rao");
  return Expert.create({
    userId: user._id,
    bio: "Advises on pathways.",
    sports: ["chess"],
    expertise: ["pathway"],
    sessionFee: 1000,
    sessionMode: "ONLINE",
    sessionDurationMinutes: 30,
    timezone: "Asia/Kolkata",
    photoUrl: "https://example.s3.ap-south-1.amazonaws.com/expert.jpg",
    isActive: true,
    verificationStatus: "APPROVED",
    ...overrides,
  });
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

describe("resolvePathwayContributor", () => {
  it("returns null when the guide has no contributor", async () => {
    assert.equal(await resolvePathwayContributor(undefined), null);
    assert.equal(await resolvePathwayContributor(null), null);
  });

  it("returns the byline alone when no profile is linked", async () => {
    const resolved = await resolvePathwayContributor({ ...BYLINE });
    assert.equal(resolved.name, "Lalit Akhade");
    assert.equal(resolved.organisation, "ChessMates Academy");
    assert.equal(resolved.url, "https://chessmates.in");
    assert.equal(resolved.profile, undefined);
  });

  it("resolves a verified coach to a booking link and photo", async () => {
    const coach = await makeCoach();
    const resolved = await resolvePathwayContributor({
      ...BYLINE,
      profile: { type: "coach", id: coach._id },
    });

    assert.equal(resolved.profile.type, "coach");
    assert.equal(resolved.profile.href, `/coaches/${coach._id.toString()}`);
    assert.equal(resolved.profile.ctaLabel, "Book a session");
    assert.equal(
      resolved.profile.photoUrl,
      "https://example.s3.ap-south-1.amazonaws.com/coach.jpg"
    );
  });

  it("resolves an approved expert with its own label and route", async () => {
    const expert = await makeExpert();
    const resolved = await resolvePathwayContributor({
      ...BYLINE,
      profile: { type: "expert", id: expert._id },
    });

    assert.equal(resolved.profile.type, "expert");
    assert.equal(resolved.profile.href, `/experts/${expert._id.toString()}`);
    // Not "Book a session" — an expert sells a consultation, and the reader
    // takes this label verbatim rather than deciding it per type itself.
    assert.equal(resolved.profile.ctaLabel, "Book a consultation");
  });

  // ── The states that must NOT produce a booking button ──

  it("keeps the byline but drops the link for an unverified coach", async () => {
    const coach = await makeCoach({ isVerified: false, verificationStatus: "PENDING" });
    const resolved = await resolvePathwayContributor({
      ...BYLINE,
      profile: { type: "coach", id: coach._id },
    });

    assert.equal(resolved.name, "Lalit Akhade");
    assert.equal(resolved.organisation, "ChessMates Academy");
    assert.equal(resolved.profile, undefined);
  });

  it("keeps the byline but drops the link for a deactivated expert", async () => {
    const expert = await makeExpert({ isActive: false });
    const resolved = await resolvePathwayContributor({
      ...BYLINE,
      profile: { type: "expert", id: expert._id },
    });

    assert.equal(resolved.name, "Lalit Akhade");
    assert.equal(resolved.profile, undefined);
  });

  it("keeps the byline when the linked profile no longer exists", async () => {
    const resolved = await resolvePathwayContributor({
      ...BYLINE,
      profile: { type: "coach", id: new mongoose.Types.ObjectId() },
    });

    assert.equal(resolved.name, "Lalit Akhade");
    assert.equal(resolved.profile, undefined);
  });
});
