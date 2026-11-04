import { describe, expect, it } from "vitest";

import { formatEntryDate, fromDateInput, headerLine, toDateInput, todayInput } from "./format";

describe("entry dates", () => {
  it("shows a stored date in UTC, so no one west of Greenwich sees the day before", () => {
    const march = "2026-03-01T00:00:00.000Z";
    expect(formatEntryDate(march, "day")).toBe("1 Mar 2026");
    expect(formatEntryDate(march, "month")).toBe("Mar 2026");
    expect(formatEntryDate(march, "year")).toBe("2026");
  });

  it("turns what a date input holds into the day the server takes", () => {
    expect(fromDateInput("2026-03-15", "day")).toBe("2026-03-15");
    expect(fromDateInput("2026-03", "month")).toBe("2026-03-01");
    expect(fromDateInput("2026", "year")).toBe("2026-01-01");
  });

  it("refuses input that does not match the precision, instead of guessing", () => {
    expect(fromDateInput("", "day")).toBeNull();
    expect(fromDateInput("2026-03", "day")).toBeNull();
    expect(fromDateInput("2026-03-15", "month")).toBeNull();
    expect(fromDateInput("26", "year")).toBeNull();
  });

  it("round-trips a stored date through the input and back", () => {
    for (const precision of ["day", "month", "year"] as const) {
      const stored = "2025-09-01T00:00:00.000Z";
      const input = toDateInput(stored, precision);
      expect(fromDateInput(input, precision)?.slice(0, 4)).toBe("2025");
    }
  });

  it("caps an input at today, at the precision the input uses", () => {
    const now = new Date("2026-10-29T10:00:00.000Z");
    expect(todayInput("day", now)).toBe("2026-10-29");
    expect(todayInput("month", now)).toBe("2026-10");
    expect(todayInput("year", now)).toBe("2026");
  });
});

describe("the line under the heading", () => {
  it("joins what is known, and leaves out what is not", () => {
    expect(headerLine({ sport: "Tennis", level: "competitive", sinceYear: 2021 })).toBe(
      "Tennis · Competitive · since 2021"
    );
    expect(headerLine({ sport: "Tennis", level: null, sinceYear: null })).toBe("Tennis");
    expect(headerLine({ sport: null, level: null, sinceYear: null })).toBe("");
  });
});
