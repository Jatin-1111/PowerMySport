import { describe, expect, it } from "vitest";
import {
  MAX_POLICY_LENGTH,
  accountEnding,
  cleanAccountNumber,
  cleanIfsc,
  emptyPayouts,
  hasBankDetails,
  payoutsForSave,
  payoutsFromSaved,
  validatePayouts,
  type PayoutValues,
} from "@/modules/onboarding/utils/academyPayoutRules";

const policies = {
  cancellationPolicy: "Cancel at least 24 hours before for a full refund.",
  refundPolicy: "Refunds are processed within seven days of cancellation.",
};

const bank = (over: Partial<PayoutValues> = {}): PayoutValues => ({
  ...emptyPayouts(),
  ...policies,
  accountName: "Journey Academy",
  accountNumber: "123456789012",
  accountNumberConfirm: "123456789012",
  ifsc: "HDFC0001234",
  agreed: true,
  ...over,
});

const upiOnly = (over: Partial<PayoutValues> = {}): PayoutValues => ({
  ...emptyPayouts(),
  ...policies,
  upi: "journey@okhdfcbank",
  agreed: true,
  ...over,
});

describe("what people type", () => {
  it("takes the spaces and dashes out of an account number", () => {
    expect(cleanAccountNumber("1234 5678 9012")).toBe("123456789012");
    expect(cleanAccountNumber("1234-5678-9012")).toBe("123456789012");
  });
  it("upper-cases an IFSC code and drops spaces", () => {
    expect(cleanIfsc(" hdfc 0001234 ")).toBe("HDFC0001234");
  });
  it("shows the end of an account number, not all of it", () => {
    expect(accountEnding("123456789012")).toBe("ending 9012");
    expect(accountEnding("12")).toBe("");
  });
});

describe("payout method", () => {
  it("passes a bank account alone, a UPI ID alone, and both", () => {
    expect(validatePayouts(bank())).toEqual({});
    expect(validatePayouts(upiOnly())).toEqual({});
    expect(validatePayouts(bank({ upi: "journey@okhdfcbank" }))).toEqual({});
  });

  it("needs one of the two", () => {
    const errors = validatePayouts({ ...emptyPayouts(), ...policies, agreed: true });
    expect(errors.method).toMatch(/bank account or a UPI ID/);
  });
});

describe("bank details", () => {
  it("are all or nothing: any one field means every field is needed", () => {
    const errors = validatePayouts(upiOnly({ accountName: "Journey Academy" }));
    expect(errors.accountNumber).toBeTruthy();
    expect(errors.accountNumberConfirm).toBeTruthy();
    expect(errors.ifsc).toBeTruthy();
    expect(hasBankDetails(upiOnly({ ifsc: "X" }))).toBe(true);
    expect(hasBankDetails(upiOnly())).toBe(false);
  });

  it("holds the account number to 9 to 18 digits", () => {
    for (const accountNumber of ["12345678", "1".repeat(19), "12345678a", "1234 56789"]) {
      expect(
        validatePayouts(bank({ accountNumber, accountNumberConfirm: accountNumber })).accountNumber
      ).toBeTruthy();
    }
    for (const accountNumber of ["123456789", "1".repeat(18)]) {
      expect(
        validatePayouts(bank({ accountNumber, accountNumberConfirm: accountNumber })).accountNumber
      ).toBeUndefined();
    }
  });

  it("needs the number typed twice, and the two to match", () => {
    expect(validatePayouts(bank({ accountNumberConfirm: "" })).accountNumberConfirm).toMatch(
      /again to confirm/
    );
    expect(
      validatePayouts(bank({ accountNumberConfirm: "999999999999" })).accountNumberConfirm
    ).toMatch(/do not match/);
  });

  it("checks the IFSC format", () => {
    for (const ifsc of ["hdfc0001234", "HDFC1001234", "HDFC000123", "HDFC00012345", ""]) {
      expect(validatePayouts(bank({ ifsc })).ifsc).toBeTruthy();
    }
    expect(validatePayouts(bank({ ifsc: "SBIN0ABC123" })).ifsc).toBeUndefined();
  });

  it("needs an account holder name", () => {
    expect(validatePayouts(bank({ accountName: "  " })).accountName).toBeTruthy();
    expect(validatePayouts(bank({ accountName: "A" })).accountName).toBeTruthy();
  });
});

