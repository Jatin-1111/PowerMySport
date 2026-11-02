// The academy sign-up contract: the exact sequence of calls a complete, valid
// sign-up makes, from start to submit, through the real API. Every form that
// drives onboarding (the public one and the admin one) must be able to make these
// calls. If the server's step rules change, this fails first.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
// Mail must never leave the machine from a test: dotenv does not overwrite these.
process.env.EMAIL_HOST = "127.0.0.1";
process.env.EMAIL_PORT = "1";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const redis = require("../config/redis").default;

const col = (name: string) => mongoose.connection.db.collection(name);
const TOKEN_HEADER = "x-academy-onboarding-token";

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
  for (const name of ["academies", "emailverifications", "ratelimits"]) {
    await col(name).deleteMany({});
  }
});

const EMAIL = "journey.owner@example.com";
const PHONE = "+919876500010";
const img = (n: string) => `https://example.test/${n}.jpg`;

const day = { isOpen: true, openTime: "06:00", closeTime: "20:00" };
const openingHours = {
  monday: day,
  tuesday: day,
  wednesday: day,
  thursday: day,
  friday: day,
  saturday: day,
  sunday: { isOpen: false },
};

const payloads = {
  start: {
    ownerName: "Journey Owner",
    ownerEmail: EMAIL,
    ownerPhone: PHONE,
    name: "Journey Academy",
    legalName: "Journey Academy Pvt Ltd",
    sports: ["Tennis"],
    ageGroups: ["kids", "teens"],
    description: "A tennis academy for juniors in Delhi.",
  },
  2: {
    location: { type: "Point", coordinates: [77.209, 28.6139] },
    address: "12 Test Road, Connaught Place",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    contactPersonName: "Journey Owner",
    contactPhone: PHONE,
    whatsappNumber: PHONE,
    contactEmail: EMAIL,
    languagesSpoken: ["English", "Hindi"],
  },
  3: {
    businessType: "sole_proprietorship",
    panNumber: "ABCDE1234F",
    panDocumentUrl: "https://example.test/pan.pdf",
    aadhaarLast4: "1234",
  },
  5: {
    academyCoaches: [
      { firstName: "Asha", lastName: "Rao", email: "asha@example.com", sports: ["Tennis"] },
    ],
  },
  6: {
    sessionRatePerHour: 60000,
    batchTimings: ["morning", "evening"],
    maxBatchSize: 12,
    trialsessionOffered: true,
    trialSessionPrice: 20000,
  },
  7: {
    bankAccountName: "Journey Academy",
    bankAccountNumber: "123456789012",
    bankAccountNumberConfirm: "123456789012",
    bankIfsc: "HDFC0001234",
    upiId: "journey@okhdfcbank",
    payoutFrequency: "weekly",
    cancellationPolicy: "Cancel at least 24 hours before for a full refund.",
    refundPolicy: "Refunds are processed within seven days of cancellation.",
    agreeToTerms: true,
  },
};

/** Step 4 with photos stored where the upload links put them: venues/<academyId>/images/. */
const venuesPayload = (academyId: string) => {
  const key = (name: string) => `venues/${academyId}/images/${name}.jpg`;
  const general = ["g1", "g2", "g3"];
  const tennis = ["t1", "t2", "t3", "t4", "t5"];
  return {
    academyVenues: [
      {
        name: "Main Courts",
        address: "5 Court Lane, Connaught Place",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        location: { type: "Point", coordinates: [77.21, 28.614] },
        sports: ["Tennis"],
        pricePerHour: 50000,
        amenities: ["Parking"],
        openingHours,
        allowExternalCoaches: true,
        generalImages: general.map(img),
        generalImageKeys: general.map(key),
        sportImages: { Tennis: tennis.map(img) },
        sportImageKeys: { Tennis: tennis.map(key) },
        coverPhotoUrl: img("g1"),
        coverPhotoKey: key("g1"),
      },
    ],
  };
};

const start = async () => {
  const response = await request(app).post("/api/academies/onboarding/start").send(payloads.start);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return {
    id: response.body.data.academyId as string,
    token: response.body.data.onboardingToken as string,
  };
};

const saveStep = (id: string, token: string, step: number, body: unknown) =>
  request(app)
    .put(`/api/academies/onboarding/${id}/step/${step}`)
    .set(TOKEN_HEADER, token)
    .send(body);

