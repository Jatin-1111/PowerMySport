import mongoose, { Document, Schema } from "mongoose";
import { BookingStatus } from "../../types/index";
import { notifyUserDataUpdated } from "../sockets/friendSocket";

/**
 * The provider dimension of a booking. Shared with BookingEvent.providerType,
 * and the discriminator the unified booking model is built around.
 */
export type BookingProviderType = "VENUE" | "COACH" | "ACADEMY" | "EXPERT";

export type BookingType = "INDIVIDUAL" | "GROUP";
export type PaymentType = "SINGLE" | "SPLIT";
export type SplitMethod = "EQUAL" | "CUSTOM";
export type ParticipantStatus = "INVITED" | "ACCEPTED" | "DECLINED";

export interface BookingPayment {
  userId: mongoose.Types.ObjectId;
  userType: "VenueLister" | "Coach" | "Academy" | "Expert" | "Player";
  /**
   * For a PAYEE (venue/coach/academy) this is the NET payable — what actually
   * reaches them once the platform's commission and the GST on it are taken
   * off. It is the number the payout pipeline pays, so anything else here would
   * overpay the partner.
   *
   * For the PLAYER entry it is what they were charged. Commission never touches
   * that side: it is deducted from the partner, not added to the customer.
   *
   * In rupees, like every other money field on Booking. (The coaching-programme
   * ledger is in paise — the two are converted at the boundary, never mixed.)
   */
  amount: number;
  /** Payee only: the Partner Fee before deductions. */
  grossAmount?: number;
  commissionAmount?: number;
  commissionGstAmount?: number;
  commissionRate?: number;
  status: "PENDING" | "PAID" | "FAILED";
  paidAt?: Date;
}

/**
 * Expert-consultation state.
 *
 * Kept as a nested subdocument rather than ~12 flat fields because the other
 * three provider types never use any of it — flattening would put a dozen
 * always-null columns on every venue and coach booking, and make it impossible
 * to tell at a glance which fields belong to which provider type.
 *
 * What is deliberately NOT here: anything the unified Booking already models.
 * `scheduledAt`, `durationMinutes`, `providerAcceptance`, `providerRespondedAt`,
 * `completedAt`, `cancelledBy` and `cancellationNoticeHours` all began as
 * expert-only fields and were promoted to the core, because every provider type
 * needs them. Reviews are excluded too: they belong in the shared `Review`
 * model, not inline on the booking the way ExpertSession stored them.
 */
export interface BookingExpertDetails {
  /**
   * The _id of the ExpertSession this booking was migrated from. Present only
   * on migrated records; it is the marker migration 25 uses to stay idempotent
   * and to identify exactly what it created if it has to be rolled back.
   */
  legacySessionId?: string;
  /** ONLINE sessions carry a meeting link; IN_PERSON ones use the expert's address. */
  mode?: "ONLINE" | "IN_PERSON";
  meetingLink?: string;
  /** Free-text context the parent supplied when booking. */
  clientNote?: string;
  /** Minutes of meeting — required before an expert session can be COMPLETED. */
  momNotes?: string;
  /** First submission time, preserved even if momNotes is revised later. */
  momAddedAt?: Date;
  /** True when a job closed the session out rather than the expert. */
  autoCompleted?: boolean;
  /**
   * Manual-refund tracking. Expert refunds are processed by hand by finance,
   * which the shared `refundStatus` (PENDING/PROCESSED/REJECTED, gateway-driven)
   * does not express.
   */
  manualRefundStatus?: "NONE" | "REQUIRED" | "MANUAL_DONE";
  /** Gateway ids. Expert sessions carry these inline as well as on the transaction. */
  merchantOrderId?: string;
  phonepeOrderId?: string;
  // One-shot reminder dedup timestamps.
  momReminderSentAt?: Date;
  reviewReminderSentAt?: Date;
  meetingLinkNudgeSentAt?: Date;
  startReminderSentAt?: Date;
}

/**
 * Where and how a booked session is actually delivered.
 *
 * Before this existed, a booking recorded no location of any kind: every
 * consumer re-derived it from the provider's *current* profile with its own
 * rule. That produced two live defects — `playerLocation` was validated at
 * booking time and then discarded (so a freelance coach booking never recorded
 * where the coach had to go), and the GST invoice read
 * `coach.ownVenueDetails.address` for every coach booking, which is `undefined`
 * for a freelance coach and silently changes on an already-issued invoice when
 * the coach edits their profile.
 *
 * So this is a SNAPSHOT, not a reference. `venueId` is kept for linking, but
 * the address and name are copied at creation and never refreshed — an invoice
 * must say where the session was when it was sold.
 *
 * ONLINE is declared here from the outset so the shape does not need widening
 * when online coaching lands; nothing produces it yet.
 */
