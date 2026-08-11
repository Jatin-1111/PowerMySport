/**
 * Unit classification for BookingPaymentTransaction.amount.
 *
 * That field is canonically PAISE, but payBookingWithWallet() historically
 * wrote the raw RUPEE figure (see migrations/20_fix_wallet_transaction_paise.ts).
 * Deciding which unit a stored row is in is the only judgement call in that
 * migration, and it gates whether money records get rewritten — so it lives
 * here as a pure, dependency-free module that can be tested without booting
 * mongoose, Redis or S3.
 */

/** Rupee figures carry at most 2 decimals; anything closer than half a paisa is equal. */
export const RUPEE_EPSILON = 0.005;

export const toPaise = (rupees: number): number => Math.round(rupees * 100);

export const nearlyEqual = (a: number, b: number): boolean =>
  Math.abs(a - b) < RUPEE_EPSILON;

export type AmountVerdict =
  | { kind: "RUPEES"; correctedPaise: number }
  | { kind: "ALREADY_PAISE" }
  | { kind: "UNCLASSIFIED"; reason: string };

/**
 * Decide whether a stored amount is rupees (needs converting) or already
 * paise, by anchoring on the rupee figure the parent booking says was owed.
 *
 * Magnitude alone is not sufficient: 500 is a valid stored value for both a
 * ₹500 booking (rupees, broken) and a ₹5 booking (paise, correct). The
 * booking's expected rupee figure — exactly what payBookingWithWallet() read
 * when it wrote the row — is what disambiguates them.
 */
export const classifyAmount = (
  amount: number,
  expectedRupees: number,
): AmountVerdict => {
  if (!Number.isFinite(amount) || !Number.isFinite(expectedRupees)) {
    return { kind: "UNCLASSIFIED", reason: "non-finite amount" };
  }

  if (expectedRupees <= 0) {
    // Rupees and paise are indistinguishable at zero (0 === 0 * 100), and
    // there is nothing to correct either way.
    return {
      kind: "UNCLASSIFIED",
      reason: "booking has no positive expected amount — nothing to anchor to",
    };
  }

  const expectedPaise = toPaise(expectedRupees);

  // Check paise FIRST. For sub-1-rupee bookings the two candidates can round
  // together (e.g. ₹0.01 -> 1 paisa), and treating an already-correct row as
  // needing conversion would inflate it 100x — the opposite of the bug.
  if (nearlyEqual(amount, expectedPaise)) {
    return { kind: "ALREADY_PAISE" };
  }

  if (nearlyEqual(amount, expectedRupees)) {
    return { kind: "RUPEES", correctedPaise: expectedPaise };
  }

  return {
    kind: "UNCLASSIFIED",
    reason: `amount matches neither ${expectedRupees} (rupees) nor ${expectedPaise} (paise) — booking may have been edited after payment`,
  };
};
