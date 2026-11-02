import { describe, expect, it } from "vitest";
import {
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  MAX_RATE_PAISE,
  defaultPricing,
  normalizeBatchTimings,
  pricingForSave,
  pricingFromSaved,
  toggleBatchTiming,
  trialPriceWarning,
  validatePricing,
  type PricingValues,
} from "@/modules/onboarding/utils/academyPricingRules";
import {
  paiseToInputText,
  parseRupeesInput,
  paiseToRupees,
  rupeesToPaise,
} from "@/modules/onboarding/utils/money";

const valid = (over: Partial<PricingValues> = {}): PricingValues => ({
  ratePaise: 60000,
  batchTimings: ["morning"],
  maxBatchSize: 12,
  trialOffered: false,
  trialPaise: 0,
  ...over,
});

describe("money", () => {
  it("converts rupees to paise without float drift", () => {
    expect(rupeesToPaise("1.005")).toBe(101);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise("199.99")).toBe(19999);
  });

  it("reads what owners really type into an amount box", () => {
    expect(parseRupeesInput("500")).toBe(50000);
    expect(parseRupeesInput("1,500")).toBe(150000);
    expect(parseRupeesInput("₹500")).toBe(50000);
    expect(parseRupeesInput("Rs. 500")).toBe(50000);
    expect(parseRupeesInput("rs500")).toBe(50000);
    expect(parseRupeesInput(" 1 500 ")).toBe(150000);
    expect(parseRupeesInput("INR 2,50,000")).toBe(25000000);
  });

  it("gives 0 for text that is not an amount", () => {
    for (const text of ["", "abc", "-5", "5-", "1.2.3", "₹"]) {
      expect(parseRupeesInput(text)).toBe(0);
    }
  });

  it("shows paise back as plain rupees in a text box", () => {
    expect(paiseToInputText(50000)).toBe("500");
    expect(paiseToInputText(19999)).toBe("199.99");
    expect(paiseToInputText(0)).toBe("");
    expect(paiseToRupees(undefined)).toBe("");
  });
});

describe("batch timings", () => {
  it("collapses morning plus evening into both", () => {
    expect(normalizeBatchTimings(["morning", "evening"])).toEqual(["both"]);
    expect(normalizeBatchTimings(["evening", "morning"])).toEqual(["both"]);
  });

  it("drops the others when both is present", () => {
    expect(normalizeBatchTimings(["morning", "both"])).toEqual(["both"]);
  });

  it("keeps a single choice and orders consistently", () => {
    expect(normalizeBatchTimings(["evening"])).toEqual(["evening"]);
    expect(normalizeBatchTimings([])).toEqual([]);
  });

  it("toggles one option at a time", () => {
    expect(toggleBatchTiming([], "morning")).toEqual(["morning"]);
    expect(toggleBatchTiming(["morning"], "morning")).toEqual([]);
    expect(toggleBatchTiming(["morning"], "evening")).toEqual(["both"]);
  });

  it("treats both as one choice standing for the other two", () => {
    expect(toggleBatchTiming(["morning"], "both")).toEqual(["both"]);
    expect(toggleBatchTiming(["both"], "both")).toEqual([]);
    // Unticking one of the two while both is on leaves the other.
    expect(toggleBatchTiming(["both"], "morning")).toEqual(["evening"]);
    expect(toggleBatchTiming(["both"], "evening")).toEqual(["morning"]);
  });
});

