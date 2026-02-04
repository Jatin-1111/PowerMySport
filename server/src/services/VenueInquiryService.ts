import VenueInquiry, { IVenueInquiry } from "../models/VenueInquiry";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { generateToken } from "../utils/jwt";
import bcrypt from "bcryptjs";

interface CreateInquiryPayload {
  venueName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  sports: string;
  facilities?: string;
  message?: string;
}

interface ReviewInquiryPayload {
  status: "APPROVED" | "REJECTED";
  reviewNotes?: string;
  reviewedBy: string;
}

export const createVenueInquiry = async (
  data: CreateInquiryPayload,
): Promise<IVenueInquiry> => {
  // Check if inquiry already exists for this email
  const existingInquiry = await VenueInquiry.findOne({
    email: data.email,
    status: "PENDING",
  });

  if (existingInquiry) {
    throw new Error(
      "An inquiry with this email is already pending review. Please wait for our team to contact you.",
    );
  }

  const inquiry = new VenueInquiry(data);
  await inquiry.save();
  return inquiry;
};

export const getAllInquiries = async (
  status?: string,
): Promise<IVenueInquiry[]> => {
  const filter = status ? { status } : {};
  return await VenueInquiry.find(filter).sort({ createdAt: -1 });
};

export const getInquiryById = async (
  inquiryId: string,
): Promise<IVenueInquiry | null> => {
  return await VenueInquiry.findById(inquiryId);
};

export const reviewInquiry = async (
  inquiryId: string,
  reviewData: ReviewInquiryPayload,
): Promise<{
  inquiry: IVenueInquiry;
  credentials?: { email: string; password: string };
}> => {
  const inquiry = await VenueInquiry.findById(inquiryId);

  if (!inquiry) {
    throw new Error("Inquiry not found");
  }

  if (inquiry.status !== "PENDING") {
    throw new Error("This inquiry has already been reviewed");
  }

  inquiry.status = reviewData.status;
  inquiry.reviewedBy = reviewData.reviewedBy as any;
  inquiry.reviewedAt = new Date();
  if (reviewData.reviewNotes) {
    inquiry.reviewNotes = reviewData.reviewNotes;
  }

  await inquiry.save();

  // If approved, create venue lister account
  if (reviewData.status === "APPROVED") {
    // Check if user already exists
    const existingUser = await User.findOne({ email: inquiry.email });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + "!A1";

    // Create venue lister account (User model will hash the password)
    const user = new User({
      name: inquiry.ownerName,
      email: inquiry.email,
      phone: inquiry.phone,
      password: tempPassword, // Pass plain password, User model will hash it
      role: "VENUE_LISTER",
    });

    const savedUser = await user.save();

    // Create the first venue automatically
    // Using default coordinates [0,0] as we don't have geo-location yet
    // The user will need to update this later
    const venue = new Venue({
      name: inquiry.venueName,
      ownerId: savedUser._id,
      location: {
        type: "Point",
        coordinates: [0, 0], // Default coordinates
      },
      sports: inquiry.sports.split(",").map((s) => s.trim()), // Assuming comma-separated
      amenities: inquiry.facilities
        ? inquiry.facilities.split(",").map((f) => f.trim())
        : [],
      description: `${inquiry.message || ""} \n\nAddress: ${inquiry.address}, ${inquiry.city}`,
      pricePerHour: 0, // Default price, user must update
      requiresLocationUpdate: true, // Flag to prompt user for update
    });

    await venue.save();

    return {
      inquiry,
      credentials: {
        email: inquiry.email,
        password: tempPassword,
      },
    };
  }

  return { inquiry };
};

export const deleteInquiry = async (inquiryId: string): Promise<void> => {
  const inquiry = await VenueInquiry.findById(inquiryId);

  if (!inquiry) {
    throw new Error("Inquiry not found");
  }

  await inquiry.deleteOne();
};
