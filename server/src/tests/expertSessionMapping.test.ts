import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPERT_BOOKING_SPORT,
  HOLD_EXPIRY_REASON,
  deriveSlotFromInstant,
  mapBookingStatusToExpertStatus,
  mapExpertCanceller,
  mapExpertStatusToBookingStatus,
  projectExpertSessionAsBooking,
  slotCrossesMidnightIST,
  type ExpertSessionForProjection,
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

// ───────────────── read-time projection: session -> booking ─────────────────

const sessionFixture = (
  overrides: Partial<ExpertSessionForProjection> = {},
): ExpertSessionForProjection => ({
  _id: "sess-1",
  userId: "user-1",
  expertId: "expert-1",
  amount: 1500,
  durationMinutes: 60,
  // 2026-08-20T04:30:00Z is 10:00 IST.
  scheduledAt: new Date("2026-08-20T04:30:00.000Z"),
  status: "SCHEDULED",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-02T00:00:00.000Z"),
  ...overrides,
});

test("projects an accepted session as a CONFIRMED expert booking", () => {
  const row = projectExpertSessionAsBooking(
    sessionFixture({ expertAcceptance: "ACCEPTED" }),
  );
  assert.equal(row.providerType, "EXPERT");
  assert.equal(row.status, "CONFIRMED");
  assert.equal(row.sport, EXPERT_BOOKING_SPORT);
  assert.equal(row.totalAmount, 1500);
  assert.equal(row.startTime, "10:00");
  assert.equal(row.endTime, "11:00");
  assert.equal(row.bookingType, "INDIVIDUAL");
});

test("carries the session id so a migrated copy can be de-duplicated", () => {
  const row = projectExpertSessionAsBooking(sessionFixture());
  assert.equal(
    (row.expert as { legacySessionId?: string }).legacySessionId,
    "sess-1",
  );
});

test("leaves refundStatus unset so the client does not poll for a refund that never lands", () => {
  const row = projectExpertSessionAsBooking(
    sessionFixture({ refundStatus: "REQUIRED" }),
  );
  assert.equal(row.refundStatus, undefined);
  assert.equal(
    (row.expert as { manualRefundStatus?: string }).manualRefundStatus,
    "REQUIRED",
  );
});

test("an unscheduled paid session still gets slot fields, with scheduledAt null", () => {
  const row = projectExpertSessionAsBooking(
    sessionFixture({ status: "PAID", scheduledAt: null }),
  );
  assert.equal(row.status, "AWAITING_PROVIDER");
  assert.equal(row.scheduledAt, null);
  // Derived from createdAt rather than left undefined, since Booking requires them.
  assert.ok(typeof row.startTime === "string" && row.startTime.length === 5);
  assert.ok(row.date instanceof Date);
});

test("renames the canceller from EXPERT to PROVIDER", () => {
  const row = projectExpertSessionAsBooking(
    sessionFixture({
      status: "CANCELLED",
      cancelledBy: "EXPERT",
      cancelReason: "Unwell",
    }),
  );
  assert.equal(row.status, "CANCELLED");
  assert.equal(row.cancelledBy, "PROVIDER");
  assert.equal(row.cancellationReason, "Unwell");
});

test("a lapsed hold projects as EXPIRED, not CANCELLED", () => {
  const row = projectExpertSessionAsBooking(
    sessionFixture({
      status: "CANCELLED",
      cancelledBy: "SYSTEM",
      cancelReason: HOLD_EXPIRY_REASON,
    }),
  );
  assert.equal(row.status, "EXPIRED");
});

test("passes a populated expert through in place of the raw id", () => {
  const expert = { id: "expert-1", name: "Jatin" };
  const row = projectExpertSessionAsBooking(sessionFixture(), expert);
  assert.deepEqual(row.expertId, expert);
  // Without one, the raw reference is kept so the row is still identifiable.
  assert.equal(projectExpertSessionAsBooking(sessionFixture()).expertId, "expert-1");
});

test("the projected status always round-trips through the reverse mapping", () => {
  // PAID means "paid, no time agreed yet", so it must be modelled without a
  // scheduledAt — that field is the only thing separating it from SCHEDULED on
  // the way back, since both map to AWAITING_PROVIDER.
  const cases = [
    { status: "PENDING_PAYMENT" as const, scheduledAt: null },
    { status: "PAID" as const, scheduledAt: null },
    { status: "SCHEDULED" as const, expertAcceptance: "ACCEPTED" as const },
    { status: "COMPLETED" as const },
  ];

  for (const overrides of cases) {
    const row = projectExpertSessionAsBooking(sessionFixture(overrides));
    assert.equal(
      mapBookingStatusToExpertStatus({
        status: row.status,
        scheduledAt: row.scheduledAt as Date | null,
      }),
      overrides.status,
      `round trip failed for ${overrides.status}`,
    );
  }
});
