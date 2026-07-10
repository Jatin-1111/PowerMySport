import bcrypt from "bcryptjs";
import type { VenueInquiry, VenueInquiryStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import { sendCredentialsEmail } from "../../utils/email";

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
): Promise<VenueInquiry> => {
  // Check if inquiry already exists for this phone
  const existingInquiry = await prisma.venueInquiry.findFirst({
    where: { phone: data.phone, status: "PENDING" },
  });

  if (existingInquiry) {
    throw new Error(
      "An inquiry with this phone number is already pending review. Please wait for our team to contact you.",
    );
  }

  return prisma.venueInquiry.create({ data });
};

export const getAllInquiries = async (
  status?: string,
): Promise<VenueInquiry[]> => {
  return prisma.venueInquiry.findMany({
    where: status ? { status: status as VenueInquiryStatus } : {},
    orderBy: { createdAt: "desc" },
  });
};

export const getInquiryById = async (
  inquiryId: string,
): Promise<VenueInquiry | null> => {
  return prisma.venueInquiry.findUnique({ where: { id: inquiryId } });
};

export const reviewInquiry = async (
  inquiryId: string,
  reviewData: ReviewInquiryPayload,
): Promise<{
  inquiry: VenueInquiry;
  credentials?: { email: string; password: string };
}> => {
  const existing = await prisma.venueInquiry.findUnique({
    where: { id: inquiryId },
  });

  if (!existing) {
    throw new Error("Inquiry not found");
  }

  if (existing.status !== "PENDING") {
    throw new Error("This inquiry has already been reviewed");
  }

  const inquiry = await prisma.venueInquiry.update({
    where: { id: inquiryId },
    data: {
      status: reviewData.status,
      reviewedBy: reviewData.reviewedBy,
      reviewedAt: new Date(),
      ...(reviewData.reviewNotes ? { reviewNotes: reviewData.reviewNotes } : {}),
    },
  });

  // If approved, create venue lister account
  if (reviewData.status === "APPROVED") {
    // Generate email from phone number
    const generatedEmail = `venue_${inquiry.phone.replace(/\s+/g, "")}@powermysport.com`;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: generatedEmail }, { phone: inquiry.phone }] },
    });

    if (existingUser) {
      throw new Error("User with this phone number already exists");
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + "!A1";

    // Hash the password here — the Mongo pre-save hook that used to do this is
    // gone under Prisma (bcrypt, 12 salt rounds, matching the old User model).
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create venue lister account.
    // NOTE(prisma): the old Mongo User carried an embedded `venueListerProfile`
    // (businessDetails / payoutInfo / canAddMoreVenues); that sub-document has
    // no column in the Postgres User model, so it is dropped here.
    // TODO(prisma): if venue-lister business details must persist, model them
    // as a dedicated table and write them in this flow.
    const savedUser = await prisma.user.create({
      data: {
        name: inquiry.ownerName,
        email: generatedEmail,
        phone: inquiry.phone,
        password: hashedPassword,
        role: "VenueLister",
        userType: "VenueLister",
      },
    });

    // Create the first venue automatically. GeoJSON Point -> lng/lat columns;
    // default 0,0 (user must update).
    await prisma.venue.create({
      data: {
        name: inquiry.venueName,
        ownerId: savedUser.id,
        ownerName: inquiry.ownerName,
        ownerEmail: generatedEmail,
        ownerPhone: inquiry.phone,
        lng: 0,
        lat: 0,
        sports: inquiry.sports.split(",").map((s) => s.trim()),
        amenities: [],
        address: inquiry.address,
        description: inquiry.message || "",
        pricePerHour: 0, // Default price - user must update
      },
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
  const inquiry = await prisma.venueInquiry.findUnique({
    where: { id: inquiryId },
  });

  if (!inquiry) {
    throw new Error("Inquiry not found");
  }

  await prisma.venueInquiry.delete({ where: { id: inquiryId } });
};
