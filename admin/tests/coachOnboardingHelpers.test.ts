import { describe, expect, it } from "vitest";

import {
  formatOpeningHoursToString,
  getApiConflictPayload,
  isValidMobileNumber,
  sanitizeMobileNumber,
  toCoachId,
} from "@/modules/admin/utils/coachOnboardingHelpers";
import {
  getDefaultOpeningHours,
  OpeningHours,
} from "@/modules/onboarding/components/OpeningHoursInput";

describe("isValidMobileNumber", () => {
  it("accepts digits, spaces, parens, dashes and a leading +", () => {
    expect(isValidMobileNumber("+91 98765 43210")).toBe(true);
    expect(isValidMobileNumber("(987) 654-3210")).toBe(true);
  });

  it("rejects letters", () => {
    expect(isValidMobileNumber("98765abcde")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidMobileNumber("  9876543210  ")).toBe(true);
  });
});

describe("sanitizeMobileNumber", () => {
  it("strips characters outside the allowed phone charset", () => {
    expect(sanitizeMobileNumber("+91 (987) 654-3210 ext.1")).toBe("+91 (987) 654-3210 .1");
  });

  it("leaves an already-clean number untouched", () => {
    expect(sanitizeMobileNumber("+919876543210")).toBe("+919876543210");
  });
});

describe("toCoachId", () => {
  it("reads coach.id from a flat payload", () => {
    expect(toCoachId({ coach: { id: "coach-1" } })).toBe("coach-1");
  });

  it("falls back to coach._id", () => {
    expect(toCoachId({ coach: { _id: "coach-2" } })).toBe("coach-2");
  });

  it("reads a nested data.coach.id when the top-level coach is absent", () => {
    expect(toCoachId({ data: { coach: { id: "coach-3" } } })).toBe("coach-3");
  });

  it("prefers the top-level coach over the nested one", () => {
    expect(toCoachId({ coach: { id: "top" }, data: { coach: { id: "nested" } } })).toBe("top");
  });

  it("returns an empty string for null, non-object, or ID-less payloads", () => {
    expect(toCoachId(null)).toBe("");
    expect(toCoachId("coach-1")).toBe("");
    expect(toCoachId({ coach: {} })).toBe("");
  });
});

describe("getApiConflictPayload", () => {
  it("extracts status and data from an axios-shaped error", () => {
    const error = { response: { status: 409, data: { requiresConversion: true } } };

    expect(getApiConflictPayload(error)).toEqual({
      status: 409,
      data: { requiresConversion: true },
    });
  });

  it("returns an empty object for a non-object or response-less error", () => {
    expect(getApiConflictPayload(new Error("network down"))).toEqual({
      status: undefined,
      data: undefined,
    });
    expect(getApiConflictPayload("boom")).toEqual({});
    expect(getApiConflictPayload(null)).toEqual({});
  });
});

describe("formatOpeningHoursToString", () => {
  const allClosed = (): OpeningHours => {
    const hours = getDefaultOpeningHours();
    for (const day of Object.keys(hours) as Array<keyof OpeningHours>) {
      hours[day] = { ...hours[day], isOpen: false };
    }
    return hours;
  };

  it("returns 'Closed' when every day is closed", () => {
    expect(formatOpeningHoursToString(allClosed())).toBe("Closed");
  });

  it("collapses identical hours across all 7 days (the default) into one range", () => {
    expect(formatOpeningHoursToString(getDefaultOpeningHours())).toBe("09:00-21:00 (All days)");
  });

  it("lists abbreviated day names when only some days share the same hours", () => {
    const hours = allClosed();
    hours.monday = { isOpen: true, openTime: "09:00", closeTime: "17:00" };
    hours.tuesday = { isOpen: true, openTime: "09:00", closeTime: "17:00" };

    expect(formatOpeningHoursToString(hours)).toBe("09:00-17:00 (mon,tue)");
  });

  it("lists each day individually when hours differ across open days", () => {
    const hours = allClosed();
    hours.monday = { isOpen: true, openTime: "09:00", closeTime: "17:00" };
    hours.tuesday = { isOpen: true, openTime: "10:00", closeTime: "18:00" };

    expect(formatOpeningHoursToString(hours)).toBe("monday: 09:00-17:00; tuesday: 10:00-18:00");
  });
});