describe("validatePricing", () => {
  it("passes a complete form", () => {
    expect(validatePricing(valid())).toEqual({});
    expect(validatePricing(valid({ trialOffered: true, trialPaise: 0 }))).toEqual({});
  });

  it("fails the defaults on rate and batches", () => {
    const errors = validatePricing(defaultPricing());
    expect(errors.rate).toBeTruthy();
    expect(errors.batchTimings).toBeTruthy();
    expect(errors.maxBatchSize).toBeUndefined();
  });

  it("holds the rate between one rupee and ten lakh", () => {
    expect(validatePricing(valid({ ratePaise: 99 })).rate).toBeTruthy();
    expect(validatePricing(valid({ ratePaise: 100 })).rate).toBeUndefined();
    expect(validatePricing(valid({ ratePaise: MAX_RATE_PAISE })).rate).toBeUndefined();
    expect(validatePricing(valid({ ratePaise: MAX_RATE_PAISE + 1 })).rate).toBeTruthy();
  });

  it("needs a whole batch size from 1 to 100", () => {
    for (const maxBatchSize of [0, -3, 1.5, MAX_BATCH_SIZE + 1, Number.NaN]) {
      expect(validatePricing(valid({ maxBatchSize })).maxBatchSize).toBeTruthy();
    }
    for (const maxBatchSize of [1, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE]) {
      expect(validatePricing(valid({ maxBatchSize })).maxBatchSize).toBeUndefined();
    }
  });

  it("checks the trial price only when a trial is offered, and allows free", () => {
    expect(
      validatePricing(valid({ trialOffered: false, trialPaise: -100 })).trialPrice
    ).toBeUndefined();
    expect(
      validatePricing(valid({ trialOffered: true, trialPaise: -100 })).trialPrice
    ).toBeTruthy();
    expect(
      validatePricing(valid({ trialOffered: true, trialPaise: 0 })).trialPrice
    ).toBeUndefined();
    expect(
      validatePricing(valid({ trialOffered: true, trialPaise: MAX_RATE_PAISE + 1 })).trialPrice
    ).toBeTruthy();
  });
});

describe("trial price warning", () => {
  it("warns, without blocking, when a trial costs more than an hour", () => {
    const values = valid({ trialOffered: true, trialPaise: 70000 });
    expect(trialPriceWarning(values)).toMatch(/more than your normal hourly rate/);
    expect(validatePricing(values)).toEqual({});
  });
  it("stays quiet otherwise", () => {
    expect(trialPriceWarning(valid({ trialOffered: true, trialPaise: 60000 }))).toBe("");
    expect(trialPriceWarning(valid({ trialOffered: true, trialPaise: 0 }))).toBe("");
    expect(trialPriceWarning(valid({ trialOffered: false, trialPaise: 99999999 }))).toBe("");
    expect(trialPriceWarning(valid({ ratePaise: 0, trialOffered: true, trialPaise: 100 }))).toBe(
      ""
    );
  });
});

describe("pricingForSave", () => {
  it("sends paise, normalised timings, and the trial only when offered", () => {
    expect(
      pricingForSave(
        valid({ batchTimings: ["morning", "evening"], trialOffered: true, trialPaise: 20000 })
      )
    ).toEqual({
      sessionRatePerHour: 60000,
      batchTimings: ["both"],
      maxBatchSize: 12,
      trialsessionOffered: true,
      trialSessionPrice: 20000,
    });
  });

  it("leaves the trial price out when there is no trial, even if one was typed earlier", () => {
    const payload = pricingForSave(valid({ trialOffered: false, trialPaise: 20000 }));
    expect(payload.trialsessionOffered).toBe(false);
    expect("trialSessionPrice" in payload).toBe(false);
  });

  it("keeps a free trial as 0, not missing", () => {
    expect(pricingForSave(valid({ trialOffered: true, trialPaise: 0 })).trialSessionPrice).toBe(0);
  });
});

describe("pricingFromSaved", () => {
  it("restores saved values and defaults the rest", () => {
    expect(
      pricingFromSaved({
        sessionRatePerHour: 60000,
        batchTimings: ["evening"],
        maxBatchSize: 8,
        trialsessionOffered: true,
        trialSessionPrice: 0,
      })
    ).toEqual({
      ratePaise: 60000,
      batchTimings: ["evening"],
      maxBatchSize: 8,
      trialOffered: true,
      trialPaise: 0,
    });
    expect(pricingFromSaved(undefined)).toEqual(defaultPricing());
  });
});
