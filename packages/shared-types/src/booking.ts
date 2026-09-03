import type { PaymentStatus, PaymentUserType } from "./enums";
import type { BookingStatus } from "./enums";

/**
 * Canonical Booking shape, merged from the server Mongoose model
 * (server/src/client/models/Booking.ts — the real source of truth) against
 * admin and client's independent copies in their respective types/index.ts.
 *
 * admin's copy was missing group-booking fields (bookingType, organizerId,
 * participants, paymentType, splitMethod), delivery, expert, and most of the
 * cancellation/completion lifecycle fields entirely — not optional-and-absent,
 * genuinely never declared. client's copy had a smaller `expert` subset,
 * missing the gateway-id and reminder-timestamp fields.
 *
 * Deliberately excluded from BookingPayment: `grossAmount`,
 * `commissionAmount`, `commissionGstAmount`, `commissionRate` — payout
 * internals the server keeps for the finance pipeline, never surfaced to
 * admin or client today. Add them here explicitly if a UI ever needs them,
 * rather than exposing them by default.
 */

export type BookingProviderType = "VENUE" | "COACH" | "ACADEMY" | "EXPERT";
export type BookingType = "INDIVIDUAL" | "GROUP";
export type PaymentType = "SINGLE" | "SPLIT";
export type SplitMethod = "EQUAL" | "CUSTOM";
export type ParticipantStatus = "INVITED" | "ACCEPTED" | "DECLINED";
export type BookingDeliveryKind =
  "PLATFORM_VENUE" | "PROVIDER_VENUE" | "STUDENT_LOCATION" | "ONLINE";

export interface BookingPayment {
  userId: string;
  userType: PaymentUserType;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
}

export interface BookingExpertDetails {
  legacySessionId?: string;
  mode?: "ONLINE" | "IN_PERSON";
  meetingLink?: string;
  clientNote?: string;
  momNotes?: string;
  momAddedAt?: string;
  autoCompleted?: boolean;
  manualRefundStatus?: "NONE" | "REQUIRED" | "MANUAL_DONE";
  merchantOrderId?: string;
  phonepeOrderId?: string;
  momReminderSentAt?: string;
  reviewReminderSentAt?: string;
  meetingLinkNudgeSentAt?: string;
  startReminderSentAt?: string;
}

export interface BookingDelivery {
  kind: BookingDeliveryKind;
  venueId?: string;
  nameSnapshot?: string;
  addressSnapshot?: string;
  coordinates?: [number, number];
  platform?: string;
  meetingLink?: string;
}

export interface BookingParticipant {
  userId: string;
  name: string;
  status: ParticipantStatus;
  invitedAt: string;
  respondedAt?: string;
}

export interface Booking {
  id: string;
  userId: string;
  venueId?: string;
  coachId?: string;
  academyId?: string;
  expertId?: string;
  providerType?: BookingProviderType;

  sport?: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  serviceFee?: number;
  taxAmount?: number;
  promoCode?: string;
  discountAmount?: number;

  status: BookingStatus;
  expiresAt?: string;
  checkInCode?: string;

  participantName?: string;
  participantId?: string;
  participantAge?: number;
  paymentConfirmedAt?: string;
  confirmationEmailSentAt?: string;

  scheduledAt?: string;
  durationMinutes?: number;

  providerAcceptance?: "PENDING" | "ACCEPTED" | "DECLINED";
  providerRespondedAt?: string;
  completedAt?: string;

  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: "CLIENT" | "PROVIDER" | "ADMIN" | "SYSTEM";
  cancellationNoticeHours?: number;

  refundAmount?: number;
  refundStatus?: "PENDING" | "PROCESSED" | "REJECTED";
  payments?: BookingPayment[];

  bookingType?: BookingType;
  organizerId?: string;
  participants?: BookingParticipant[];
  paymentType?: PaymentType;
  splitMethod?: SplitMethod;

  expert?: BookingExpertDetails;
  delivery?: BookingDelivery;

  createdAt?: string;
  updatedAt?: string;
}
