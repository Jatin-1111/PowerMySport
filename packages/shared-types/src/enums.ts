/**
 * Canonical string-literal unions shared across apps. Each of these had
 * drifted independently before this package existed — see git history on
 * admin/src/types/index.ts and client/src/types/index.ts for the previous
 * per-app copies this replaces.
 */

// admin and client were both missing "VENUE_ONBOARDING" (server-only role
// used mid-onboarding before a venue lister's account is fully set up).
export type UserRole =
  | "Player"
  | "Parent"
  | "VenueLister"
  | "Coach"
  | "Academy"
  | "EXPERT"
  | "Admin"
  | "VENUE_ONBOARDING";

export type AdminRole =
  "SUPPORT_ADMIN" | "OPERATIONS_ADMIN" | "FINANCE_ADMIN" | "ANALYTICS_ADMIN" | "SYSTEM_ADMIN";

export type ServiceMode = "OWN_VENUE" | "FREELANCE" | "HYBRID";

/**
 * Canonical booking lifecycle.
 *
 *   PENDING_INVITES ─┐                     (group bookings only)
 *                    ├─> AWAITING_PAYMENT ──> AWAITING_PROVIDER ──> CONFIRMED
 *                    ┘                                                  │
 *                                                          IN_PROGRESS ─┘
 *                                                               │
 *                                                          COMPLETED
 *
 *   Terminal at any point: CANCELLED | EXPIRED | NO_SHOW
 *
 * AWAITING_PAYMENT and AWAITING_PROVIDER were previously a single
 * PENDING_CONFIRMATION state, with `paymentConfirmedAt` as the only way to
 * tell "nobody has paid yet" from "paid, waiting on the provider". Those are
 * different situations with different handling — an unpaid one is an abandoned
 * checkout that should be cleaned up, a paid one owes the customer a refund if
 * it lapses — so they are now distinct states rather than an implicit flag.
 */
export type BookingStatus =
  | "PENDING_INVITES" // Group booking waiting for invites to be accepted
  | "AWAITING_PAYMENT" // Slot held, payment not yet completed
  | "AWAITING_PROVIDER" // Paid, awaiting coach/venue/academy/expert acceptance
  | "CONFIRMED"
  | "IN_PROGRESS" // Booking started, check-in completed
  | "COMPLETED" // Booking finished successfully
  | "NO_SHOW" // User didn't show up
  | "CANCELLED"
  | "EXPIRED"; // Lapsed before it could be confirmed — refunded if it was paid

/** States in which a booking still occupies its slot and blocks other bookings. */
export const OCCUPYING_BOOKING_STATUSES: BookingStatus[] = [
  "AWAITING_PROVIDER",
  "CONFIRMED",
  "IN_PROGRESS",
];

/** States a customer may still cancel from. */
export const CANCELLABLE_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_INVITES",
  "AWAITING_PAYMENT",
  "AWAITING_PROVIDER",
  "CONFIRMED",
  "IN_PROGRESS",
];

// admin's copy was missing "Expert" and "Player" entirely, client's was
// missing "Expert" — a payment record for either would have silently failed
// to typecheck correctly in those apps.
export type PaymentUserType = "VenueLister" | "Coach" | "Academy" | "Expert" | "Player";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED";