export type BookingDeliveryKind =
  | "PLATFORM_VENUE"
  | "PROVIDER_VENUE"
  | "STUDENT_LOCATION"
  | "ONLINE";

export interface BookingDelivery {
  kind: BookingDeliveryKind;
  /** PLATFORM_VENUE only — the listed venue the session was booked at. */
  venueId?: mongoose.Types.ObjectId;
  /** Display name as it stood at booking time (venue name, academy name). */
  nameSnapshot?: string;
  /** Address as it stood at booking time. The invoice's place-of-supply source. */
  addressSnapshot?: string;
  /** [longitude, latitude] as it stood at booking time. */
  coordinates?: [number, number];
  /** ONLINE only. */
  platform?: string;
  meetingLink?: string;
}

export interface BookingParticipant {
  userId: mongoose.Types.ObjectId;
  name: string;
  status: ParticipantStatus;
  invitedAt: Date;
  respondedAt?: Date;
}

export interface BookingDocument extends Document {
  userId: mongoose.Types.ObjectId;
  venueId?: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;
  academyId?: mongoose.Types.ObjectId;
  /** Set for providerType EXPERT. */
  expertId?: mongoose.Types.ObjectId;
  /**
   * Which kind of provider this booking is against.
   *
   * Derived from venueId/coachId/academyId by a pre-validate hook rather than
   * set by callers, so it can never drift from the ids it summarizes. It is
   * stored rather than computed on read because every consumer currently
   * re-derives it with its own slightly different rule — the admin panel, for
   * instance, buckets academy bookings as venue bookings because it only ever
   * checks `coachId`.
   *
   * EXPERT is declared here ahead of the ExpertSession merge so the discriminator
   * does not need widening again later.
   */
  providerType: BookingProviderType;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
  serviceFee?: number;
  taxAmount?: number;
  promoCode?: string;
  discountAmount?: number;
  status: BookingStatus;
  expiresAt?: Date; // Optional - only set for PENDING_PAYMENT bookings
  checkInCode?: string;
  participantName: string;
  participantId?: mongoose.Types.ObjectId;
  participantAge?: number;
  paymentConfirmedAt?: Date;
  confirmationEmailSentAt?: Date;

  /**
   * When the session actually starts, as a true instant.
   *
   * `date` + `startTime` are an IST wall-clock pair, which is fine for
   * slot-based providers but cannot express a timezone. Expert sessions have
   * always been stored as an instant, and that is the better representation,
   * so it is promoted here. For VENUE/COACH/ACADEMY it is derived from
   * date+startTime; for EXPERT it is authoritative and date/startTime/endTime
   * are derived from it, so the existing slot and listing queries keep working.
   */
  scheduledAt?: Date;
  /** Session length in minutes. Derived from startTime/endTime for slot providers. */
  durationMinutes?: number;

  /**
   * Whether the provider has accepted this booking. Previously expert-only
   * (`expertAcceptance`); promoted because venues and academies need exactly
   * the same concept — and because time-to-accept and decline rate are the
   * provider SLA metrics the platform currently cannot report on for any role.
   */
  providerAcceptance?: "PENDING" | "ACCEPTED" | "DECLINED";
  providerRespondedAt?: Date;

  /** Set when the booking reaches COMPLETED — the anchor for the payout window. */
  completedAt?: Date;

  cancelledAt?: Date;
  cancellationReason?: string;
  /** Which party cancelled. Was expert-only; every role needs it for disputes. */
  cancelledBy?: "CLIENT" | "PROVIDER" | "ADMIN" | "SYSTEM";
  /**
   * Hours of notice before the session when a paid booking was cancelled
   * (negative if cancelled after it started). Informational: admin uses it to
   * judge a late cancellation. The app never auto-forfeits on it.
   */
  cancellationNoticeHours?: number;

