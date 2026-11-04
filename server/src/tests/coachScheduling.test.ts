import assert from "node:assert/strict";
import test from "node:test";
import { allocateCreditValues } from "../client/services/CoachCreditLedgerService";
import { scheduledInstantsBetween } from "../client/services/CoachOccurrenceService";
import { zonedToUtc } from "../utils/zonedTime";

/**
 * The two pieces of pure arithmetic underneath recurring coaching: splitting a
 * period fee into credits, and turning a weekly wall-clock pattern into
 * instants. Both are the sort of code that is quietly wrong for months.
 */

// ───────────────── credit allocation ─────────────────

test("credit values always sum to exactly the fee charged", () => {
  // 4000 paise over 3 sessions is the classic case: naive division gives
  // 1333 x 3 = 3999, and the lost paisa compounds every period per student.
  for (const [total, count] of [
    [4000, 3],
    [100000, 7],
    [1, 4],
    [999999, 13],
    [0, 5],
  ] as Array<[number, number]>) {
    const values = allocateCreditValues(total, count);
    assert.equal(values.length, count);
    assert.equal(
      values.reduce((sum, v) => sum + v, 0),
      total,
      `allocation of ${total} over ${count} did not sum back to the total`
    );
  }
});

test("the rounding residue is spread, never dropped", () => {
  assert.deepEqual(allocateCreditValues(4000, 3), [1334, 1333, 1333]);
});

test("an exact division gives equal credits", () => {
  assert.deepEqual(allocateCreditValues(3000, 3), [1000, 1000, 1000]);
});

test("a fee smaller than the session count still balances", () => {
  // Four sessions bought for one paisa: someone gets it, nobody invents money.
  assert.deepEqual(allocateCreditValues(1, 4), [1, 0, 0, 0]);
});

test("no credits are granted for a zero session count", () => {
  assert.deepEqual(allocateCreditValues(5000, 0), []);
});

test("allocation refuses fractional paise rather than rounding silently", () => {
  assert.throws(() => allocateCreditValues(100.5, 2), /whole paise/);
});

test("allocation refuses a negative fee", () => {
  assert.throws(() => allocateCreditValues(-1, 2), /non-negative/);
});

// ───────────────── schedule materialisation ─────────────────

const offering = (overrides: Partial<Parameters<typeof scheduledInstantsBetween>[0]> = {}) =>
  ({
    // Tuesday and Thursday, 18:00 IST, one hour.
    schedule: [
      { dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 },
      { dayOfWeek: 4, startTime: "18:00", durationMinutes: 60 },
    ],
    timezone: "Asia/Kolkata",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    ...overrides,
  }) as Parameters<typeof scheduledInstantsBetween>[0];

test("a twice-weekly pattern yields two sessions per week", () => {
  const instants = scheduledInstantsBetween(
    offering(),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-15T00:00:00.000Z")
  );

  // Two weeks: Tue 1, Thu 3, Tue 8, Thu 10.
  assert.equal(instants.length, 4);
});

test("sessions are stored as instants, not wall-clock", () => {
  const instants = scheduledInstantsBetween(
    offering(),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-03T00:00:00.000Z")
  );

  // 18:00 IST on Tue 1 Sep 2026 is 12:30 UTC — the offset is applied, not the
  // wall-clock time stored raw.
  assert.equal(instants[0]?.scheduledAt.toISOString(), "2026-09-01T12:30:00.000Z");
});

test("the same wall-clock in a different zone is a different instant", () => {
  const ist = zonedToUtc("2026-09-01", 18 * 60, "Asia/Kolkata");
  const utc = zonedToUtc("2026-09-01", 18 * 60, "UTC");
  assert.notEqual(ist.getTime(), utc.getTime());
  assert.equal(utc.getTime() - ist.getTime(), 5.5 * 60 * 60 * 1000);
});

test("results are ordered by time", () => {
  const instants = scheduledInstantsBetween(
    offering(),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-30T00:00:00.000Z")
  );

  const times = instants.map((i) => i.scheduledAt.getTime());
  assert.deepEqual(
    times,
    [...times].sort((a, b) => a - b)
  );
});

test("nothing is generated before the offering starts", () => {
  const instants = scheduledInstantsBetween(
    offering({ startDate: new Date("2026-09-10T00:00:00.000Z") }),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-15T00:00:00.000Z")
  );

  assert.ok(
    instants.every((i) => i.scheduledAt >= new Date("2026-09-10T00:00:00.000Z")),
    "generated a session before the start date"
  );
});

test("nothing is generated after the offering ends", () => {
  const instants = scheduledInstantsBetween(
    offering({ endDate: new Date("2026-09-08T00:00:00.000Z") }),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-30T00:00:00.000Z")
  );

  assert.ok(
    instants.every((i) => i.scheduledAt <= new Date("2026-09-08T00:00:00.000Z")),
    "generated a session after the end date"
  );
});

test("an empty window yields nothing", () => {
  const instants = scheduledInstantsBetween(
    offering(),
    new Date("2026-09-10T00:00:00.000Z"),
    new Date("2026-09-10T00:00:00.000Z")
  );
  assert.equal(instants.length, 0);
});

test("each generated session carries its slot's duration", () => {
  const instants = scheduledInstantsBetween(
    offering({
      schedule: [
        { dayOfWeek: 2, startTime: "18:00", durationMinutes: 45 },
        { dayOfWeek: 4, startTime: "07:00", durationMinutes: 90 },
      ],
    }),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-05T00:00:00.000Z")
  );

  assert.deepEqual(
    instants.map((i) => i.durationMinutes),
    [45, 90]
  );
});

test("an early-morning slot is not pulled into the previous UTC day", () => {
  // 05:00 IST is 23:30 UTC the day BEFORE. The weekday must be read in the
  // offering's zone, not in UTC, or every such session lands a day early.
  const instants = scheduledInstantsBetween(
    offering({
      schedule: [{ dayOfWeek: 2, startTime: "05:00", durationMinutes: 60 }],
    }),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-08T00:00:00.000Z")
  );

  assert.equal(instants.length, 1);
  // Tuesday 1 Sep 05:00 IST is Monday 31 Aug 23:30 UTC — read the instant back
  // in IST and it must still be Tuesday morning.
  const asIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instants[0]!.scheduledAt);
  assert.match(asIst, /Tue/, `expected a Tuesday in IST, got ${asIst}`);
  assert.match(asIst, /05:00/, `expected 05:00 IST, got ${asIst}`);
});
