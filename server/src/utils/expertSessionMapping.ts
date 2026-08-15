import { BookingStatus } from "../types/index";
import { IST_OFFSET_MINUTES } from "./openingHours";

/**
 * Translation between the legacy ExpertSession shape and the unified Booking.
 *
 * Kept pure and dependency-free (no mongoose, no models) for two reasons: it is
 * the single place the mapping is defined, and both consumers need it — the
 * one-way data migration, and the `/api/experts/sessions/*` compatibility shim
 * that keeps the existing expert UI working while it still speaks the old
 * vocabulary. If those two ever disagreed, the API would describe a booking
 * differently from how it was stored.
 */

export type ExpertSessionStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export type ExpertAcceptance = "PENDING" | "ACCEPTED" | "DECLINED";

export type ExpertSessionCanceller = "CLIENT" | "EXPERT" | "ADMIN" | "SYSTEM";

/** The subset of an ExpertSession the mapping actually reads. */
export interface ExpertSessionLike {
  status: ExpertSessionStatus;
  expertAcceptance?: ExpertAcceptance;
  scheduledAt?: Date | null;
  cancelledBy?: ExpertSessionCanceller | null;
  cancelReason?: string | null;
  paymentStatus?: "PENDING" | "COMPLETED" | "FAILED";
}

/**
 * The reason an unpaid hold gets cancelled by the sweeper. Matched exactly so
 * a human-cancelled session is never mistaken for an expired one.
 */
export const HOLD_EXPIRY_REASON = "Payment not completed in time";

/**
 * Map an ExpertSession status onto the unified booking status.
 *
 * The two vocabularies are not one-to-one, because ExpertSession encodes
 * provider acceptance in a *separate* field while the unified machine encodes
 * it in the status itself:
 *
 *   PENDING_PAYMENT                      -> AWAITING_PAYMENT
 *   PAID                                 -> AWAITING_PROVIDER   (paid, no time agreed yet)
 *   SCHEDULED + acceptance PENDING       -> AWAITING_PROVIDER   (expert has not accepted)
 *   SCHEDULED + acceptance ACCEPTED      -> CONFIRMED
 *   SCHEDULED + acceptance DECLINED      -> CANCELLED           (declines always cancel)
 *   COMPLETED                            -> COMPLETED
 *   CANCELLED (by SYSTEM, hold lapsed)   -> EXPIRED
 *   CANCELLED (anything else)            -> CANCELLED
 *
 * The SCHEDULED split is the substantive one: a session with a time on the
 * calendar that the expert has not yet agreed to is *not* confirmed, and the
 * old model could only express that by pairing a status with a second field.
 *
 * The SYSTEM-cancellation split matters because "the customer never paid" and
 * "someone cancelled this" are different outcomes that the expert model
 * flattened into one status — and EXPIRED is what the booking side has always
 * called the former.
 */
export const mapExpertStatusToBookingStatus = (
  session: ExpertSessionLike,
): BookingStatus => {
  switch (session.status) {
    case "PENDING_PAYMENT":
      return "AWAITING_PAYMENT";

    case "PAID":
      return "AWAITING_PROVIDER";

    case "SCHEDULED":
      if (session.expertAcceptance === "ACCEPTED") return "CONFIRMED";
      if (session.expertAcceptance === "DECLINED") return "CANCELLED";
      return "AWAITING_PROVIDER";

    case "COMPLETED":
      return "COMPLETED";

    case "CANCELLED":
      return session.cancelledBy === "SYSTEM" &&
        session.cancelReason === HOLD_EXPIRY_REASON
        ? "EXPIRED"
        : "CANCELLED";

    default: {
      // Exhaustiveness guard: a new ExpertSession status must be mapped here
      // explicitly rather than silently defaulting to something plausible.
      const unmapped: never = session.status;
      throw new Error(`Unmapped ExpertSession status: ${String(unmapped)}`);
    }
  }
};

/**
 * Reverse mapping, for the compatibility shim.
 *
 * Lossy in one direction only: AWAITING_PROVIDER covers both "paid, no time
 * agreed" (PAID) and "time set, expert has not accepted" (SCHEDULED), so
 * `scheduledAt` is what tells them apart — exactly the same information the
 * old model used.
 */
export const mapBookingStatusToExpertStatus = (booking: {
  status: BookingStatus;
  scheduledAt?: Date | null;
}): ExpertSessionStatus => {
  switch (booking.status) {
    case "AWAITING_PAYMENT":
    case "PENDING_INVITES":
      return "PENDING_PAYMENT";
    case "AWAITING_PROVIDER":
      return booking.scheduledAt ? "SCHEDULED" : "PAID";
    case "CONFIRMED":
    case "IN_PROGRESS":
      return "SCHEDULED";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
    case "EXPIRED":
    case "NO_SHOW":
      return "CANCELLED";
    default: {
      const unmapped: never = booking.status;
      throw new Error(`Unmapped booking status: ${String(unmapped)}`);
    }
  }
};

/** ExpertSession's canceller vocabulary uses EXPERT where Booking uses PROVIDER. */
export const mapExpertCanceller = (
  cancelledBy: ExpertSessionCanceller | null | undefined,
): "CLIENT" | "PROVIDER" | "ADMIN" | "SYSTEM" | undefined => {
  if (!cancelledBy) return undefined;
  return cancelledBy === "EXPERT" ? "PROVIDER" : cancelledBy;
};

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Derive the IST wall-clock slot (date + startTime + endTime) that a booking
 * needs from an expert session's instant.
 *
 * Expert sessions store a true instant; the rest of the booking system stores
 * a UTC-midnight-anchored date plus "HH:mm" IST strings, and every slot,
 * listing and conflict query reads those. So the instant stays authoritative
 * and this fills in the derived fields, rather than the reverse.
 *
 * Uses pure UTC arithmetic for the same reason combineDateAndTimeIST does:
 * Date#getHours would read the server process's local timezone and silently
 * shift the result by 5.5 hours on any host not running in IST.
 */
export const deriveSlotFromInstant = (
  scheduledAt: Date,
  durationMinutes: number,
): { date: Date; startTime: string; endTime: string } => {
  const istMs = scheduledAt.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const ist = new Date(istMs);

  const date = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()),
  );

  const startMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const safeDuration =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? Math.round(durationMinutes)
      : 60;

  // A session may run past midnight IST. The booking model's endTime is a
  // wall-clock string with no day component, so it is clamped to 23:59 rather
  // than silently wrapping to a small number that would read as ending before
  // it started.
  const rawEnd = startMinutes + safeDuration;
  const endMinutes = Math.min(rawEnd, 23 * 60 + 59);

  return {
    date,
    startTime: `${pad(Math.floor(startMinutes / 60))}:${pad(startMinutes % 60)}`,
    endTime: `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`,
  };
};

/** True when the derived endTime had to be clamped — the session crosses IST midnight. */
export const slotCrossesMidnightIST = (
  scheduledAt: Date,
  durationMinutes: number,
): boolean => {
  const istMs = scheduledAt.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const ist = new Date(istMs);
  const startMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return startMinutes + (durationMinutes || 60) > 23 * 60 + 59;
};
