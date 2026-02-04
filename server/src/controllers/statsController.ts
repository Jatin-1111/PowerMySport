import { Request, Response } from "express";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { Booking } from "../models/Booking";
import VenueInquiry from "../models/VenueInquiry";

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
export const getAllVenues = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const venues = await Venue.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Venues retrieved successfully",
      data: venues,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get venues",
    });
  }
};

// Get all bookings
export const getAllBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get bookings",
    });
  }
};