  refundAmount?: number;
  refundStatus?: "PENDING" | "PROCESSED" | "REJECTED";
  payments: BookingPayment[];
  // Group booking fields
  bookingType: BookingType;
  organizerId: mongoose.Types.ObjectId;
  participants: BookingParticipant[];
  paymentType: PaymentType;
  splitMethod?: SplitMethod;
  /** Present only when providerType is EXPERT. */
  expert?: BookingExpertDetails;
  /**
   * Where this session is delivered, snapshotted at creation. Optional only
   * because bookings created before migration 29 may not have one — every new
   * booking is given one by `resolveBookingDelivery`.
   */
  delivery?: BookingDelivery;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: false,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
    },
    academyId: {
      type: Schema.Types.ObjectId,
      ref: "Academy",
    },
    expertId: {
      type: Schema.Types.ObjectId,
      ref: "Expert",
    },
    providerType: {
      type: String,
      enum: ["VENUE", "COACH", "ACADEMY", "EXPERT"],
      required: true,
    },
    sport: {
      type: String,
      required: [true, "Sport is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Booking date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "Start time must be in HH:mm format",
      ],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "End time must be in HH:mm format",
      ],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    promoCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "PENDING_INVITES",
        "AWAITING_PAYMENT",
        "AWAITING_PROVIDER",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
        "EXPIRED",
      ],
      default: "AWAITING_PAYMENT",
    },
    expiresAt: {
      type: Date,
      required: false, // Only set while the hold is live — see utils/timer.ts
    },
    checkInCode: {
      type: String,
      select: false,
      uppercase: true,
      trim: true,
      minlength: 8,
      maxlength: 8,
    },
    participantName: {
      type: String,
      required: [true, "Participant name is required"],
    },
    participantId: {
      type: Schema.Types.ObjectId,
    },
    participantAge: {
      type: Number,
    },
    paymentConfirmedAt: {
      type: Date,
    },
    confirmationEmailSentAt: {
      type: Date,
    },
    scheduledAt: {
      type: Date,
    },
    durationMinutes: {
      type: Number,
      min: 0,
    },
    providerAcceptance: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED"],
    },
    providerRespondedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledBy: {
      type: String,
      enum: ["CLIENT", "PROVIDER", "ADMIN", "SYSTEM"],
    },
    cancellationNoticeHours: {
      type: Number,
    },
    refundAmount: {
      type: Number,
      min: 0,
    },
    refundStatus: {
      type: String,
      enum: ["PENDING", "PROCESSED", "REJECTED"],
    },
    payments: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        userType: {
          type: String,
          enum: ["VenueLister", "Coach", "Academy", "Expert", "Player"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        grossAmount: { type: Number, min: 0 },
        commissionAmount: { type: Number, min: 0 },
        commissionGstAmount: { type: Number, min: 0 },
        commissionRate: { type: Number, min: 0 },
        status: {
          type: String,
          enum: ["PENDING", "PAID", "FAILED"],
          default: "PENDING",
        },
        paidAt: {
          type: Date,
        },
      },
    ],
    // Group booking fields
    bookingType: {
      type: String,
      enum: ["INDIVIDUAL", "GROUP"],
      default: "INDIVIDUAL",
    },
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["INVITED", "ACCEPTED", "DECLINED"],
          default: "INVITED",
        },
        invitedAt: {
          type: Date,
          required: true,
        },
        respondedAt: {
          type: Date,
        },
      },
    ],
    paymentType: {
      type: String,
      enum: ["SINGLE", "SPLIT"],
      default: "SINGLE",
    },
    splitMethod: {
      type: String,
      enum: ["EQUAL", "CUSTOM"],
    },
    expert: {
      type: new Schema<BookingExpertDetails>(
        {
          legacySessionId: { type: String, index: true, sparse: true },
          mode: { type: String, enum: ["ONLINE", "IN_PERSON"] },
          meetingLink: { type: String, trim: true },
          clientNote: { type: String, trim: true, maxlength: 1000 },
          momNotes: { type: String, trim: true, maxlength: 4000 },
          momAddedAt: { type: Date },
          autoCompleted: { type: Boolean },
          manualRefundStatus: {
            type: String,
            enum: ["NONE", "REQUIRED", "MANUAL_DONE"],
          },
          merchantOrderId: { type: String, trim: true },
          phonepeOrderId: { type: String, trim: true },
          momReminderSentAt: { type: Date },
          reviewReminderSentAt: { type: Date },
          meetingLinkNudgeSentAt: { type: Date },
          startReminderSentAt: { type: Date },
        },
        { _id: false },
      ),
      required: false,
    },
    delivery: {
      type: new Schema<BookingDelivery>(
        {
          kind: {
            type: String,
            enum: [
              "PLATFORM_VENUE",
              "PROVIDER_VENUE",
              "STUDENT_LOCATION",
              "ONLINE",
            ],
            required: true,
          },
          venueId: { type: Schema.Types.ObjectId, ref: "Venue" },
          nameSnapshot: { type: String, trim: true },
          addressSnapshot: { type: String, trim: true },
          coordinates: {
            type: [Number],
            // Without this Mongoose materialises an omitted array path as [],
            // so a delivery that legitimately has no coordinates (an address-only
            // provider venue) would carry a meaningless empty array.
            default: undefined,
            validate: {
              validator(v: unknown) {
                if (v === undefined || v === null) return true;
                if (Array.isArray(v) && v.length === 0) return true;
                return (
                  Array.isArray(v) &&
                  v.length === 2 &&
                  v.every((c) => typeof c === "number" && !Number.isNaN(c))
                );
              },
              message: "Coordinates must be [longitude, latitude]",
            },
          },
          platform: { type: String, trim: true },
          meetingLink: { type: String, trim: true },
        },
        { _id: false },
      ),
      required: false,
      validate: {
        // Per-kind invariants live here rather than in the resolver alone, so
        // no future write path can persist a delivery that says less than its
        // kind promises.
        validator(v: BookingDelivery | undefined | null) {
          if (!v) return true;
          if (v.kind === "PLATFORM_VENUE") return Boolean(v.venueId);
          if (v.kind === "STUDENT_LOCATION") {
            return Array.isArray(v.coordinates) && v.coordinates.length === 2;
          }
          return true;
        },
        message:
          "delivery is missing the fields its kind requires (PLATFORM_VENUE needs venueId; STUDENT_LOCATION needs coordinates)",
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc: any, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/**
 * Derive `providerType` from the provider ids on every write.
 *
 * Precedence matches BookingEventService.providerDimensionsForBooking and must
 * stay in step with it: academy first (an academy booking is the academy's to
 * manage), then coach (for a coached session at a venue the coach is the party
 * whose acceptance and payout the lifecycle turns on), then venue.
 *
 * Deriving here rather than trusting callers means the field cannot drift from
 * the ids, and no call site has to remember to set it.
 */
export const deriveBookingProviderType = (booking: {
  venueId?: unknown;
  coachId?: unknown;
  academyId?: unknown;
  expertId?: unknown;
}): BookingProviderType => {
  if (booking.expertId) return "EXPERT";
  if (booking.academyId) return "ACADEMY";
  if (booking.coachId) return "COACH";
  return "VENUE";
};

bookingSchema.pre("validate", function () {
  // Expert wins outright: an expert consultation may reference a venue for an
  // IN_PERSON session, but it is still the expert's booking.
  if (this.venueId || this.coachId || this.academyId || this.expertId) {
    this.providerType = deriveBookingProviderType(this);
  }
});

// Index for faster booking conflict checks (venue)
bookingSchema.index({ venueId: 1, date: 1, startTime: 1, endTime: 1 });

// Admin/ops slices by provider kind — replaces re-deriving the bucket in every
// consumer (and the admin panel's habit of counting academies as venues).
bookingSchema.index({ providerType: 1, status: 1, date: -1 });

// Index for coach booking conflicts
bookingSchema.index({ coachId: 1, date: 1, startTime: 1, endTime: 1 });

// Index for academy batch-capacity counts
bookingSchema.index({ academyId: 1, date: 1, startTime: 1, endTime: 1 });

// Expert sessions are looked up by instant rather than by wall-clock slot.
bookingSchema.index({ expertId: 1, scheduledAt: 1 });

// Index for expiration cleanup job
bookingSchema.index({ expiresAt: 1, status: 1 });

// Index for fast check-in code lookups
bookingSchema.index({ checkInCode: 1 });

// Compound index for admin: user booking history sorted by date
bookingSchema.index({ userId: 1, status: 1, date: -1 });

// Compound index for admin: all bookings by status sorted by creation date
bookingSchema.index({ status: 1, createdAt: -1 });

// Index for venue bookings only
bookingSchema.index(
  { userId: 1, venueId: 1, date: 1, startTime: 1 },
  {
    name: "user_venue_booking_slot",
    partialFilterExpression: { venueId: { $exists: true } },
  },
);

// Index for coach bookings only
bookingSchema.index(
  { userId: 1, coachId: 1, date: 1, startTime: 1 },
  {
    name: "user_coach_booking_slot",
    partialFilterExpression: { coachId: { $exists: true } },
  },
);

// --- Real-time Auto Updates ---
const notifyUsersOfBookingUpdate = (doc: any) => {
  if (!doc) return;
  if (doc.userId) {
    notifyUserDataUpdated(doc.userId.toString(), "booking:updated");
  }
  if (doc.participants && Array.isArray(doc.participants)) {
    doc.participants.forEach((p: any) => {
      if (p.userId) {
        notifyUserDataUpdated(p.userId.toString(), "booking:updated");
      }
    });
  }
};

bookingSchema.post("save", function (doc) {
  notifyUsersOfBookingUpdate(doc);
});

bookingSchema.post("findOneAndUpdate", function (doc) {
  notifyUsersOfBookingUpdate(doc);
});
bookingSchema.post("updateMany", function () {
  // Can't easily get docs here, but usually updateMany isn't used for single user dashboard triggers
});

export const Booking = mongoose.model<BookingDocument>(
  "Booking",
  bookingSchema,
);
