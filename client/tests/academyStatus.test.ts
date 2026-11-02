import { describe, expect, it } from "vitest";
import type { AcademyLifecycle, OwnAcademy } from "../src/modules/academy/types";
import { describeAcademyStatus, hasFigures } from "../src/modules/academy/utils/academyStatus";
import { monthTrend } from "../src/modules/academy/utils/format";

const academy = (over: Partial<OwnAcademy> = {}): OwnAcademy => ({
  id: "a1",
  name: "Baseline Tennis Academy",
  slug: "baseline-tennis",
  city: "Pune",
  sports: ["Tennis"],
  lifecycle: "DRAFT",
  onboardingStep: 0,
  onboardingCompleted: false,
  emailVerified: false,
  kycVerified: false,
  isApproved: false,
  isActive: false,
  venueCount: 0,
  coachCount: 0,
  ...over,
});

describe("describeAcademyStatus", () => {
  it("sends an owner with no academy to the start of setup", () => {
    const view = describeAcademyStatus(null);
    expect(view.headline).toBe("Set up your academy");
    expect(view.primary).toEqual({ label: "Start setup", href: "/academy/onboarding" });
    expect(view.steps).toBe("setup");
    expect(view.showFigures).toBe(false);
  });

  it("treats a draft with nothing saved the same as no academy", () => {
    expect(describeAcademyStatus(academy({ onboardingStep: 0 })).headline).toBe(
      "Set up your academy"
    );
  });

  it("says how far a draft got and names the next step", () => {
    const view = describeAcademyStatus(academy({ onboardingStep: 3 }));
    expect(view.headline).toBe("3 of 7 steps saved");
    expect(view.body).toContain("Next is venues");
    expect(view.primary?.label).toBe("Continue with venues");
  });

  it("does not run past the last step", () => {
    const view = describeAcademyStatus(academy({ onboardingStep: 7 }));
    expect(view.headline).toBe("7 of 7 steps saved");
    expect(view.primary?.label).toBe("Continue with payouts and terms");
  });

  it("offers no action while we are the ones reviewing", () => {
    const view = describeAcademyStatus(
      academy({ lifecycle: "SUBMITTED", onboardingStep: 7, onboardingCompleted: true })
    );
    expect(view.tone).toBe("pending");
    expect(view.primary).toBeUndefined();
    expect(view.steps).toBe("review");
    expect(view.showFigures).toBe(false);
  });

  it("asks a rejected owner to fix and resubmit", () => {
    const view = describeAcademyStatus(
      academy({ lifecycle: "REJECTED", onboardingStep: 7, rejectionReason: "PAN unreadable." })
    );
    expect(view.tone).toBe("alert");
    expect(view.primary?.href).toBe("/academy/onboarding");
    expect(view.body).toContain("what our team asked you to fix");
  });

  it("keeps showing figures for a paused academy, which may still be owed money", () => {
    const view = describeAcademyStatus(academy({ lifecycle: "SUSPENDED", onboardingStep: 7 }));
    expect(view.tone).toBe("alert");
    expect(view.showFigures).toBe(true);
    expect(view.primary?.href).toBe("/contact");
  });

  it("links a live academy to its own public page", () => {
    const view = describeAcademyStatus(academy({ lifecycle: "APPROVED", onboardingStep: 7 }));
    expect(view.tone).toBe("live");
    expect(view.primary?.href).toBe("/academies/baseline-tennis");
    expect(view.showFigures).toBe(true);
  });

  it("never uses an em dash or an exclamation mark in what the owner reads", () => {
    const lifecycles: AcademyLifecycle[] = [
      "DRAFT",
      "SUBMITTED",
      "NEEDS_INFO",
      "APPROVED",
      "REJECTED",
      "SUSPENDED",
    ];
    const views = [
      describeAcademyStatus(null),
      ...lifecycles.map((lifecycle) =>
        describeAcademyStatus(academy({ lifecycle, onboardingStep: 4 }))
      ),
    ];
    for (const view of views) {
      const copy = [view.tag, view.headline, view.body, view.primary?.label, view.secondary?.label]
        .filter(Boolean)
        .join(" ");
      expect(copy).not.toMatch(/[—–!]/);
    }
  });
});

describe("hasFigures", () => {
  it("asks for earnings only once an academy has been live", () => {
    expect(hasFigures(null)).toBe(false);
    expect(hasFigures(academy({ lifecycle: "DRAFT", onboardingStep: 2 }))).toBe(false);
    expect(hasFigures(academy({ lifecycle: "SUBMITTED" }))).toBe(false);
    expect(hasFigures(academy({ lifecycle: "APPROVED" }))).toBe(true);
  });
});

describe("monthTrend", () => {
  it("is null when last month has nothing to compare with", () => {
    expect(monthTrend(5000, 0)).toBeNull();
  });

  it("reports growth and decline against last month", () => {
    expect(monthTrend(15000, 10000)).toEqual({ value: 50, positive: true });
    expect(monthTrend(7500, 10000)).toEqual({ value: -25, positive: false });
  });
});
