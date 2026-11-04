import { Coach } from "@/types";
import { describe, expect, it } from "vitest";
import { getCoachVerificationStatus, isCoachVerificationFlowComplete } from "./verification";

const coach = (overrides: Partial<Coach>): Coach =>
  ({
    bio: "Ten years coaching junior badminton.",
    sports: ["Badminton"],
    verificationStatus: "VERIFIED",
    isVerified: true,
    ...overrides,
  }) as Coach;

describe("getCoachVerificationStatus", () => {
  it("derives VERIFIED from isVerified when verificationStatus is absent", () => {
    expect(
      getCoachVerificationStatus(coach({ verificationStatus: undefined, isVerified: true }))
    ).toBe("VERIFIED");
  });

  it("prefers an explicit verificationStatus", () => {
    expect(
      getCoachVerificationStatus(coach({ verificationStatus: "PENDING", isVerified: false }))
    ).toBe("PENDING");
  });

  it("falls back to UNVERIFIED", () => {
    expect(getCoachVerificationStatus(null)).toBe("UNVERIFIED");
    expect(
      getCoachVerificationStatus(coach({ verificationStatus: undefined, isVerified: false }))
    ).toBe("UNVERIFIED");
  });
});

describe("isCoachVerificationFlowComplete", () => {
  it("accepts a verified coach with bio and sports", () => {
    expect(isCoachVerificationFlowComplete(coach({}))).toBe(true);
  });

  it("accepts coaches awaiting review", () => {
    expect(
      isCoachVerificationFlowComplete(coach({ verificationStatus: "PENDING", isVerified: false }))
    ).toBe(true);
  });

  // Legacy records whose coach data was deleted keep their verified flag but
  // lose bio/sports. Both the dashboard gate (coach/layout.tsx) and the
  // verification page read this predicate — if they ever disagree about this
  // shape, the coach ping-pongs between /coach/profile and /coach/verification.
  it("rejects a verified coach whose profile data was wiped", () => {
    expect(isCoachVerificationFlowComplete(coach({ bio: "", sports: [] }))).toBe(false);
    expect(
      isCoachVerificationFlowComplete(coach({ verificationStatus: undefined, bio: "", sports: [] }))
    ).toBe(false);
  });

  it("rejects a coach missing only sports", () => {
    expect(isCoachVerificationFlowComplete(coach({ sports: [] }))).toBe(false);
  });

  it("rejects a coach missing only a bio", () => {
    expect(isCoachVerificationFlowComplete(coach({ bio: "   " }))).toBe(false);
  });

  it("rejects a missing coach record", () => {
    expect(isCoachVerificationFlowComplete(null)).toBe(false);
    expect(isCoachVerificationFlowComplete(undefined)).toBe(false);
  });
});
