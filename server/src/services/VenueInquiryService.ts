import { User } from "../models/User";
import { Venue } from "../models/Venue";
import VenueInquiry, { IVenueInquiry } from "../models/VenueInquiry";
import { sendCredentialsEmail } from "../utils/email";

interface CreateInquiryPayload {
  venueName: string;
  ownerName: string;
  phone: string;
  address: string;
  sports: string;
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
  // Check if inquiry already exists for this phone
  const existingInquiry = await VenueInquiry.findOne({
    phone: data.phone,
    status: "PENDING",
  });

  if (existingInquiry) {
    throw new Error(
      "An inquiry with this phone number is already pending review. Please wait for our team to contact you.",
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
    // Generate email from phone number
    const generatedEmail = `venue_${inquiry.phone.replace(/\s+/g, "")}@powermysport.com`;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: generatedEmail }, { phone: inquiry.phone }],
    });

    if (existingUser) {
      throw new Error("User with this phone number already exists");
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + "!A1";

    // Create venue lister account (User model will hash the password)
    const user = new User({
      name: inquiry.ownerName,
      email: generatedEmail,
      phone: inquiry.phone,
      password: tempPassword, // Pass plain password, User model will hash it
      role: "VENUE_LISTER",
      venueListerProfile: {
        canAddMoreVenues: false, // Restrict to only the approved venue
      },
    });

    const savedUser = await user.save();

    // Create the first venue automatically
    const venue = new Venue({
      name: inquiry.venueName,
      ownerId: savedUser._id,
      location: {
        type: "Point",
        coordinates: [0, 0], // Default coordinates
      },
      sports: inquiry.sports.split(",").map((s) => s.trim()),
      amenities: [],
      address: inquiry.address,
      description: inquiry.message || "",
      pricePerHour: 0, // Default price, user must update
      requiresLocationUpdate: true,
    });



    // Send credentials via email
    try {
      await sendCredentialsEmail({
        name: inquiry.ownerName,
        email: generatedEmail,
        password: tempPassword,
        loginUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
      });
    } catch (error) {
      console.error("Failed to send credentials email:", error);
      // Continue execution, don't fail the approval
    }

    return {
      inquiry,
      credentials: {
        email: generatedEmail,
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
