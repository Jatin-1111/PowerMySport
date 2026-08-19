/**
 * The authoritative fee and tax rates.
 *
 * These live server-side only, read from non-public env vars. The client used to
 * read its own `NEXT_PUBLIC_SERVICE_FEE_RATE` / `NEXT_PUBLIC_TAX_RATE` copies to
 * render the price breakdown, which meant the number a customer was shown and
 * the number they were charged came from two independently-configured sources.
 * They agreed only by luck; a change to one without the other would silently
 * quote a price the API then refused to honour.
 *
 * Exported here so `BookingService` (which charges) and the pricing quote
 * endpoint (which the client displays) cannot drift apart — one definition, two
 * readers.
 */

const readRate = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw ?? fallback);
  // A malformed env var must not silently become NaN and poison every total.
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

export const SERVICE_FEE_RATE = readRate(process.env.SERVICE_FEE_RATE, 0);
export const TAX_RATE = readRate(process.env.TAX_RATE, 0.05);

export const SUBSCRIPTION_PLATFORM_FEE_RATE = readRate(
  process.env.SUBSCRIPTION_PLATFORM_FEE_RATE ?? process.env.SERVICE_FEE_RATE,
  0,
);
export const SUBSCRIPTION_TAX_RATE = readRate(
  process.env.SUBSCRIPTION_TAX_RATE ?? process.env.TAX_RATE,
  0.05,
);

export type FeeBreakdown = {
  subtotal: number;
  serviceFee: number;
  tax: number;
  total: number;
};

/**
 * The booking fee breakdown for a subtotal.
 *
 * Mirrors `BookingService`'s own arithmetic exactly, including the detail that
 * tax applies to the *service fee* rather than to the subtotal, and that a zero
 * service fee means zero tax.
 */
export const computeBookingFees = (
  subtotal: number,
  discount = 0,
): FeeBreakdown => {
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
  const tax = serviceFee > 0 ? Math.round(serviceFee * TAX_RATE) : 0;
  const total = Math.max(0, subtotal + serviceFee + tax - discount);
  return { subtotal, serviceFee, tax, total };
};

/** The subscription equivalent, in paise. */
export const computeSubscriptionFees = (
  baseAmountInPaise: number,
): FeeBreakdown => {
  const serviceFee = Math.round(
    baseAmountInPaise * SUBSCRIPTION_PLATFORM_FEE_RATE,
  );
  const tax = serviceFee > 0 ? Math.round(serviceFee * SUBSCRIPTION_TAX_RATE) : 0;
  return {
    subtotal: baseAmountInPaise,
    serviceFee,
    tax,
    total: baseAmountInPaise + serviceFee + tax,
  };
};
