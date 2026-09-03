import { Booking, BookingDocument } from "../../models/Booking";
import { ExpertSession } from "../../models/ExpertBooking";
import { Expert } from "../../models/ExpertProfile";
import { Coach } from "../../models/Coach";
import { Venue } from "../../models/Venue";
import BookingInvitation from "../../models/BookingInvitation";
import {
  projectExpertSessionAsBooking,
  type ExpertSessionForProjection,
} from "../../../utils/expertSessionMapping";
import {
  type UserBookingRow,
  USER_BOOKING_SCAN_CAP,
  createdAtOf,
  expertDisplayFields,
} from "./shared";

/**
 * Every booking a parent has made, across all four provider types.
 *
 * Expert consultations still live in their own `expertsessions` collection, so
 * they are read separately and projected into the booking shape rather than
 * being missing from the list. Both sources are read whole and merged before
 * paging, because two collections cannot be skip/limited independently without
 * producing wrong pages the moment their rows interleave by date — page 1 would
 * hold the newest of each source rather than the newest overall.
 */
export const getUserBookings = async (
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  bookings: UserBookingRow[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const [bookings, sessions] = await Promise.all([
    Booking.find({ userId })
      .select("+checkInCode")
      .populate([
        { path: "venueId" },
        {
          path: "coachId",
          populate: { path: "userId", select: "name email phone" },
        },
        { path: "academyId" },
        {
          path: "expertId",
          model: Expert,
          // Explicit select, never the whole document: Expert holds PAN and GST
          // with decrypting getters that must not reach a parent-facing payload.
          select: "photoUrl city sessionMode timezone rating reviewCount",
          populate: { path: "userId", select: "name" },
        },
      ])
      .sort({ createdAt: -1 })
      .limit(USER_BOOKING_SCAN_CAP),
    ExpertSession.find({ userId })
      .populate({
        path: "expertId",
        model: Expert,
        select: "photoUrl city sessionMode timezone rating reviewCount",
        populate: { path: "userId", select: "name" },
      })
      .sort({ createdAt: -1 })
      .limit(USER_BOOKING_SCAN_CAP),
  ]);

  // Once migration 25 runs, a session exists in both collections. The Booking
  // copy wins, so the list does not double every expert booking on the day that
  // migration is applied.
  const alreadyMigrated = new Set(
    bookings
      .map((b) => b.expert?.legacySessionId)
      .filter((id): id is string => Boolean(id))
      .map(String)
  );

  const projected = sessions
    .filter((session) => !alreadyMigrated.has(String(session._id)))
    .map((session) =>
      projectExpertSessionAsBooking(
        session.toObject() as unknown as ExpertSessionForProjection,
        expertDisplayFields(session.expertId)
      )
    );

  const merged = [...bookings, ...projected].sort((a, b) => createdAtOf(b) - createdAtOf(a));

  const total = merged.length;
  const start = (page - 1) * limit;

  return {
    bookings: merged.slice(start, start + limit),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get all bookings for a venue (for venue owners)
 */
export const getVenueBookings = async (
  venueId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const query = {
    venueId,
    status: {
      $in: [
        "AWAITING_PAYMENT",
        "AWAITING_PROVIDER",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "NO_SHOW",
      ],
    },
  };
  const skip = (page - 1) * limit;

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate("userId coachId")
    .sort({ date: 1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get bookings for a venue on a specific date (optimized for availability check)
 */
export const getVenueBookingsForDate = async (
  venueId: string,
  date: Date
): Promise<Array<{ startTime: string; endTime: string }>> => {
  // UTC accessors — see toDayRange above / combineDateAndTimeIST for why:
  // `date` is UTC-midnight-anchored and Date#setHours reads/writes in the
  // server process's local timezone.
  const startOfDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  return Booking.find({
    venueId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    status: {
      $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER", "PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"],
    },
  })
    .select("startTime endTime")
    .lean();
};

/**
 * Get all bookings for a venue lister (across all their venues)
 */
export const getVenueListerBookings = async (
  ownerId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  bookings: any[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  // Find all venues owned by this user — only the ids are needed downstream.
  const venues = await Venue.find({ ownerId }).select("_id").lean();
  const venueIds = venues.map((v) => v._id);

  const query = {
    venueId: { $in: venueIds },
    status: {
      $in: [
        "AWAITING_PAYMENT",
        "AWAITING_PROVIDER",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "NO_SHOW",
      ],
    },
  };
  const skip = (page - 1) * limit;

  // Independent reads — no reason to wait on the count before starting the
  // page fetch.
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(query),
    Booking.find(query)
      .populate([
        { path: "userId" },
        { path: "venueId" },
        {
          path: "coachId",
          populate: { path: "userId", select: "name email phone" },
        },
        { path: "academyId" },
      ])
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get all bookings for a coach (by coach userId)
 */
export const getCoachBookings = async (
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  bookings: any[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const coach = await Coach.findOne({ userId }).select("_id").lean();
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  const query = {
    coachId: coach._id,
    status: {
      $in: [
        "AWAITING_PAYMENT",
        "AWAITING_PROVIDER",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "NO_SHOW",
      ],
    },
  };
  const skip = (page - 1) * limit;

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(query),
    Booking.find(query)
      .populate([
        { path: "userId" },
        { path: "venueId" },
        {
          path: "coachId",
          populate: { path: "userId", select: "name email phone" },
        },
        { path: "academyId" },
      ])
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get booking invitations for a user
 */
export const getUserBookingInvitations = async (
  userId: string,
  status?: "PENDING" | "ACCEPTED" | "DECLINED"
): Promise<any[]> => {
  const query: any = { inviteeId: userId };
  if (status) {
    query.status = status;
  }

  const invitations = await BookingInvitation.find(query)
    .populate("inviterId", "name email photoUrl")
    .populate("venueId", "name location address")
    .populate("coachId", "name sport")
    .populate("bookingId")
    .sort({ createdAt: -1 })
    .lean();

  return invitations;
};

/** Cheap sibling of `getUserBookingInvitations` for badge-count call sites —
 *  avoids fetching and 4-way-populating every invitation just to read
 *  `.length`. */
export const countUserBookingInvitations = async (
  userId: string,
  status?: "PENDING" | "ACCEPTED" | "DECLINED"
): Promise<number> => {
  const query: any = { inviteeId: userId };
  if (status) {
    query.status = status;
  }

  return BookingInvitation.countDocuments(query);
};
