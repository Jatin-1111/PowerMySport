import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { deliveryAddressLine, resolveBookingDelivery } from "../client/services/BookingDelivery";

/**
 * `resolveBookingDelivery` is the single answer to "where does this session
 * happen". These tests pin two things:
 *
 *  1. It reproduces the booking flow's EXISTING placement rules exactly — this
 *     phase records the decision, it does not change it.
 *  2. It never invents a location it was not given. Fabricating an address is
 *     the failure mode the field exists to remove, since it feeds tax invoices.
 */

const venueId = new mongoose.Types.ObjectId();

const venue = {
  _id: venueId,
  name: "Baseline Sports Arena",
  address: "44 MG Road, Bengaluru, Karnataka 560001",
  location: { coordinates: [77.5946, 12.9716] },
};

const ownVenueCoach = {
  serviceMode: "OWN_VENUE",
  ownVenueDetails: {
    name: "Kasparov Chess Room",
    address: "12 Residency Road, Bengaluru, Karnataka 560025",
    location: { coordinates: [77.6033, 12.9698] },
  },
};

const freelanceCoach = { serviceMode: "FREELANCE" };
const hybridCoach = {
  serviceMode: "HYBRID",
  ownVenueDetails: { name: "Side Studio", address: "9 Church St" },
};

const studentLocation = {
  coordinates: [77.6101, 12.9345] as [number, number],
};

// ───────────────── a listed venue always wins ─────────────────

test("a venue booking is delivered at that venue, snapshotted", () => {
  const delivery = resolveBookingDelivery({ venue });

  assert.equal(delivery?.kind, "PLATFORM_VENUE");
  assert.equal(delivery?.venueId, venueId);
  assert.equal(delivery?.nameSnapshot, "Baseline Sports Arena");
  assert.equal(delivery?.addressSnapshot, "44 MG Road, Bengaluru, Karnataka 560001");
  assert.deepEqual(delivery?.coordinates, [77.5946, 12.9716]);
});

test("a coach booked at a listed venue is delivered at the venue, not the coach", () => {
  // The provider is the coach (providerType COACH), but the place is the venue.
  // Conflating those two questions is what produced the original bug.
  const delivery = resolveBookingDelivery({
    venue,
    coach: freelanceCoach,
    playerLocation: studentLocation,
  });

  assert.equal(delivery?.kind, "PLATFORM_VENUE");
  assert.equal(delivery?.venueId, venueId);
});

// ───────────────── coaches ─────────────────

test("an OWN_VENUE coach is delivered at the coach's own venue", () => {
  const delivery = resolveBookingDelivery({ coach: ownVenueCoach });

  assert.equal(delivery?.kind, "PROVIDER_VENUE");
  assert.equal(delivery?.addressSnapshot, "12 Residency Road, Bengaluru, Karnataka 560025");
});

test("an OWN_VENUE coach ignores the student's location, matching the booking flow", () => {
  // The service-radius check runs only for FREELANCE/HYBRID, so playerLocation
  // is collected but unused for OWN_VENUE. Placement must agree with that.
  const delivery = resolveBookingDelivery({
    coach: ownVenueCoach,
    playerLocation: studentLocation,
  });

  assert.equal(delivery?.kind, "PROVIDER_VENUE");
});

test("a FREELANCE coach is delivered at the student's location — the case that was being discarded", () => {
  const delivery = resolveBookingDelivery({
    coach: freelanceCoach,
    playerLocation: studentLocation,
  });

  assert.equal(delivery?.kind, "STUDENT_LOCATION");
  assert.deepEqual(delivery?.coordinates, [77.6101, 12.9345]);
});

test("a HYBRID coach booked without a venue travels to the student", () => {
  const delivery = resolveBookingDelivery({
    coach: hybridCoach,
    playerLocation: studentLocation,
  });

  assert.equal(delivery?.kind, "STUDENT_LOCATION");
  // Specifically NOT the coach's own venue, even though they have one.
  assert.equal(delivery?.addressSnapshot, undefined);
});

test("a student address is kept when the client sends one", () => {
  const delivery = resolveBookingDelivery({
    coach: freelanceCoach,
    playerLocation: { ...studentLocation, address: "31 Koramangala 5th Block" },
  });

  assert.equal(delivery?.addressSnapshot, "31 Koramangala 5th Block");
});

// ───────────────── never fabricate ─────────────────

test("an OWN_VENUE coach with no venue details yields no address rather than a wrong one", () => {
  // Selecting OWN_VENUE and filling the venue in later is allowed today, so
  // this booking must still succeed — with an honest blank.
  const delivery = resolveBookingDelivery({
    coach: { serviceMode: "OWN_VENUE" },
  });

  assert.equal(delivery?.kind, "PROVIDER_VENUE");
  assert.equal(delivery?.addressSnapshot, undefined);
});

test("a travelling coach with no student location yields no delivery at all", () => {
  // The booking flow rejects this earlier. If a future caller skips that check,
  // it must get nothing rather than a plausible-looking guess.
  const delivery = resolveBookingDelivery({ coach: freelanceCoach });

  assert.equal(delivery, undefined);
});

test("no provider at all yields no delivery", () => {
  assert.equal(resolveBookingDelivery({}), undefined);
});

// ───────────────── academies ─────────────────

test("an academy's four address fields are composed into one invoice line", () => {
  const delivery = resolveBookingDelivery({
    academy: {
      name: "Southside Academy",
      address: "7 Hosur Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560029",
    },
  });

  assert.equal(delivery?.kind, "PROVIDER_VENUE");
  assert.equal(delivery?.addressSnapshot, "7 Hosur Road, Bengaluru, Karnataka, 560029");
});

test("an academy with partial address fields skips the blanks", () => {
  const delivery = resolveBookingDelivery({
    academy: { name: "Northside Academy", city: "Pune" },
  });

  assert.equal(delivery?.addressSnapshot, "Pune");
});

// ───────────────── the snapshot is a snapshot ─────────────────

test("the resolved delivery does not track later edits to the provider profile", () => {
  // This is the whole point: an invoice must say where the session was when it
  // was sold. Previously the address was re-read from the live profile on every
  // render, so a coach editing their address rewrote issued invoices.
  const mutableCoach = {
    serviceMode: "OWN_VENUE",
    ownVenueDetails: { name: "Old Hall", address: "1 Old Street" },
  };

  const delivery = resolveBookingDelivery({ coach: mutableCoach });
  mutableCoach.ownVenueDetails = { name: "New Hall", address: "2 New Street" };

  assert.equal(delivery?.addressSnapshot, "1 Old Street");
});

// ───────────────── the invoice helper ─────────────────

test("deliveryAddressLine returns undefined rather than an empty string", () => {
  assert.equal(deliveryAddressLine(undefined), undefined);
  assert.equal(deliveryAddressLine({ kind: "PROVIDER_VENUE" }), undefined);
  assert.equal(deliveryAddressLine({ kind: "PROVIDER_VENUE", addressSnapshot: "   " }), undefined);
  assert.equal(
    deliveryAddressLine({ kind: "PROVIDER_VENUE", addressSnapshot: "1 Old St" }),
    "1 Old St"
  );
});
