import type {
  AcademyPayoutFrequency,
  AcademyStep7Payload,
} from "@/modules/onboarding/types/academy";

/** The payout form as typed. Mirrors server step 7: bank all or nothing, or UPI, or both. */
export interface PayoutFormValues {
  bankAccountName: string;
  bankAccountNumber: string;
  bankAccountNumberConfirm: string;
  bankIfsc: string;
  upiId: string;
  payoutFrequency: AcademyPayoutFrequency;
  cancellationPolicy: string;
  refundPolicy: string;
  agreedToTerms: boolean;
}

export const hasBankDetails = (v: PayoutFormValues): boolean =>
  Boolean(
    v.bankAccountName.trim() || v.bankAccountNumber || v.bankAccountNumberConfirm || v.bankIfsc
  );

export const validatePayoutForm = (v: PayoutFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};
  const bank = hasBankDetails(v);
  const upi = v.upiId.trim();

  if (!bank && !upi) {
    errors.paymentMethod = "Please provide either a bank account or UPI ID for payouts";
  }
  if (bank) {
    if (v.bankAccountName.trim().length < 3) {
      errors.bankAccountName = "Account holder name is required (min 3 characters)";
    }
    if (!/^\d{9,18}$/.test(v.bankAccountNumber)) {
      errors.bankAccountNumber = "Invalid account number (9-18 digits)";
    }
    if (!v.bankAccountNumberConfirm) {
      errors.bankAccountNumberConfirm = "Type the account number again to confirm it";
    } else if (v.bankAccountNumberConfirm !== v.bankAccountNumber) {
      errors.bankAccountNumberConfirm = "The account numbers do not match";
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.bankIfsc)) {
      errors.bankIfsc = "Invalid IFSC code (e.g., SBIN0001234)";
    }
  }
  if (upi && !/^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upi)) {
    errors.upiId = "Invalid UPI ID format (e.g., name@okhdfcbank)";
  }
  if (v.cancellationPolicy.trim().length < 10) {
    errors.cancellationPolicy = "Please provide a clear cancellation policy (min 10 characters)";
  }
  if (v.refundPolicy.trim().length < 10) {
    errors.refundPolicy = "Please provide a clear refund policy (min 10 characters)";
  }
  if (!v.agreedToTerms) {
    errors.agreedToTerms = "Confirm the owner has agreed to the Partner Terms";
  }
  return errors;
};

/** Only the payout methods that were filled in are sent, so a UPI-only save carries no empty bank fields. */
export const buildPayoutPayload = (
  academyId: string,
  v: PayoutFormValues
): AcademyStep7Payload => ({
  academyId,
  ...(hasBankDetails(v)
    ? {
        bankAccountName: v.bankAccountName.trim(),
        bankAccountNumber: v.bankAccountNumber,
        bankAccountNumberConfirm: v.bankAccountNumberConfirm,
        bankIfsc: v.bankIfsc,
      }
    : {}),
  ...(v.upiId.trim() ? { upiId: v.upiId.trim() } : {}),
  payoutFrequency: v.payoutFrequency,
  cancellationPolicy: v.cancellationPolicy.trim(),
  refundPolicy: v.refundPolicy.trim(),
  agreeToTerms: v.agreedToTerms,
});