describe("UPI", () => {
  it("accepts ordinary handles", () => {
    for (const upi of ["name@okhdfcbank", "first.last@ybl", "9876543210@paytm", "a_b-c@oksbi"]) {
      expect(validatePayouts(upiOnly({ upi })).upi).toBeUndefined();
    }
  });
  it("refuses things that are not a UPI ID", () => {
    for (const upi of ["name", "name@", "@upi", "name@ab", "na me@upi", "name@up1"]) {
      expect(validatePayouts(upiOnly({ upi })).upi).toBeTruthy();
    }
  });
});

describe("policies and terms", () => {
  it("need to be written out, within the limit", () => {
    expect(validatePayouts(bank({ cancellationPolicy: "short" })).cancellationPolicy).toMatch(
      /at least 10/
    );
    expect(validatePayouts(bank({ refundPolicy: "" })).refundPolicy).toBeTruthy();
    expect(
      validatePayouts(bank({ refundPolicy: "x".repeat(MAX_POLICY_LENGTH + 1) })).refundPolicy
    ).toMatch(/under 2000/);
    expect(
      validatePayouts(bank({ refundPolicy: "x".repeat(MAX_POLICY_LENGTH) })).refundPolicy
    ).toBeUndefined();
  });

  it("need the terms agreed", () => {
    expect(validatePayouts(bank({ agreed: false })).terms).toMatch(/Partner Terms/);
  });
});

describe("payoutsForSave", () => {
  it("sends the bank account only when one was filled in", () => {
    const payload = payoutsForSave(bank());
    expect(payload).toMatchObject({
      bankAccountName: "Journey Academy",
      bankAccountNumber: "123456789012",
      bankAccountNumberConfirm: "123456789012",
      bankIfsc: "HDFC0001234",
      payoutFrequency: "monthly",
      agreeToTerms: true,
    });
    expect("upiId" in payload).toBe(false);
  });

  it("sends UPI alone without empty bank fields", () => {
    const payload = payoutsForSave(upiOnly({ upi: "  journey@okhdfcbank " }));
    expect(payload.upiId).toBe("journey@okhdfcbank");
    for (const key of [
      "bankAccountName",
      "bankAccountNumber",
      "bankAccountNumberConfirm",
      "bankIfsc",
    ]) {
      expect(key in payload).toBe(false);
    }
  });

  it("trims the policies", () => {
    expect(
      payoutsForSave(bank({ refundPolicy: `  ${policies.refundPolicy}  ` })).refundPolicy
    ).toBe(policies.refundPolicy);
  });
});

describe("restoring a saved step", () => {
  it("brings back the frequency and policies, never bank details or the agreement", () => {
    const restored = payoutsFromSaved({
      payoutFrequency: "weekly",
      cancellationPolicy: policies.cancellationPolicy,
      refundPolicy: policies.refundPolicy,
      // A caller handing over more than it should must not leak it in.
      ...({ bankAccountNumber: "gAAAA-ciphertext", upiId: "x@upi" } as object),
    });
    expect(restored.frequency).toBe("weekly");
    expect(restored.cancellationPolicy).toBe(policies.cancellationPolicy);
    expect(restored.accountNumber).toBe("");
    expect(restored.upi).toBe("");
    expect(restored.agreed).toBe(false);
  });
  it("defaults to monthly", () => {
    expect(payoutsFromSaved(undefined).frequency).toBe("monthly");
  });
});
