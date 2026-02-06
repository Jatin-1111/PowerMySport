import { Request, Response } from "express";
import { Booking } from "../models/Booking";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import VenueInquiry from "../models/VenueInquiry";
import { getAllVenues } from "../services/VenueService";

// Get platform statistics
export const getPlatformStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [totalUsers, totalVenues, totalBookings, pendingInquiries, bookings] =
      await Promise.all([
        User.countDocuments(),
        Venue.countDocuments(),
        Booking.countDocuments(),
        VenueInquiry.countDocuments({ status: "PENDING" }),
        Booking.find({ status: "CONFIRMED" }),
      ]);

    // Calculate total revenue from confirmed bookings
    const revenue = bookings.reduce(
      (sum: number, booking: any) => sum + booking.totalAmount,
      0,
    );

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
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    // Transform _id to id for frontend
    const transformedUsers = users.map((user) => ({
      ...user.toObject(),
      id: user._id.toString(),
    }));

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: transformedUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get users",
    });
  }
};

// Get all venues
export const getAllVenuesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "20", 10);
    
    // Using the service method matching the new signature
    const result = await getAllVenues({}, page, limit);

    res.status(200).json({
      success: true,
      message: "All venues retrieved successfully",
      data: result.venues,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch venues",
    });
  }
};

export const getAllBookingsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Assuming we need a service method for ALL bookings (admin view)
    // Currently BookingService doesn't have a distinct "getAllBookings" for admin, 
    // it has getUserBookings, getVenueBookings. 
    // But statsController probably used Booking.find({}) directly or similar.
    // Let's check the original content again. 
    // Ah, previous code was: const bookings = await Booking.find().populate(...);
    // I should use pagination here.
    
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "20", 10);
    const skip = (page - 1) * limit;

    const total = await Booking.countDocuments();
    const bookings = await Booking.find()
      .populate("userId venueId coachId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: "All bookings retrieved successfully",
      data: bookings,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};
