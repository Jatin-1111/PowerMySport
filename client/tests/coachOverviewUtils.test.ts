import { describe, expect, it } from "vitest";
import {
  availableDays,
  bookingMoment,
  clockLabel,
  dayLabel,
  selectRequests,
  selectUpcoming,
  serviceModeLabel,
  timeRange,
  verificationView,
  whenLabel,
} from "../src/modules/coach/utils/overview";
import type { Booking, Coach } from "../src/types";

const booking = (over: Record<string, unknown> = {}): Booking =>
  ({
    id: "b",
    status: "CONFIRMED",
    sport: "tennis",
    date: "2026-11-05T00:00:00.000Z",
    startTime: "17:30",
    endTime: "18:30",
    totalAmount: 1000,
    ...over,
  }) as unknown as Booking;

// A Thursday morning, local time.
const NOW = new Date("2026-11-05T09:00:00");

describe("bookingMoment", () => {
  it("joins the stored day and the HH:mm time on the local clock", () => {
    const start = bookingMoment(booking(), "start")!;
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 10, 5]);
    expect([start.getHours(), start.getMinutes()]).toEqual([17, 30]);
    expect(bookingMoment(booking(), "end")!.getHours()).toBe(18);
  });

  it("is null when the booking has no usable time", () => {
    expect(bookingMoment(booking({ startTime: undefined }), "start")).toBeNull();
    expect(bookingMoment(booking({ startTime: "soon" }), "start")).toBeNull();
    expect(bookingMoment(booking({ date: undefined }), "start")).toBeNull();
  });
});

describe("selectRequests", () => {
  it("keeps only requests waiting on the coach, soonest session first", () => {
    const later = booking({
      id: "later",
      status: "AWAITING_PROVIDER",
      date: "2026-11-08T00:00:00.000Z",
    });
    const sooner = booking({
      id: "sooner",
      status: "AWAITING_PROVIDER",
      date: "2026-11-06T00:00:00.000Z",
    });
    const confirmed = booking({ id: "confirmed", status: "CONFIRMED" });
    const paying = booking({ id: "paying", status: "AWAITING_PAYMENT" });

    expect(selectRequests([later, confirmed, paying, sooner]).map((b) => b.id)).toEqual([
      "sooner",
      "later",
    ]);
  });

  it("puts a request with no time last instead of dropping it", () => {
    const timeless = booking({ id: "timeless", status: "AWAITING_PROVIDER", startTime: undefined });
    const timed = booking({ id: "timed", status: "AWAITING_PROVIDER" });
    expect(selectRequests([timeless, timed]).map((b) => b.id)).toEqual(["timed", "timeless"]);
  });
});

describe("selectUpcoming", () => {
  it("returns confirmed sessions that have not finished, soonest first", () => {
    const evening = booking({ id: "evening" });
    const morning = booking({ id: "morning", startTime: "10:00", endTime: "11:00" });
    const finished = booking({ id: "finished", startTime: "07:00", endTime: "08:00" });
    const request = booking({ id: "request", status: "AWAITING_PROVIDER" });
    const done = booking({ id: "done", status: "COMPLETED", date: "2026-11-06T00:00:00.000Z" });

    expect(
      selectUpcoming([evening, finished, request, done, morning], NOW).map((b) => b.id)
    ).toEqual(["morning", "evening"]);
  });

  it("keeps a session that is running right now", () => {
    const running = booking({
      id: "running",
      startTime: "08:30",
      endTime: "09:30",
      status: "IN_PROGRESS",
    });
    expect(selectUpcoming([running], NOW)).toHaveLength(1);
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      booking({ id: `s${i}`, date: `2026-11-${10 + i}T00:00:00.000Z` })
    );
    expect(selectUpcoming(many, NOW, 5)).toHaveLength(5);
  });
});

describe("labels", () => {
  it("names today and tomorrow, and dates anything later", () => {
    expect(dayLabel(new Date("2026-11-05T17:30:00"), NOW)).toBe("Today");
    expect(dayLabel(new Date("2026-11-06T07:00:00"), NOW)).toBe("Tomorrow");
    expect(dayLabel(new Date("2026-11-09T07:00:00"), NOW)).toMatch(/Mon.*9.*Nov/);
  });

  it("reads clock times the way people say them", () => {
    expect(clockLabel("07:00")).toBe("7:00 am");
    expect(clockLabel("12:00")).toBe("12:00 pm");
    expect(clockLabel("00:15")).toBe("12:15 am");
    expect(clockLabel("17:30")).toBe("5:30 pm");
    expect(clockLabel("tbc")).toBe("tbc");
  });

  it("builds the line under a session without an em dash", () => {
    expect(timeRange(booking())).toBe("5:30 pm to 6:30 pm");
    const line = whenLabel(booking(), NOW);
    expect(line).toBe("Today, 5:30 pm to 6:30 pm");
    expect(line).not.toMatch(/[—–]/);
  });
});

describe("coach facts", () => {
  const coach = (over: Record<string, unknown> = {}): Coach =>
    ({
      id: "c",
      sports: ["Tennis"],
      hourlyRate: 1000,
      availability: [],
      ...over,
    }) as unknown as Coach;

  it("calls a verified coach verified and everyone else in review", () => {
    expect(verificationView(coach({ verificationStatus: "VERIFIED" }))).toEqual({
      tone: "live",
      tag: "Verified",
    });
    expect(verificationView(coach({ verificationStatus: "PENDING" })).tag).toBe("In review");
    expect(verificationView(coach({ verificationStatus: "REVIEW" })).tone).toBe("pending");
    // Legacy coaches can be verified with no status field at all.
    expect(verificationView(coach({ isVerified: true })).tag).toBe("Verified");
  });

  it("counts distinct open days, not slots", () => {
    const slot = (dayOfWeek: number) => ({ dayOfWeek, startTime: "06:00", endTime: "20:00" });
    expect(availableDays(coach({ availability: [slot(1), slot(1), slot(3)] }))).toBe(2);
    expect(availableDays(coach())).toBe(0);
  });

  it("describes how the coach works", () => {
    expect(serviceModeLabel("FREELANCE")).toBe("Travelling to clients");
    expect(serviceModeLabel("OWN_VENUE")).toBe("At your own venue");
    expect(serviceModeLabel(undefined)).toBe("Not set");
  });
});
