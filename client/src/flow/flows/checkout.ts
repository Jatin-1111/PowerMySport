import { defineFlow } from "../defineFlow";

/**
 * The booking checkout flow.
 *
 * `/checkout` is the single entry point; the near-duplicate `/dashboard/checkout`
 * it once shared this definition with has been deleted. The sequence and its
 * entry rules live here so a new provider type extends one flow, not a new page.
 */

export type CheckoutStep = "review" | "payment" | "confirm";

export type CheckoutFlowContext = {
  /** Slot, sport and a positive duration are all present. */
  hasBookingDetails: boolean;
  /** A payment method has been chosen. */
  hasPaymentMethod: boolean;
};

export const CHECKOUT_FLOW = defineFlow<CheckoutStep, CheckoutFlowContext>({
  id: "checkout",
  steps: ["review", "payment", "confirm"],
  canEnter: {
    // Guards on *entry*, which is what makes it safe to put the step in the URL:
    // opening ?step=confirm in a fresh tab lands on review, not on a pay button
    // for a booking that was never configured.
    payment: (c) => c.hasBookingDetails,
    confirm: (c) => c.hasBookingDetails && c.hasPaymentMethod,
  },
});

/** Step labels for the progress rail. Index matches `CHECKOUT_FLOW.steps`. */
export const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  review: "Review",
  payment: "Payment",
  confirm: "Confirm",
};

export const CHECKOUT_STEP_HEADINGS: Record<CheckoutStep, string> = {
  review: "Review your booking",
  payment: "Choose payment method",
  confirm: "Confirm and pay",
};