const verifyEmail = async (id: string, token: string) => {
  const sent = await request(app)
    .post(`/api/academies/onboarding/${id}/send-verification`)
    .set(TOKEN_HEADER, token);
  assert.equal(sent.status, 200);
  const record = await col("emailverifications").findOne({ email: EMAIL });
  const verified = await request(app)
    .post(`/api/academies/onboarding/${id}/verify-email`)
    .set(TOKEN_HEADER, token)
    .send({ code: record?.code });
  assert.equal(verified.status, 200);
};

describe("academy sign-up journey", () => {
  it("completes: start, steps 2 to 7, email code, submit", async () => {
    const { id, token } = await start();

    for (const step of [2, 3, 4, 5, 6, 7] as const) {
      const body = step === 4 ? venuesPayload(id) : payloads[step];
      const response = await saveStep(id, token, step, body);
      assert.equal(response.status, 200, `step ${step}: ${JSON.stringify(response.body)}`);
    }

    await verifyEmail(id, token);

    const submitted = await request(app)
      .post(`/api/academies/onboarding/${id}/submit`)
      .set(TOKEN_HEADER, token);
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));

    const stored = await col("academies").findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.equal(stored?.onboardingStep, 7);
    assert.equal(stored?.onboardingCompleted, true);
    assert.equal(stored?.lifecycle, "SUBMITTED");
    assert.equal(stored?.academyVenues.length, 1);
    assert.equal(stored?.academyCoaches.length, 1);
    assert.equal(stored?.sessionRatePerHour, 60000);
    // Payout details are sealed, never stored as typed.
    assert.notEqual(stored?.bankAccountNumber, "123456789012");
    assert.ok(stored?.bankAccountNumber);
  });

  it("refuses submission until the last step is reached", async () => {
    const { id, token } = await start();
    for (const step of [2, 3, 4, 5, 6] as const) {
      const body = step === 4 ? venuesPayload(id) : payloads[step];
      assert.equal((await saveStep(id, token, step, body)).status, 200);
    }
    await verifyEmail(id, token);
    const early = await request(app)
      .post(`/api/academies/onboarding/${id}/submit`)
      .set(TOKEN_HEADER, token);
    assert.ok(early.status >= 400);
  });

  it("rejects the old public form's payloads", async () => {
    const { id, token } = await start();
    const oldVenuesStep = await saveStep(id, token, 4, {
      allowsExternalCoaches: true,
      venueIds: [],
      coachIds: [],
    });
    assert.equal(oldVenuesStep.status, 400);

    const payoutsWithoutConfirmation = await saveStep(id, token, 7, {
      ...payloads[7],
      bankAccountNumberConfirm: undefined,
      agreeToTerms: undefined,
    });
    assert.equal(payoutsWithoutConfirmation.status, 400);
  });

  it("does not need a subscription plan on step 6, and does not store one", async () => {
    const { id, token } = await start();
    assert.equal((await saveStep(id, token, 6, payloads[6])).status, 200);
    const withPlan = await saveStep(id, token, 6, {
      ...payloads[6],
      subscriptionPlans: [
        {
          name: "Monthly juniors",
          duration: "monthly",
          price: 400000,
          includesVenue: true,
          includesCoaching: true,
        },
      ],
    });
    assert.equal(withPlan.status, 200);
    const stored = await col("academies").findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.deepEqual(stored?.subscriptionPlans ?? [], []);
  });

  it("holds pricing to sensible limits on step 6", async () => {
    const { id, token } = await start();
    const bad = async (change: Record<string, unknown>) =>
      (await saveStep(id, token, 6, { ...payloads[6], ...change })).status;

    assert.equal(await bad({ sessionRatePerHour: 0 }), 400);
    assert.equal(await bad({ sessionRatePerHour: 99 }), 400);
    assert.equal(await bad({ sessionRatePerHour: 100_000_001 }), 400);
    assert.equal(await bad({ sessionRatePerHour: 600.5 }), 400);
    assert.equal(await bad({ maxBatchSize: 0 }), 400);
    assert.equal(await bad({ maxBatchSize: 101 }), 400);
    assert.equal(await bad({ maxBatchSize: 2.5 }), 400);
    assert.equal(await bad({ trialSessionPrice: -1 }), 400);
    assert.equal(await bad({ batchTimings: [] }), 400);

    assert.equal(await bad({ sessionRatePerHour: 100, maxBatchSize: 1 }), 200);
    assert.equal(await bad({ sessionRatePerHour: 100_000_000, maxBatchSize: 100 }), 200);
    assert.equal(await bad({ trialsessionOffered: true, trialSessionPrice: 0 }), 200);
  });

  it("takes a bank account, a UPI ID, or both, and replaces what was saved before", async () => {
    const { id, token } = await start();
    const {
      bankAccountName,
      bankAccountNumber,
      bankAccountNumberConfirm,
      bankIfsc,
      upiId,
      ...rest
    } = payloads[7];
    void bankAccountName;
    void bankAccountNumber;
    void bankAccountNumberConfirm;
    void bankIfsc;

    // Bank account only.
    const bankOnly = {
      ...rest,
      bankAccountName: "Journey Academy",
      bankAccountNumber: "123456789012",
      bankAccountNumberConfirm: "123456789012",
      bankIfsc: "HDFC0001234",
    };
    assert.equal((await saveStep(id, token, 7, bankOnly)).status, 200);
    let stored = await col("academies").findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.ok(stored?.bankAccountNumber);
    assert.equal(stored?.upiId, "");

    // UPI only replaces the bank details instead of leaving them behind.
    assert.equal((await saveStep(id, token, 7, { ...rest, upiId })).status, 200);
    stored = await col("academies").findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.ok(stored?.upiId);
    assert.equal(stored?.bankAccountNumber, "");
    assert.equal(stored?.bankIfsc, "");

    // Neither is refused.
    assert.equal((await saveStep(id, token, 7, rest)).status, 400);
  });

  it("treats bank details as all or nothing, and holds the account number to digits", async () => {
    const { id, token } = await start();
    const base = { ...payloads[7] };
    const bad = async (change: Record<string, unknown>) =>
      (await saveStep(id, token, 7, { ...base, ...change })).status;

    assert.equal(await bad({ bankIfsc: "" }), 400);
    assert.equal(await bad({ bankAccountName: "" }), 400);
    assert.equal(
      await bad({ bankAccountNumber: "12345678", bankAccountNumberConfirm: "12345678" }),
      400
    );
    assert.equal(
      await bad({
        bankAccountNumber: "1234 5678 9012",
        bankAccountNumberConfirm: "1234 5678 9012",
      }),
      400
    );
    assert.equal(
      await bad({ bankAccountNumber: "1".repeat(19), bankAccountNumberConfirm: "1".repeat(19) }),
      400
    );
    assert.equal(await bad({ bankIfsc: "hdfc0001234" }), 400);
    assert.equal(await bad({ upiId: "not-a-upi" }), 400);
    assert.equal(await bad({ cancellationPolicy: "x".repeat(2001) }), 400);
    assert.equal(await bad({ payoutFrequency: "daily" }), 400);
    assert.equal(await bad({}), 200);
  });

  it("needs the payout confirmation and the terms to match", async () => {
    const { id, token } = await start();
    const mismatch = await saveStep(id, token, 7, {
      ...payloads[7],
      bankAccountNumberConfirm: "999999999999",
    });
    assert.equal(mismatch.status, 400);
    const notAgreed = await saveStep(id, token, 7, { ...payloads[7], agreeToTerms: false });
    assert.equal(notAgreed.status, 400);
  });
  describe("venue photos", () => {
    const withVenue = (id: string, change: (venue: Record<string, any>) => void) => {
      const payload = venuesPayload(id);
      change(payload.academyVenues[0] as Record<string, any>);
      return payload;
    };

    it("refuses a photo address that did not come from our upload links", async () => {
      const { id, token } = await start();
      const response = await saveStep(
        id,
        token,
        4,
        withVenue(id, (v) => {
          v.generalImageKeys[0] = "elsewhere/not-ours.jpg";
        })
      );
      assert.equal(response.status, 400);
      assert.match(response.body.message, /uploaded through the form/);
    });

    it("refuses another academy's photo keys", async () => {
      const { id, token } = await start();
      const response = await saveStep(
        id,
        token,
        4,
        withVenue(id, (v) => {
          v.sportImageKeys.Tennis[0] = "venues/someone-else/images/t1.jpg";
        })
      );
      assert.equal(response.status, 400);
    });

    it("refuses photos sent without their storage keys", async () => {
      const { id, token } = await start();
      const response = await saveStep(
        id,
        token,
        4,
        withVenue(id, (v) => {
          v.generalImageKeys = [];
        })
      );
      assert.equal(response.status, 400);
    });

    it("refuses a cover photo that is not one of the general photos", async () => {
      const { id, token } = await start();
      const response = await saveStep(
        id,
        token,
        4,
        withVenue(id, (v) => {
          v.coverPhotoUrl = "https://example.test/other.jpg";
        })
      );
      assert.equal(response.status, 400);
      assert.match(response.body.message, /cover photo/);
    });
  });
});
