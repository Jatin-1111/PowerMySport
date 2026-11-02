import { describe, expect, it } from "vitest";
import {
  buildPayoutPayload,
  validatePayoutForm,
  type PayoutFormValues,
} from "@/modules/onboarding/utils/academyPayoutForm";

const base: PayoutFormValues = {
  bankAccountName: "",
  bankAccountNumber: "",
  bankAccountNumberConfirm: "",
  bankIfsc: "",
  upiId: "",
  payoutFrequency: "monthly",
  cancellationPolicy: "Cancel at least 24 hours before.",
  refundPolicy: "Refunds within seven days.",
  agreedToTerms: true,
};
const bank = {
  bankAccountName: "Ace Academy",
  bankAccountNumber: "123456789012",
  bankAccountNumberConfirm: "123456789012",
  bankIfsc: "HDFC0001234",
};

describe("admin payout form", () => {
  it("needs a bank account or a UPI ID", () => {
    expect(validatePayoutForm(base).paymentMethod).toBeTruthy();
    expect(validatePayoutForm({ ...base, ...bank })).toEqual({});
    expect(validatePayoutForm({ ...base, upiId: "ace@okhdfcbank" })).toEqual({});
  });

  it("needs the account number typed twice, and the two to match", () => {
    expect(
      validatePayoutForm({ ...base, ...bank, bankAccountNumberConfirm: "" })
        .bankAccountNumberConfirm
    ).toMatch(/again/);
    expect(
      validatePayoutForm({ ...base, ...bank, bankAccountNumberConfirm: "999999999999" })
        .bankAccountNumberConfirm
    ).toMatch(/do not match/);
  });

  it("makes bank details all or nothing", () => {
    const errors = validatePayoutForm({
      ...base,
      upiId: "ace@okhdfcbank",
      bankIfsc: "HDFC0001234",
    });
    expect(errors.bankAccountName).toBeTruthy();
    expect(errors.bankAccountNumber).toBeTruthy();
  });

  it("will not pass without the terms confirmed", () => {
    expect(
      validatePayoutForm({ ...base, ...bank, agreedToTerms: false }).agreedToTerms
    ).toBeTruthy();
  });

  it("sends the confirmation and the terms, which the server requires", () => {
    expect(buildPayoutPayload("a1", { ...base, ...bank })).toMatchObject({
      academyId: "a1",
      bankAccountNumber: "123456789012",
      bankAccountNumberConfirm: "123456789012",
      agreeToTerms: true,
    });
  });

  it("sends UPI alone without empty bank fields", () => {
    const payload = buildPayoutPayload("a1", { ...base, upiId: " ace@okhdfcbank " });
    expect(payload.upiId).toBe("ace@okhdfcbank");
    expect("bankAccountNumber" in payload).toBe(false);
    expect("bankIfsc" in payload).toBe(false);
  });
});
