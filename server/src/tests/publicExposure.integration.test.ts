// HTTP-level tests for what the PUBLIC coach, venue and academy routes may serve,
// and for who may drive the academy onboarding API.
//
// They go through the real `app`. Each fixture stores payout details encrypted,
// exactly as production does, because the leak these guard against is the
// schema's decrypt-on-serialize getters: a response that includes the field
// includes the plaintext. So the assertions look for the plaintext values and
// the field names, not just for a missing key.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { encryptValue } = require("../shared/utils/encryption");
const { User } = require("../client/models/User");
const { Coach } = require("../client/models/Coach");
const { Venue } = require("../client/models/Venue");
const Academy = require("../admin/models/Academy").default;
const Admin = require("../admin/models/Admin").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

const ACCOUNT = "9988776655443322";
const IFSC = "HDFC0001234";
const UPI = "payee@okhdfcbank";
const PAN = "ABCDE1234F";
const OWNER_EMAIL = "owner.private@example.test";
const OWNER_PHONE = "+919876543210";

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of ["users", "coaches", "venues", "academies", "admins"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

/** None of the sensitive values or field names may appear anywhere in a body. */
const assertNoSecrets = (body: unknown, fieldNames: string[], values: string[]) => {
  const text = JSON.stringify(body);
  for (const name of fieldNames) {
    assert.ok(!text.includes(`"${name}"`), `response must not carry the field "${name}"`);
  }
  for (const value of values) {
    assert.ok(!text.includes(value), `response must not carry the value "${value}"`);
  }
};

const insertUser = async (extra: Record<string, unknown> = {}) => {
  const id = oid();
  const email = `${id.toString()}@example.test`;
  await User.collection.insertOne({
    _id: id,
    name: "Owner Name",
    email,
    phone: `9${id.toString().slice(-9)}`,
    role: "Player",
    isActive: true,
    status: "ACTIVE",
    ...extra,
  });
  return { id: id.toString(), email };
};

const tokenFor = (id: string, email: string, role: string) => generateToken({ id, email, role });

describe("public coach profile", () => {
  it("serves the profile without payout details, KYC files, notes or block-out reasons", async () => {
    const user = await insertUser({ name: "Coach Public" });
    const coachId = oid();
    await Coach.collection.insertOne({
      _id: coachId,
      userId: new mongoose.Types.ObjectId(user.id),
      bio: "Twenty years coaching juniors.",
      certifications: ["Level 2"],
      sports: ["Tennis"],
      hourlyRate: 800,
      serviceMode: "FREELANCE",
      availability: [],
      isVerified: true,
      verificationStatus: "VERIFIED",
      rating: 4.5,
      reviewCount: 3,
      verificationNotes: "Passport photo looked altered, re-check",
      verificationDocuments: [
        { type: "ID_PROOF", url: "https://files.example.test/id.pdf", fileName: "id.pdf" },
      ],
      payoutMethods: [
        {
          type: "BANK_TRANSFER",
          accountHolderName: "Coach Public",
          accountNumber: encryptValue(ACCOUNT),
          ifscCode: encryptValue(IFSC),
          upiId: encryptValue(UPI),
          isDefault: true,
        },
      ],
      gstNumber: "29ABCDE1234F1Z5",
      blockedDates: [
        { startDate: new Date(), endDate: new Date(), reason: "Surgery", allDay: true },
      ],
      subscriptionStatus: "ACTIVE",
    });

    const response = await request(app).get(`/api/coaches/${coachId.toString()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.bio, "Twenty years coaching juniors.");
    assert.deepEqual(response.body.data.sports, ["Tennis"]);
    assert.equal(response.body.data.userId.name, "Coach Public");
    assertNoSecrets(
      response.body,
      [
        "payoutMethods",
        "verificationDocuments",
        "verificationNotes",
        "blockedDates",
        "gstNumber",
        "subscriptionStatus",
        "accountNumber",
        "ifscCode",
        "upiId",
      ],
      [ACCOUNT, IFSC, UPI, "Surgery", "Passport photo", "29ABCDE1234F1Z5"]
    );
    // The linked user is projected too: no email or phone.
    assert.equal(response.body.data.userId.email, undefined);
    assert.equal(response.body.data.userId.phone, undefined);
  });
});

describe("public venue routes", () => {
  const insertVenue = async (ownerId: string) => {
    const venueId = oid();
    await Venue.collection.insertOne({
      _id: venueId,
      ownerId: new mongoose.Types.ObjectId(ownerId),
      ownerName: "Venue Owner",
      ownerEmail: OWNER_EMAIL,
      ownerPhone: OWNER_PHONE,
      emailVerified: true,
      name: "Centre Court",
      location: { type: "Point", coordinates: [77.2, 28.6] },
      sports: ["Tennis"],
      pricePerHour: 500,
      approvalStatus: "APPROVED",
      reviewNotes: "Internal: owner asked for a fee waiver",
      rejectionReason: "Earlier rejection: blurry photos",
      rating: 4,
      reviewCount: 2,
      documents: [
        {
          type: "OWNERSHIP_PROOF",
          url: "https://files.example.test/deed.pdf",
          fileName: "deed.pdf",
        },
      ],
      payoutMethods: [
        {
          type: "BANK_TRANSFER",
          accountHolderName: "Venue Owner",
          accountNumber: encryptValue(ACCOUNT),
          ifscCode: encryptValue(IFSC),
          upiId: encryptValue(UPI),
          isDefault: true,
        },
      ],
    });
    return venueId.toString();
  };

  const privateFields = [
    "payoutMethods",
    "documents",
    "ownerEmail",
    "ownerPhone",
    "emailVerified",
    "reviewNotes",
    "rejectionReason",
    "accountNumber",
    "ifscCode",
  ];
  const privateValues = [ACCOUNT, IFSC, UPI, OWNER_EMAIL, OWNER_PHONE, "fee waiver", "blurry"];

  it("detail serves the venue without payout data, owner contact or moderation notes, and does not populate the owner", async () => {
    const owner = await insertUser({
      dob: new Date("1980-01-01"),
      addresses: [{ fullName: "Home", addressLine1: "12 Private Lane" }],
      pushSubscriptions: [{ endpoint: "https://push.example.test/abc", keys: { auth: "a" } }],
      refundMethods: [{ type: "BANK_ACCOUNT", accountNumber: "5566778899" }],
    });
    const venueId = await insertVenue(owner.id);

    const response = await request(app).get(`/api/venues/${venueId}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.name, "Centre Court");
    assert.equal(response.body.data.ownerName, "Venue Owner");
    // ownerId stays the plain id; the owner's User document is not embedded.
    assert.equal(typeof response.body.data.ownerId, "string");
    assertNoSecrets(
      response.body,
      [
        ...privateFields,
        "dob",
        "addresses",
        "pushSubscriptions",
        "refundMethods",
        "email",
        "phone",
      ],
      [...privateValues, owner.email, "12 Private Lane", "5566778899", "push.example.test"]
    );
  });

  it("search listing carries none of the private fields either", async () => {
    const owner = await insertUser();
    await insertVenue(owner.id);

    const response = await request(app).get("/api/venues/search");

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].name, "Centre Court");
    assertNoSecrets(response.body, privateFields, privateValues);
  });

  it("gives the admin venue route the owner contact and notes, behind a permission", async () => {
    const owner = await insertUser({
      name: "Venue Owner",
      dob: new Date("1980-01-01"),
      addresses: [{ fullName: "Home", addressLine1: "12 Private Lane" }],
    });
    const venueId = await insertVenue(owner.id);

    const adminId = oid();
    await Admin.collection.insertOne({
      _id: adminId,
      name: "Admin",
      email: "admin@example.test",
      role: "SYSTEM_ADMIN",
      permissions: [],
      isActive: true,
    });
    const adminToken = tokenFor(adminId.toString(), "admin@example.test", "SYSTEM_ADMIN");

    const asAdmin = await request(app)
      .get(`/api/stats/venues/${venueId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(asAdmin.status, 200);
    assert.equal(asAdmin.body.data.ownerId.name, "Venue Owner");
    assert.equal(asAdmin.body.data.ownerId.email, owner.email);
    assert.equal(asAdmin.body.data.reviewNotes, "Internal: owner asked for a fee waiver");
    // Only the three fields the admin page renders, not the whole User.
    assertNoSecrets(
      asAdmin.body.data.ownerId,
      ["dob", "addresses", "pushSubscriptions"],
      ["12 Private Lane"]
    );

    const anonymous = await request(app).get(`/api/stats/venues/${venueId}`);
    assert.equal(anonymous.status, 401);

    const player = await insertUser();
    const asPlayer = await request(app)
      .get(`/api/stats/venues/${venueId}`)
      .set("Authorization", `Bearer ${tokenFor(player.id, player.email, "Player")}`);
    assert.equal(asPlayer.status, 403);
  });
});

describe("academy profile and onboarding", () => {
  const startPayload = {
    ownerName: "Academy Owner",
    ownerEmail: "academy.owner@example.com",
    ownerPhone: "+919812345678",
    name: "Ace Tennis Academy",
    legalName: "Ace Tennis Academy Pvt Ltd",
    sports: ["Tennis"],
    ageGroups: ["kids"],
    description: "Coaching for juniors across all levels.",
  };

  const step7 = {
    bankAccountName: "Ace Tennis Academy",
    bankAccountNumber: ACCOUNT,
    bankAccountNumberConfirm: ACCOUNT,
    bankIfsc: IFSC,
    upiId: UPI,
    payoutFrequency: "weekly",
    cancellationPolicy: "Cancel 24 hours ahead for a full refund.",
    refundPolicy: "Refunds are issued within seven days.",
    agreeToTerms: true,
  };

  const startOnboarding = async () => {
    const response = await request(app).post("/api/academies/onboarding/start").send(startPayload);
    assert.equal(response.status, 201);
    return {
      academyId: response.body.data.academyId as string,
      token: response.body.data.onboardingToken as string,
    };
  };

  it("serves the public profile without bank, PAN, KYC or owner data", async () => {
    const ownerId = oid();
    await Academy.collection.insertOne({
      _id: ownerId,
      ownerId: oid(),
      name: "Approved Academy",
      legalName: "Approved Academy Pvt Ltd",
      slug: "approved-academy",
      description: "Great coaching.",
      sports: ["Tennis"],
      ageGroups: ["kids"],
      city: "Mumbai",
      contactEmail: "info@approved.example.test",
      contactPhone: "+919800000001",
      sessionRatePerHour: 50000,
      isApproved: true,
      kycVerified: true,
      isActive: true,
      rating: 4.2,
      reviewCount: 5,
      panNumber: PAN,
      panDocumentUrl: "https://files.example.test/pan.pdf",
      panDocumentKey: "kyc/pan.pdf",
      gstNumber: "29ABCDE1234F1Z5",
      aadhaarLast4: "4321",
      bankAccountNumber: encryptValue(ACCOUNT),
      bankIfsc: encryptValue(IFSC),
      upiId: encryptValue(UPI),
      bankAccountName: "Approved Academy",
      rejectionReason: "none",
      academyCoaches: [{ firstName: "A", lastName: "B", email: "coach.pii@example.test" }],
      venueIds: [],
      coachIds: [],
      subscriptionPlans: [],
      sessionPackages: [],
    });

    const response = await request(app).get("/api/academies/approved-academy");

    assert.equal(response.status, 200);
    assert.equal(response.body.data.name, "Approved Academy");
    assert.equal(response.body.data.contactEmail, "info@approved.example.test");
    assertNoSecrets(
      response.body,
      [
        "bankAccountNumber",
        "bankIfsc",
        "upiId",
        "bankAccountName",
        "panNumber",
        "panDocumentUrl",
        "panDocumentKey",
        "gstNumber",
        "aadhaarLast4",
        "ownerId",
        "legalName",
        "academyCoaches",
        "onboardingTokenHash",
        "rejectionReason",
      ],
      [ACCOUNT, IFSC, UPI, PAN, "4321", "coach.pii@example.test", "29ABCDE1234F1Z5"]
    );
  });

  it("start issues a token and stores only its hash", async () => {
    const { academyId, token } = await startOnboarding();

    assert.match(token, /^[0-9a-f]{64}$/);
    const stored = await Academy.collection.findOne({
      _id: new mongoose.Types.ObjectId(academyId),
    });
    assert.ok(stored.onboardingTokenHash, "a hash is stored");
    assert.notEqual(stored.onboardingTokenHash, token, "the token itself is not stored");
  });

  it("refuses every onboarding route without the token, with the same 404 as a missing academy", async () => {
    const { academyId } = await startOnboarding();
    const missing = oid().toString();

    const calls: Array<[string, string, unknown]> = [
      ["get", `/progress`, undefined],
      ["put", `/step/7`, step7],
      ["post", `/image-upload-urls`, { imageTypes: ["logo"] }],
      ["post", `/confirm-images`, {}],
      ["post", `/document-upload-urls`, { docTypes: ["panDocument"] }],
      ["post", `/confirm-documents`, {}],
      ["post", `/submit`, undefined],
    ];

    for (const [method, suffix, body] of calls) {
      const denied = await (request(app) as any)
        [method](`/api/academies/onboarding/${academyId}${suffix}`)
        .send(body);
      const absent = await (request(app) as any)
        [method](`/api/academies/onboarding/${missing}${suffix}`)
        .send(body);
      assert.equal(denied.status, 404, `${method} ${suffix} without a token`);
      assert.equal(absent.status, 404, `${method} ${suffix} on a missing academy`);
      assert.equal(denied.body.message, absent.body.message, "no signal that the id is real");
    }

    const malformed = await request(app).get("/api/academies/onboarding/not-an-id/progress");
    assert.equal(malformed.status, 404);

    // And nothing was written by the refused step 7.
    const stored = await Academy.collection.findOne({
      _id: new mongoose.Types.ObjectId(academyId),
    });
    assert.ok(!stored.bankAccountNumber, "a refused call must not write payout details");
  });

  it("refuses a wrong token, and a token for a different academy", async () => {
    const first = await startOnboarding();
    const second = await request(app)
      .post("/api/academies/onboarding/start")
      .send({ ...startPayload, ownerEmail: "second@example.com", name: "Second Academy" });
    const otherToken = second.body.data.onboardingToken as string;

    const wrong = await request(app)
      .get(`/api/academies/onboarding/${first.academyId}/progress`)
      .set("X-Academy-Onboarding-Token", "0".repeat(64));
    assert.equal(wrong.status, 404);

    const crossed = await request(app)
      .get(`/api/academies/onboarding/${first.academyId}/progress`)
      .set("X-Academy-Onboarding-Token", otherToken);
    assert.equal(crossed.status, 404);
  });

  it("lets the token holder complete a step, and stores payout details encrypted", async () => {
    const { academyId, token } = await startOnboarding();

    const saved = await request(app)
      .put(`/api/academies/onboarding/${academyId}/step/7`)
      .set("X-Academy-Onboarding-Token", token)
      .send(step7);
    assert.equal(saved.status, 200);

    const stored = await Academy.collection.findOne({
      _id: new mongoose.Types.ObjectId(academyId),
    });
    for (const field of ["bankAccountNumber", "bankIfsc", "upiId"]) {
      assert.match(
        stored[field],
        /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/,
        `${field} is stored encrypted`
      );
    }
    const rawText = JSON.stringify(stored);
    assert.ok(!rawText.includes(ACCOUNT) && !rawText.includes(IFSC) && !rawText.includes(UPI));

    // The holder still reads their own values back, and never the token hash.
    const progress = await request(app)
      .get(`/api/academies/onboarding/${academyId}/progress`)
      .set("X-Academy-Onboarding-Token", token);
    assert.equal(progress.status, 200);
    assert.equal(progress.body.data.data.bankAccountNumber, ACCOUNT);
    assert.ok(!JSON.stringify(progress.body).includes("onboardingTokenHash"));
  });

  it("lets the linked owner account and an admin in without a token, and nobody else", async () => {
    const owner = await insertUser({ email: startPayload.ownerEmail, phone: "9812345678" });
    const { academyId } = await startOnboarding();
    const stored = await Academy.collection.findOne({
      _id: new mongoose.Types.ObjectId(academyId),
    });
    assert.equal(String(stored.ownerId), owner.id, "start links the existing owner account");

    const asOwner = await request(app)
      .get(`/api/academies/onboarding/${academyId}/progress`)
      .set("Authorization", `Bearer ${tokenFor(owner.id, owner.email, "Academy")}`);
    assert.equal(asOwner.status, 200);

    const stranger = await insertUser();
    const asStranger = await request(app)
      .get(`/api/academies/onboarding/${academyId}/progress`)
      .set("Authorization", `Bearer ${tokenFor(stranger.id, stranger.email, "Player")}`);
    assert.equal(asStranger.status, 404);

    const adminId = oid().toString();
    const asAdmin = await request(app)
      .get(`/api/academies/onboarding/${academyId}/progress`)
      .set("Authorization", `Bearer ${tokenFor(adminId, "admin@example.test", "SUPPORT_ADMIN")}`);
    assert.equal(asAdmin.status, 200);
  });
});
