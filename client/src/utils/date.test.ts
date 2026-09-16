import { describe, expect, it } from "vitest";

import { formatMonthYear } from "./date";

describe("formatMonthYear", () => {
  it("formats a date as month and year", () => {
    expect(formatMonthYear(new Date(2026, 2, 15))).toBe("March 2026");
  });

  it("accepts an ISO string, as the API sends it", () => {
    expect(formatMonthYear("2026-09-16T10:30:00.000Z")).toBe("September 2026");
  });

  // The reason this helper returns null rather than a fallback: the caller
  // renders "Member since {x}" next to a real person's name, and the line it
  // replaced was hardcoded to a year that applied to nobody. No date must mean
  // no line, never a plausible-looking guess.
  it("returns null when there is no date", () => {
    expect(formatMonthYear(undefined)).toBeNull();
    expect(formatMonthYear(null)).toBeNull();
    expect(formatMonthYear("")).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(formatMonthYear("not a date")).toBeNull();
    expect(formatMonthYear(new Date("nonsense"))).toBeNull();
  });
});
