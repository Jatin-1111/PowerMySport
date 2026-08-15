import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLD_EXPIRY_REASON,
  deriveSlotFromInstant,
  mapBookingStatusToExpertStatus,
  mapExpertCanceller,
  mapExpertStatusToBookingStatus,
  slotCrossesMidnightIST,
} from "../utils/expertSessionMapping";

// ───────────────── status: expert -> booking ─────────────────

test("an unpaid hold maps to AWAITING_PAYMENT", () => {
  assert.equal(
    mapExpertStatusToBookingStatus({ status: "PENDING_PAYMENT" }),
    "AWAITING_PAYMENT",
  );
});

test("paid but with no time agreed maps to AWAITING_PROVIDER", () => {
  assert.equal(
    mapExpertStatusToBookingStatus({ status: "PAID" }),
    "AWAITING_PROVIDER",
  );
});

test("a scheduled session the expert has not accepted is NOT confirmed", () => {
  // The substantive part of the merge: the old model could only express this
  // by pairing SCHEDULED with a separate acceptance field, so anything reading
  // status alone would have called this booking confirmed.
  assert.equal(
    mapExpertStatusToBookingStatus({
      status: "SCHEDULED",
      expertAcceptance: "PENDING",
    }),
    "AWAITING_PROVIDER",
  );
});

test("a scheduled session the expert accepted is CONFIRMED", () => {
  assert.equal(
    mapExpertStatusToBookingStatus({
      status: "SCHEDULED",
      expertAcceptance: "ACCEPTED",
    }),
    "CONFIRMED",
  );
});

test("a declined session is CANCELLED regardless of it being scheduled", () => {
  assert.equal(
    mapExpertStatusToBookingStatus({
      status: "SCHEDULED",
      expertAcceptance: "DECLINED",
    }),
    "CANCELLED",
  );
});

test("a missing acceptance is treated as not-yet-accepted", () => {
  assert.equal(
    mapExpertStatusToBookingStatus({ status: "SCHEDULED" }),
    "AWAITING_PROVIDER",
  );
});

test("COMPLETED maps straight through", () => {
  assert.equal(
    mapExpertStatusToBookingStatus({ status: "COMPLETED" }),
    "COMPLETED",
  );
});

test("a system-cancelled unpaid hold becomes EXPIRED, not CANCELLED", () => {
  // "the customer never paid" and "someone cancelled this" are different
  // outcomes that ExpertSession flattened into one status.
  assert.equal(
    mapExpertStatusToBookingStatus({
      status: "CANCELLED",
      cancelledBy: "SYSTEM",
      cancelReason: HOLD_EXPIRY_REASON,
    }),
    "EXPIRED",
  );
});

test("other cancellations stay CANCELLED", () => {
  for (const cancelledBy of ["CLIENT", "EXPERT", "ADMIN"] as const) {
    assert.equal(
      mapExpertStatusToBookingStatus({
        status: "CANCELLED",
        cancelledBy,
        cancelReason: "changed my mind",
      }),
      "CANCELLED",
    );
  }
});

test("a SYSTEM cancellation for some other reason is not silently called EXPIRED", () => {
  assert.equal(
    mapExpertStatusToBookingStatus({
      status: "CANCELLED",
      cancelledBy: "SYSTEM",
      cancelReason: "payment failed at gateway",
    }),
    "CANCELLED",
  );
});

test("an unknown expert status throws rather than guessing", () => {
  assert.throws(
    () =>
      mapExpertStatusToBookingStatus({
        status: "SOMETHING_NEW" as never,
      }),
    /Unmapped ExpertSession status/,
  );
});

// ───────────────── status: booking -> expert (compat shim) ─────────────────

test("AWAITING_PROVIDER splits back on whether a time is set", () => {
  assert.equal(
    mapBookingStatusToExpertStatus({ status: "AWAITING_PROVIDER" }),
    "PAID",
  );
  assert.equal(
    mapBookingStatusToExpertStatus({
      status: "AWAITING_PROVIDER",
      scheduledAt: new Date(),
    }),
    "SCHEDULED",
  );
});

