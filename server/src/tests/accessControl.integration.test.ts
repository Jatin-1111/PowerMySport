/* eslint-disable @typescript-eslint/no-var-requires */
// Ownership checks added after the security audit: a session alone is not
// enough, the caller must also own (or have a relationship with) the record.
//
//   - a coach may read a user's contact details only if that user booked with them
//   - only the linked owner (or an admin) may add plans to an academy
//   - a venue lister may only reference storage keys that belong to their venue
//
// Uses an in-memory MongoDB; nothing external is touched. Run via the build:
//   npm run build && node --test --test-force-exit dist/tests/accessControl.integration.test.js
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { getClientDetails, addClientNote } = require("../client/services/CoachClientService");
const { updateVenue } = require("../client/services/VenueService");
const { requireAcademyOnboardingAccess } = require("../middleware/academyOnboardingAccess");
const { Booking } = require("../client/models/Booking");
const { Coach } = require("../client/models/Coach");
const { User } = require("../client/models/User");
const { Venue } = require("../client/models/Venue");
const Academy = require("../admin/models/Academy").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
let mongod: any;

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
  await Promise.all(
    [Booking, Coach, User, Venue, Academy].map((model: any) => model.collection.deleteMany({}))
  );
});

describe("coach client lookup requires a booking relationship", () => {
  const seed = async (withBooking: boolean) => {
    const coachUserId = oid();
    const clientId = oid();
    const coachId = oid();
    await Coach.collection.insertOne({ _id: coachId, userId: coachUserId });
    await User.collection.insertOne({
      _id: clientId,
      name: "Client Parent",
      email: "client@example.com",
    });
    if (withBooking) {
      await Booking.collection.insertOne({
        coachId,
        userId: clientId,
        status: "CONFIRMED",
        sport: "tennis",
        date: new Date(),
      });
    }
    return { coachUserId: coachUserId.toString(), clientId: clientId.toString() };
  };

  it("returns the client's details when they have booked with the coach", async () => {
    const { coachUserId, clientId } = await seed(true);
    const details = await getClientDetails(coachUserId, clientId);
    assert.equal(details.email, "client@example.com");
    assert.equal(details.totalSessions, 1);
  });

  it("refuses a user the coach has no booking with, exactly like a missing user", async () => {
    const { coachUserId, clientId } = await seed(false);
    await assert.rejects(() => getClientDetails(coachUserId, clientId), /Client not found/);
    await assert.rejects(() => getClientDetails(coachUserId, oid().toString()), /Client not found/);
  });

  it("refuses to attach a note to a user the coach has no booking with", async () => {
    const { coachUserId, clientId } = await seed(false);
    await assert.rejects(
      () => addClientNote(coachUserId, clientId, { note: "private" }),
      /Client not found/
    );
  });
});

describe("academy plans require ownership of the academy", () => {
  const run = async (academyId: string, user?: { id: string; role: string }) => {
    let outcome: any = "none";
    await requireAcademyOnboardingAccess(
      { params: { academyId }, user, get: () => undefined },
      {},
      (error?: unknown) => {
        outcome = error ?? "allowed";
      }
    );
    return outcome;
  };

  it("lets the linked owner and an admin through, and 404s any other account", async () => {
    const ownerId = oid();
    const academyId = oid();
    await Academy.collection.insertOne({ _id: academyId, ownerId });

    assert.equal(
      await run(academyId.toString(), { id: ownerId.toString(), role: "Parent" }),
      "allowed"
    );
    assert.equal(
      await run(academyId.toString(), { id: oid().toString(), role: "Admin" }),
      "allowed"
    );

    const stranger = await run(academyId.toString(), { id: oid().toString(), role: "Parent" });
    assert.equal(stranger.statusCode, 404);
    const anonymous = await run(academyId.toString(), undefined);
    assert.equal(anonymous.statusCode, 404);
  });
});

describe("venue update only accepts storage keys that belong to the venue", () => {
  const seedVenue = async (extra: Record<string, unknown> = {}) => {
    const ownerId = oid();
    const venueId = oid();
    await Venue.collection.insertOne({
      _id: venueId,
      ownerId,
      name: "Court One",
      approvalStatus: "PENDING",
      ...extra,
    });
    return { ownerId: ownerId.toString(), venueId: venueId.toString() };
  };

  it("rejects a document key that points at another provider's object", async () => {
    const { ownerId, venueId } = await seedVenue();
    await assert.rejects(
      () =>
        updateVenue(venueId, ownerId, {
          documents: [
            { type: "X", url: "x", fileName: "x.pdf", s3Key: "coaches/abc/documents/id_1.pdf" },
          ],
        }),
      /Invalid image or document reference/
    );
    await assert.rejects(
      () => updateVenue(venueId, ownerId, { coverPhotoKey: "users/someone/photo.jpg" }),
      /Invalid image or document reference/
    );
    await assert.rejects(
      () => updateVenue(venueId, ownerId, { generalImageKeys: [`venues/${venueId}/../x.jpg`] }),
      /Invalid image or document reference/
    );
  });

  it("accepts keys under the venue's own prefix", async () => {
    const { ownerId, venueId } = await seedVenue();
    const updated = await updateVenue(venueId, ownerId, {
      generalImageKeys: [`venues/${venueId}/images/a.jpg`],
      coverPhotoKey: `venues/${venueId}/images/a.jpg`,
    });
    assert.deepEqual(updated.generalImageKeys, [`venues/${venueId}/images/a.jpg`]);
  });

  it("keeps accepting a key already stored on the venue, whatever its format", async () => {
    const legacyKey = "legacy-folder/old-photo.jpg";
    const { ownerId, venueId } = await seedVenue({ generalImageKeys: [legacyKey] });
    const updated = await updateVenue(venueId, ownerId, {
      generalImageKeys: [legacyKey],
      name: "Court One (renamed)",
    });
    assert.equal(updated.name, "Court One (renamed)");
  });
});
