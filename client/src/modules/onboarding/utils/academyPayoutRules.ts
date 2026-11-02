import type {
  AcademyPayoutFrequency,
  AcademyPayoutsPayload,
} from "@/modules/onboarding/types/academy";

/**
 * Rules for the payouts and terms step of academy sign-up. They mirror the
 * server's step 7 validator: a complete bank account, a UPI ID, or both; bank
 * details are all or nothing and the account number is typed twice; both
 * policies are written out; the terms are agreed.
 */

export const MIN_POLICY_LENGTH = 10;
export const MAX_POLICY_LENGTH = 2000;

export const PAYOUT_FREQUENCIES: { id: AcademyPayoutFrequency; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every two weeks" },
  { id: "monthly", label: "Monthly" },
];

export interface PayoutValues {
  accountName: string;
  accountNumber: string;
  accountNumberConfirm: string;
  ifsc: string;
  upi: string;
  frequency: AcademyPayoutFrequency;
  cancellationPolicy: string;
  refundPolicy: string;
  agreed: boolean;
}

export const emptyPayouts = (): PayoutValues => ({
  accountName: "",
  accountNumber: "",
  accountNumberConfirm: "",
  ifsc: "",
  upi: "",
  frequency: "monthly",
  cancellationPolicy: "",
  refundPolicy: "",
  agreed: false,
});

/**
 * What can be restored after Back or a resume: the frequency and the policies.
 * Bank details are never read back (the server keeps them sealed, and they are
 * not shown again), and the terms must be agreed again.
 */
export const payoutsFromSaved = (
  saved?: Partial<
    Pick<AcademyPayoutsPayload, "payoutFrequency" | "cancellationPolicy" | "refundPolicy">
  >
): PayoutValues => ({
  ...emptyPayouts(),
  frequency: saved?.payoutFrequency ?? "monthly",
  cancellationPolicy: saved?.cancellationPolicy ?? "",
  refundPolicy: saved?.refundPolicy ?? "",
});

/** Spaces and dashes people put in an account number are not part of it. */
export const cleanAccountNumber = (text: string): string => text.replace(/[\s-]/g, "");

/** IFSC codes are upper case, and a pasted code can carry spaces. */
export const cleanIfsc = (text: string): string => text.replace(/\s/g, "").toUpperCase();

/** "ending 9012", for showing the number back without displaying all of it. */
export const accountEnding = (accountNumber: string): string =>
  accountNumber.length >= 4 ? `ending ${accountNumber.slice(-4)}` : "";

const ACCOUNT_NUMBER = /^\d{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;

export type PayoutErrors = Partial<
  Record<
    | "method"
    | "accountName"
    | "accountNumber"
    | "accountNumberConfirm"
    | "ifsc"
    | "upi"
    | "cancellationPolicy"
    | "refundPolicy"
    | "terms",
    string
  >
>;

export const hasBankDetails = (values: PayoutValues): boolean =>
  Boolean(
    values.accountName.trim() || values.accountNumber || values.accountNumberConfirm || values.ifsc
  );

export const validatePayouts = (values: PayoutValues): PayoutErrors => {
  const errors: PayoutErrors = {};
  const bank = hasBankDetails(values);
  const upi = values.upi.trim();

  if (!bank && !upi) errors.method = "Add a bank account or a UPI ID for payouts";

  if (bank) {
    if (values.accountName.trim().length < 2) errors.accountName = "Enter the account holder name";
    if (!ACCOUNT_NUMBER.test(values.accountNumber)) {
      errors.accountNumber = "Account number must be 9 to 18 digits";
    }
    if (!values.accountNumberConfirm) {
      errors.accountNumberConfirm = "Type the account number again to confirm it";
    } else if (values.accountNumberConfirm !== values.accountNumber) {
      errors.accountNumberConfirm = "The account numbers do not match";
    }
    if (!IFSC.test(values.ifsc)) errors.ifsc = "Enter a valid IFSC code, for example SBIN0001234";
  }

  if (upi && !UPI.test(upi)) errors.upi = "Enter a valid UPI ID, for example name@okhdfcbank";

  const policy = (text: string, noun: string) => {
    const length = text.trim().length;
    if (length < MIN_POLICY_LENGTH)
      return `Write your ${noun} (at least ${MIN_POLICY_LENGTH} characters)`;
    if (length > MAX_POLICY_LENGTH) return `Keep the ${noun} under ${MAX_POLICY_LENGTH} characters`;
    return undefined;
  };
  const cancellation = policy(values.cancellationPolicy, "cancellation policy");
  if (cancellation) errors.cancellationPolicy = cancellation;
  const refund = policy(values.refundPolicy, "refund policy");
  if (refund) errors.refundPolicy = refund;

  if (!values.agreed) errors.terms = "You must agree to the Partner Terms to continue";

  return errors;
};

/**
 * The payload for the server. Only the payout methods that were filled in are
 * sent, so saving a UPI ID alone does not send empty bank fields.
 */
export const payoutsForSave = (values: PayoutValues): AcademyPayoutsPayload => {
  const bank = hasBankDetails(values);
  const upi = values.upi.trim();
  return {
    ...(bank
      ? {
          bankAccountName: values.accountName.trim(),
          bankAccountNumber: values.accountNumber,
          bankAccountNumberConfirm: values.accountNumberConfirm,
          bankIfsc: values.ifsc,
        }
      : {}),
    ...(upi ? { upiId: upi } : {}),
    payoutFrequency: values.frequency,
    cancellationPolicy: values.cancellationPolicy.trim(),
    refundPolicy: values.refundPolicy.trim(),
    agreeToTerms: values.agreed,
  };
};