test("the round trip is stable for every expert status", () => {
  const cases = [
    { status: "PENDING_PAYMENT" as const, scheduledAt: null },
    { status: "PAID" as const, scheduledAt: null },
    {
      status: "SCHEDULED" as const,
      expertAcceptance: "ACCEPTED" as const,
      scheduledAt: new Date(),
    },
    {
      status: "SCHEDULED" as const,
      expertAcceptance: "PENDING" as const,
      scheduledAt: new Date(),
    },
    { status: "COMPLETED" as const, scheduledAt: new Date() },
  ];

  for (const session of cases) {
    const bookingStatus = mapExpertStatusToBookingStatus(session);
    const back = mapBookingStatusToExpertStatus({
      status: bookingStatus,
      scheduledAt: session.scheduledAt ?? null,
    });
    assert.equal(
      back,
      session.status,
      `${session.status} -> ${bookingStatus} -> ${back}`,
    );
  }
});

test("EXPIRED reports back to the old API as CANCELLED", () => {
  // The old vocabulary has no EXPIRED, so the shim has to collapse it. This is
  // an accepted, documented loss in the compat direction only.
  assert.equal(
    mapBookingStatusToExpertStatus({ status: "EXPIRED" }),
    "CANCELLED",
  );
});

test("an unknown booking status throws rather than guessing", () => {
  assert.throws(
    () => mapBookingStatusToExpertStatus({ status: "WAT" as never }),
    /Unmapped booking status/,
  );
});

// ───────────────── canceller vocabulary ─────────────────

test("EXPERT is renamed to PROVIDER, others pass through", () => {
  assert.equal(mapExpertCanceller("EXPERT"), "PROVIDER");
  assert.equal(mapExpertCanceller("CLIENT"), "CLIENT");
  assert.equal(mapExpertCanceller("ADMIN"), "ADMIN");
  assert.equal(mapExpertCanceller("SYSTEM"), "SYSTEM");
  assert.equal(mapExpertCanceller(undefined), undefined);
  assert.equal(mapExpertCanceller(null), undefined);
});

// ───────────────── instant -> IST wall-clock slot ─────────────────

test("derives the IST slot from a UTC instant", () => {
  // 2026-05-01T04:30:00Z is 10:00 IST.
  const slot = deriveSlotFromInstant(
    new Date("2026-05-01T04:30:00.000Z"),
    60,
  );
  assert.equal(slot.date.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(slot.startTime, "10:00");
  assert.equal(slot.endTime, "11:00");
});

test("an instant late in the UTC day still lands on the correct IST date", () => {
  // 2026-05-01T20:00:00Z is 01:30 IST on 2026-05-02 — the IST date is a day
  // ahead, which is exactly the case naive local-time arithmetic gets wrong.
  const slot = deriveSlotFromInstant(
    new Date("2026-05-01T20:00:00.000Z"),
    60,
  );
  assert.equal(slot.date.toISOString(), "2026-05-02T00:00:00.000Z");
  assert.equal(slot.startTime, "01:30");
  assert.equal(slot.endTime, "02:30");
});

test("handles non-hour durations", () => {
  const slot = deriveSlotFromInstant(
    new Date("2026-05-01T04:30:00.000Z"),
    45,
  );
  assert.equal(slot.startTime, "10:00");
  assert.equal(slot.endTime, "10:45");
});

test("clamps rather than wrapping when a session crosses IST midnight", () => {
  // 23:30 IST + 90 minutes would wrap to 01:00, which reads as ending before
  // it started — worse than being clamped, since endTime has no day component.
  const scheduledAt = new Date("2026-05-01T18:00:00.000Z"); // 23:30 IST
  const slot = deriveSlotFromInstant(scheduledAt, 90);
  assert.equal(slot.startTime, "23:30");
  assert.equal(slot.endTime, "23:59");
  assert.ok(slot.endTime > slot.startTime, "endTime must follow startTime");
  assert.equal(slotCrossesMidnightIST(scheduledAt, 90), true);
});

test("does not flag an ordinary session as crossing midnight", () => {
  assert.equal(
    slotCrossesMidnightIST(new Date("2026-05-01T04:30:00.000Z"), 60),
    false,
  );
});

test("falls back to 60 minutes for a missing or nonsensical duration", () => {
  const scheduledAt = new Date("2026-05-01T04:30:00.000Z");
  for (const duration of [0, -30, NaN]) {
    assert.equal(deriveSlotFromInstant(scheduledAt, duration).endTime, "11:00");
  }
});

test("produces zero-padded HH:mm", () => {
  // 03:05 IST — both components need padding.
  const slot = deriveSlotFromInstant(
    new Date("2026-05-01T21:35:00.000Z"),
    5,
  );
  assert.equal(slot.startTime, "03:05");
  assert.equal(slot.endTime, "03:10");
  assert.match(slot.startTime, /^\d{2}:\d{2}$/);
});
