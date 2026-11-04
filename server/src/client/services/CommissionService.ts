/**
 * The platform's commission on a partner's earnings.
 *
 * THE DEFINITION IS THE PARTNER TERMS, not this file — see
 * `client/src/modules/legal/components/partner-terms/Commission.tsx`. This is
 * the one implementation of what that document promises, so the two can be read
 * side by side:
 *
 *   "PowerMySport charges a platform commission of 15% of the Partner Fee on
 *    every Completed Transaction... deducted from the amount collected from the
 *    client before your payout is released."
 *   "Commission is calculated on the Partner Fee EXCLUDING GST and excluding any
 *    convenience or service charge shown separately to the client."
 *   "GST is charged on the commission at the rate then in force (currently 18%)
 *    and is recovered along with the commission."
 *
 * Worked example from those terms, which `commissionOn` reproduces exactly:
 *   Partner Fee 1000.00 - commission 150.00 - GST 27.00 = net 823.00
 *
 * TWO THINGS THIS IS NOT.
 *
 * 1. It is not the customer-facing service fee. `PricingRates.SERVICE_FEE_RATE`
 *    is a convenience charge ADDED to what the client pays; this is a share of
 *    the partner's fee DEDUCTED from what the partner receives. The terms
 *    explicitly exclude that charge from the commission base, so the two never
 *    compound.
 * 2. Its GST is not `PricingRates.TAX_RATE`. That 5% is tax on the customer's
 *    service fee. This 18% is the platform's tax on its own commission service
 *    to the partner. Different rate, different party, different invoice.
 *
 * ONE RATE FOR EVERY ROLE. Experts, academies, coaches and venue listers are all
 * charged the same published percentage — there is no per-role knob, so the
 * sentence "the platform takes 15%" stays true without qualification.
 */

const readRate = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw ?? fallback);
  // A malformed env var must never silently become NaN and zero out — or
  // explode — every partner's payout.
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
};

/**
 * The commission rate. ONE rate, applied to every partner role.
 *
 * There is deliberately no per-role override: a single published rate is what
 * the Partner Terms describe, and splitting it into four variables invites the
 * four to drift apart — at which point "the platform takes 15%" stops being a
 * true sentence and nobody can say what any given partner is actually charged
 * without reading the environment.
 */
export const COMMISSION_RATE = readRate(process.env.PLATFORM_COMMISSION_RATE, 0.15);

/**
 * 18%, "the rate then in force" per the Partner Terms.
 *
 * Separate from the commission rate on purpose: this is a tax rate set by law,
 * not a commercial term the platform chooses, and the two change for entirely
 * different reasons.
 */
export const COMMISSION_GST_RATE = readRate(process.env.COMMISSION_GST_RATE, 0.18);

export interface CommissionBreakdown {
  /** What the partner earned before the platform's cut, in paise. */
  partnerFeePaise: number;
  rate: number;
  commissionPaise: number;
  gstRate: number;
  gstOnCommissionPaise: number;
  /** What actually reaches the partner. */
  netPayablePaise: number;
}

/**
 * Split a partner fee into commission, GST on that commission, and net payout.
 *
 * Everything is whole paise, and `net` is derived by SUBTRACTION rather than by
 * its own rounding — so commission + gst + net always reconstructs the fee
 * exactly, with no stray paisa appearing or vanishing between the partner's
 * statement and the platform's books.
 */
export const commissionOn = (partnerFeePaise: number): CommissionBreakdown => {
  if (!Number.isFinite(partnerFeePaise) || partnerFeePaise < 0) {
    throw new Error("Commission needs a non-negative partner fee in paise");
  }
  if (!Number.isInteger(partnerFeePaise)) {
    throw new Error("Commission needs whole paise, not fractions");
  }

  const commissionPaise = Math.round(partnerFeePaise * COMMISSION_RATE);
  const gstOnCommissionPaise = Math.round(commissionPaise * COMMISSION_GST_RATE);

  return {
    partnerFeePaise,
    rate: COMMISSION_RATE,
    commissionPaise,
    gstRate: COMMISSION_GST_RATE,
    gstOnCommissionPaise,
    netPayablePaise: partnerFeePaise - commissionPaise - gstOnCommissionPaise,
  };
};

/**
 * Recompute after a refund.
 *
 * Per the terms: "No commission is charged on a Transaction that is cancelled
 * and fully refunded to the client. Where a partial refund is issued, commission
 * is recomputed on the retained amount."
 *
 * A full refund therefore yields a zero commission rather than a proportional
 * one, which is the difference between honouring that sentence and merely
 * approximating it.
 */
export const commissionOnRetained = (params: {
  originalFeePaise: number;
  refundedPaise: number;
}): CommissionBreakdown => {
  const retained = Math.max(0, params.originalFeePaise - params.refundedPaise);
  return commissionOn(retained);
};

/**
 * The adjustment owed after a refund: what the platform must give back from
 * commission it has already taken. Positive means the platform owes it back.
 */
export const commissionAdjustmentForRefund = (params: {
  originalFeePaise: number;
  refundedPaise: number;
}): { before: CommissionBreakdown; after: CommissionBreakdown; refundToPartnerPaise: number } => {
  const before = commissionOn(params.originalFeePaise);
  const after = commissionOnRetained(params);

  const chargedBefore = before.commissionPaise + before.gstOnCommissionPaise;
  const chargedAfter = after.commissionPaise + after.gstOnCommissionPaise;

  return {
    before,
    after,
    refundToPartnerPaise: Math.max(0, chargedBefore - chargedAfter),
  };
};

/** Human-readable line items, for an earnings statement or commission invoice. */
export const describeCommission = (
  breakdown: CommissionBreakdown
): Array<{ label: string; amountPaise: number; deduction: boolean }> => [
  {
    label: "Partner fee",
    amountPaise: breakdown.partnerFeePaise,
    deduction: false,
  },
  {
    label: `Platform commission @ ${Math.round(breakdown.rate * 100)}%`,
    amountPaise: breakdown.commissionPaise,
    deduction: true,
  },
  {
    label: `GST @ ${Math.round(breakdown.gstRate * 100)}% on commission`,
    amountPaise: breakdown.gstOnCommissionPaise,
    deduction: true,
  },
  {
    label: "Net payable",
    amountPaise: breakdown.netPayablePaise,
    deduction: false,
  },
];
