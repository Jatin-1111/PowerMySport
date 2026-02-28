import { Request, Response } from "express";
import { Booking } from "../models/Booking";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import VenueInquiry from "../models/VenueInquiry";
import { getAllVenues as getAllVenuesService } from "../services/VenueService";
import { getPaginationParams } from "../utils/pagination";

// Get platform statistics
export const getPlatformStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [
      totalUsers,
      totalVenues,
      totalBookings,
      pendingInquiries,
      revenueResult,
    ] = await Promise.all([
      User.countDocuments(),
      Venue.countDocuments(),
      Booking.countDocuments(),
      VenueInquiry.countDocuments({ status: "PENDING" }),
      Booking.aggregate([
        { $match: { status: "CONFIRMED" } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

    const revenue = revenueResult[0]?.totalRevenue || 0;

    res.status(200).json({
      success: true,
      message: "Platform stats retrieved",
      data: {
        totalUsers,
        totalVenues,
        totalBookings,
        pendingInquiries,
        revenue,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get stats",
    });
  }
};

// Get all users
export const getAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page,
      req.query.limit,
      15,
      100,
    );

    const total = await User.countDocuments();
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Transform _id to id for frontend
    const transformedUsers = users.map((user) => ({
      ...user,
      id: user._id.toString(),
    }));

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: transformedUsers,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get users",
    });
  }
};

// Get all venues
export const getAllVenues = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
      20,
      100,
    );

    // Using the service method matching the new signature
    const result = await getAllVenuesService({}, page, limit);

    res.status(200).json({
      success: true,
      message: "All venues retrieved successfully",
      data: result.venues,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch venues",
    });
  }
};

export const getAllBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page,
      req.query.limit,
      20,
      100,
    );

    const total = await Booking.countDocuments();
    const bookings = await Booking.find()
      .populate("userId venueId coachId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const toId = (value: unknown): string => {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        const candidate = value as { _id?: unknown; id?: unknown };
        if (typeof candidate.id === "string") return candidate.id;
        if (
          candidate._id &&
          typeof (candidate._id as { toString?: () => string }).toString ===
            "function"
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
        const objectValue = value as {
          toObject?: () => Record<string, unknown>;
        };
        const plain =
          typeof objectValue.toObject === "function"
            ? objectValue.toObject()
            : (value as Record<string, unknown>);

        return {
          ...plain,
          id: toId(value),
        };
      }

      return value;
    };

    const transformedBookings = bookings.map((booking) => {
      const plain =
        typeof (booking as { toObject?: () => Record<string, unknown> })
          .toObject === "function"
          ? (booking as { toObject: () => Record<string, unknown> }).toObject()
          : (booking as unknown as Record<string, unknown>);

      const playerRecord =
        plain.userId && typeof plain.userId === "object"
          ? (plain.userId as { name?: string; email?: string })
          : null;
      const venueRecord =
        plain.venueId && typeof plain.venueId === "object"
          ? (plain.venueId as { name?: string })
          : null;

      return {
        ...plain,
        id: toId(booking),
        userId: toId(plain.userId),
        venueId: normalizeEntity(plain.venueId),
        coachId: normalizeEntity(plain.coachId),
        playerName: playerRecord?.name || playerRecord?.email || "",
        venueName: venueRecord?.name || "",
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};
