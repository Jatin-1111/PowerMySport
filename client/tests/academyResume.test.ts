import { describe, expect, it } from "vitest";
import {
  formDataFromAcademy,
  payoutDetailsWereSaved,
} from "@/modules/onboarding/utils/academyResume";

const academy = {
  name: "Ace",
  legalName: "Ace Ltd",
  sports: ["Tennis"],
  ageGroups: ["all" as const],
  academyVenues: [{ name: "Court" }] as never,
  academyCoaches: [{ firstName: "A", lastName: "B", email: "a@b.com", sports: [] }],
  sessionRatePerHour: 60000,
  batchTimings: ["morning" as const],
  maxBatchSize: 12,
  trialsessionOffered: false,
  trialSessionPrice: 500,
  payoutFrequency: "weekly" as const,
  cancellationPolicy: "Cancel early.",
  refundPolicy: "Refund in seven days.",
  bankAccountNumber: "gAAAA-sealed",
};

describe("formDataFromAcademy", () => {
  it("fills only the steps that were saved", () => {
    const data = formDataFromAcademy(academy, "a1", 4);
    expect(data.step1?.name).toBe("Ace");
    expect(data.step2?.academyId).toBe("a1");
    expect(data.step4?.academyVenues).toHaveLength(1);
    expect(data.step5).toBeUndefined();
    expect(data.step6).toBeUndefined();
    expect(data.step7).toBeUndefined();
  });

  it("brings back pricing, and a trial price only when a trial is offered", () => {
    expect(formDataFromAcademy(academy, "a1", 6).step6).toEqual({
      sessionRatePerHour: 60000,
      batchTimings: ["morning"],
      maxBatchSize: 12,
      trialsessionOffered: false,
    });
  });

  it("never brings payout details back, only the frequency and policies", () => {
    const step7 = formDataFromAcademy(academy, "a1", 7).step7;
    expect(step7).toEqual({
      payoutFrequency: "weekly",
      cancellationPolicy: "Cancel early.",
      refundPolicy: "Refund in seven days.",
    });
    expect(payoutDetailsWereSaved(academy)).toBe(true);
    expect(payoutDetailsWereSaved({ ...academy, bankAccountNumber: undefined })).toBe(false);
  });
});
