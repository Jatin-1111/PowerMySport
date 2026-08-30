/**
 * Recurring coaching programmes.
 *
 * Mirrors the server models. The three entities exist because a coaching
 * relationship is not a booking: an OFFERING is what the coach sells, an
 * ENROLLMENT is a student's membership in it, and an OCCURRENCE is one dated
 * session. Money lives on the subscription; delivery lives on the occurrence.
 *
 * 1:1 and batch are the same shape with a different `capacity`. Nothing in the
 * UI should branch on `capacity === 1`.
 */

export type CoachOfferingDeliveryKind =
  | "PLATFORM_VENUE"
  | "PROVIDER_VENUE"
  | "STUDENT_LOCATION"
  | "ONLINE";

export type CoachOfferingStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface CoachOfferingSlot {
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // "HH:mm" in the offering's timezone
  durationMinutes: number;
}

export interface SessionDelivery {
  kind: CoachOfferingDeliveryKind;
  venueId?: string;
  nameSnapshot?: string;
  addressSnapshot?: string;
  coordinates?: [number, number];
  platform?: string;
  meetingLink?: string;
}

export interface CoachOffering {
  id: string;
  coachId: string | { id: string; userId?: { name?: string; photoUrl?: string } };
  sport: string;
  title: string;
  description?: string;
  deliveryKind: CoachOfferingDeliveryKind;
  venueId?: string;
  onlinePlatform?: string;
  defaultMeetingLink?: string;
  capacity: number;
  enrolledCount: number;
  schedule: CoachOfferingSlot[];
  timezone: string;
  packageId: string;
  status: CoachOfferingStatus;
  startDate: string;
  endDate?: string | null;
  /** Added by the browse endpoint. */
  seatsLeft?: number;
  isFull?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CoachEnrollmentStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAUSED"
  | "CANCELLED"
  | "COMPLETED";

/** Ledger balance, keyed by credit status. */
export type CreditSummary = Partial<
  Record<
    "AVAILABLE" | "CONSUMED" | "EXPIRED" | "REFUNDED",
    { count: number; amountPaise: number }
  >
>;

export interface CoachEnrollment {
  id: string;
  offeringId: string | CoachOffering;
  coachId: string;
  userId: string;
  playerId?: string | null;
  subscriptionId?: string | null;
  status: CoachEnrollmentStatus;
  studentName: string;
  joinedAt: string;
  leftAt?: string | null;
  deliveryAddress?: {
    addressSnapshot?: string;
    coordinates?: [number, number];
  } | null;
  /** Present on the "my programmes" response — classes left, not time elapsed. */
  credits?: CreditSummary;
}

export type CoachOccurrenceStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED_BY_COACH"
  | "CANCELLED_BY_PLATFORM";

export type AttendanceMark = "PENDING" | "PRESENT" | "ABSENT";

export interface SessionRosterEntry {
  enrollmentId: string;
  userId: string;
  playerId?: string | null;
  studentName: string;
  attendance: AttendanceMark;
  creditId?: string | null;
  earnedPaise?: number;
}

export interface CoachSessionOccurrence {
  id: string;
  offeringId: string;
  coachId: string;
  sport: string;
  /** An instant, not a wall-clock pair. Render it in the viewer's timezone. */
  scheduledAt: string;
  durationMinutes: number;
  status: CoachOccurrenceStatus;
  delivery?: SessionDelivery;
  roster: SessionRosterEntry[];
  isMakeup: boolean;
  replacesOccurrenceId?: string | null;
  makeupOccurrenceId?: string | null;
  coachNotes?: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string;
  payout: {
    status: "PENDING" | "RELEASED" | "PAID";
    amountPaise: number;
    releaseAt?: string | null;
    paidAt?: string | null;
  };
}

/**
 * `amountPaise` is the NET the coach receives. Gross and the deductions come
 * with it so the console can show why the two differ — a coach seeing a smaller
 * number with no explanation is how trust in a payout system is lost.
 */
export type CoachEarningsSummary = Partial<
  Record<
    "PENDING" | "RELEASED" | "PAID",
    {
      sessions: number;
      amountPaise: number;
      grossPaise: number;
      commissionPaise: number;
      commissionGstPaise: number;
    }
  >
>;

export interface CoachOfferingCreateInput {
  sport: string;
  title: string;
  description?: string;
  deliveryKind: CoachOfferingDeliveryKind;
  venueId?: string;
  onlinePlatform?: string;
  defaultMeetingLink?: string;
  capacity?: number;
  schedule: CoachOfferingSlot[];
  timezone?: string;
  packageId: string;
  startDate: string;
  endDate?: string;
}

export interface EnrollInput {
  studentName: string;
  playerId?: string;
  // The price and billing period are NOT sent: the server derives them from the
  // programme's package. Sending them would mean the client could set its own
  // price.
  deliveryAddress?: {
    addressSnapshot?: string;
    coordinates?: [number, number];
  };
}

/** Human label for a delivery kind, used wherever a session is listed. */
export const DELIVERY_LABELS: Record<CoachOfferingDeliveryKind, string> = {
  ONLINE: "Online",
  PLATFORM_VENUE: "At a venue",
  PROVIDER_VENUE: "At the coach's place",
  STUDENT_LOCATION: "Coach travels to you",
};
