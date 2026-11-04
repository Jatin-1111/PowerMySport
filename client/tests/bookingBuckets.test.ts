import { describe, expect, it } from "vitest";

import { bucketBookings } from "../src/modules/booking/utils/bookingBuckets";
import type { Booking } from "../src/types";

/**
 * The parent's booking list showed three of their four booking kinds: expert
 * consultations were stored in their own collection and simply never appeared.
 * The rule below is what decides whether a booking is visible, so it is worth
 * pinning independently of the component that renders it.
 */

const booking = (over: Partial<Booking>): Booking =>
  ({
    id: "b1",
    userId: "u1",
    sport: "Tennis",
    date: "2026-08-20",
    startTime: "10:00",
    endTime: "11:00",
    totalAmount: 500,
    status: "CONFIRMED",
    bookingType: "INDIVIDUAL",
    organizerId: "u1",
    ...over,
  }) as Booking;

describe("bucketBookings", () => {
  it("files each provider type into its own bucket", () => {
    const buckets = bucketBookings([
      booking({ id: "v", providerType: "VENUE" }),
      booking({ id: "c", providerType: "COACH" }),
      booking({ id: "a", providerType: "ACADEMY" }),
      booking({ id: "e", providerType: "EXPERT" }),
    ]);

    expect(buckets.venues.map((b) => b.id)).toEqual(["v"]);
    expect(buckets.coaches.map((b) => b.id)).toEqual(["c"]);
    expect(buckets.academies.map((b) => b.id)).toEqual(["a"]);
    expect(buckets.experts.map((b) => b.id)).toEqual(["e"]);
  });

  it("keeps an in-person consultation with the experts, not the venues", () => {
    // The regression this guards: an IN_PERSON expert session can also carry a
    // venueId, and the old id-sniffing filter (`b.venueId && !b.coachId`) filed
    // it as a venue booking — so it vanished from the experts list.
    const buckets = bucketBookings([
      booking({
        id: "e",
        providerType: "EXPERT",
        expertId: { id: "x1", name: "Jatin" },
        venueId: "venue-1",
      }),
    ]);

    expect(buckets.experts.map((b) => b.id)).toEqual(["e"]);
    expect(buckets.venues).toEqual([]);
  });

  it("falls back to the provider ids when providerType is absent", () => {
    // Rows written before providerType existed still have to land somewhere.
    const buckets = bucketBookings([
      booking({ id: "v", venueId: "venue-1" }),
      booking({ id: "c", coachId: "coach-1" }),
      booking({ id: "a", academyId: "academy-1" }),
      booking({ id: "e", expertId: "expert-1" }),
    ]);

    expect(buckets.venues.map((b) => b.id)).toEqual(["v"]);
    expect(buckets.coaches.map((b) => b.id)).toEqual(["c"]);
    expect(buckets.academies.map((b) => b.id)).toEqual(["a"]);
    expect(buckets.experts.map((b) => b.id)).toEqual(["e"]);
  });

  it("prefers the expert id over a venue id in the fallback too", () => {
    const buckets = bucketBookings([
      booking({ id: "e", expertId: "expert-1", venueId: "venue-1" }),
    ]);

    expect(buckets.experts.map((b) => b.id)).toEqual(["e"]);
    expect(buckets.venues).toEqual([]);
  });

  it("returns every bucket even when there are no bookings", () => {
    // The tab row reads a count off each bucket, so a missing key would render
    // "undefined" rather than a zero.
    expect(bucketBookings([])).toEqual({
      venues: [],
      coaches: [],
      academies: [],
      experts: [],
    });
  });

  it("preserves the server's ordering within a bucket", () => {
    const buckets = bucketBookings([
      booking({ id: "first", providerType: "VENUE" }),
      booking({ id: "second", providerType: "VENUE" }),
    ]);

    expect(buckets.venues.map((b) => b.id)).toEqual(["first", "second"]);
  });
});
