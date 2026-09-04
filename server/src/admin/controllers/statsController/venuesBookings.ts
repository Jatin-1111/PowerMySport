import { Request, Response } from "express";
import { Booking } from "../../../client/models/Booking";
import { transformDocuments } from "../../../middleware/responseTransform";
import { getAllVenues as getAllVenuesService } from "../../../client/services/VenueService";
import { getPaginationParams } from "../../../utils/pagination";
import { asyncHandler } from "../../../middleware/asyncHandler";

// Get all venues
export const getAllVenues = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  // Using the service method matching the new signature
  const result = await getAllVenuesService(search ? { search } : {}, page, limit);

  res.status(200).json({
    success: true,
    message: "All venues retrieved successfully",
    data: transformDocuments(result.venues),
    pagination: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    },
  });
});

export const getAllBookings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, skip } = getPaginationParams(req.query.page, req.query.limit, 20, 100);

  const total = await Booking.countDocuments();
  const bookings = await Booking.find()
    .populate("userId venueId")
    .populate({
      path: "coachId",
      populate: { path: "userId", select: "name email" },
    })
    // Academy bookings were previously indistinguishable from venue bookings
    // here — unpopulated and unnamed — so the admin panel bucketed them as
    // venue bookings and had no way to show which academy they were for.
    .populate({ path: "academyId", select: "name" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const toId = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const candidate = value as { _id?: unknown; id?: unknown };
      if (typeof candidate.id === "string") return candidate.id;
      if (
        candidate._id &&
        typeof (candidate._id as { toString?: () => string }).toString === "function"
      ) {
        return (candidate._id as { toString: () => string }).toString();
      }
    }
    return "";
  };

  const normalizeEntity = (value: unknown): unknown => {
    if (!value || typeof value === "string") {
      return value;
    }

    if (typeof value === "object") {
      const plain = value as Record<string, unknown>;
      return {
        ...plain,
        id: toId(value),
      };
    }

    return value;
  };

  const transformedBookings = bookings.map((booking) => {
    const plain = booking as unknown as Record<string, unknown>;

    const playerRecord =
      plain.userId && typeof plain.userId === "object"
        ? (plain.userId as { name?: string; email?: string })
        : null;
    const venueRecord =
      plain.venueId && typeof plain.venueId === "object"
        ? (plain.venueId as { name?: string })
        : null;
    const coachRecord =
      plain.coachId && typeof plain.coachId === "object"
        ? (plain.coachId as { userId?: unknown; name?: string })
        : null;
    const coachUserRecord =
      coachRecord?.userId && typeof coachRecord.userId === "object"
        ? (coachRecord.userId as { name?: string; email?: string })
        : null;
    const academyRecord =
      plain.academyId && typeof plain.academyId === "object"
        ? (plain.academyId as { name?: string })
        : null;

    return {
      ...plain,
      id: toId(booking),
      userId: toId(plain.userId),
      venueId: normalizeEntity(plain.venueId),
      coachId: normalizeEntity(plain.coachId),
      academyId: normalizeEntity(plain.academyId),
      playerName: playerRecord?.name || playerRecord?.email || "",
      venueName: venueRecord?.name || "",
      coachName: coachUserRecord?.name || coachUserRecord?.email || coachRecord?.name || "",
      academyName: academyRecord?.name || "",
    };
  });

  res.status(200).json({
    success: true,
    message: "All bookings retrieved successfully",
    data: transformedBookings,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  });
});
