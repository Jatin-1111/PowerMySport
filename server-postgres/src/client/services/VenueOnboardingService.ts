import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { VenueApprovalStatus, VenueDocumentType } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  IOnboardingUploadUrl,
  IPendingVenue,
  IVenueOnboardingStep1,
  IVenueOnboardingStep2,
  IVenueOnboardingStep3,
  IVenueOnboardingStep4,
  OpeningHours,
} from "../../types/index";
import { sendEmail } from "../../utils/email";
import { s3Service } from "../../shared/services/S3Service";
import { NotificationService } from "./NotificationService";

/**
 * VenueOnboardingService
 *
 * Handles the complete 4-step venue onboarding process:
 * 1. Venue lister contact info (name, email, phone)
 * 2. Venue details (name, location, sports, price, etc.)
 * 3. Venue images (5-20 images with cover photo)
 * 4. Required documents (ownership, registration, tax, insurance, certificates)
 */

// Children hydrated alongside a venue (previously embedded sub-documents /
// object-maps). Reads that need the children pass this to `include`.
const venueInclude = {
  sportPricing: true,
  sportImages: true,
  openingHours: true,
  documents: true,
  payoutMethods: true,
} as const;

// The Mongoose `VenueDocument` instance type is gone. Alias it to the Prisma
// Venue row hydrated with its normalized children so the exported signatures
// stay identical for callers.
type VenueDocument = Prisma.VenueGetPayload<{ include: typeof venueInclude }>;

// bcrypt work factor — matches AuthService. Was a Mongoose pre-save hook on the
// User model; relocated here per PORTING_GUIDE §3 so the tempPassword is hashed
// explicitly before `prisma.user.create`.
const BCRYPT_ROUNDS = 12;
const hashPassword = async (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

// Ordered week; VenueOpeningHour is one row per day (slots kept as Json).
const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

// Convert an OpeningHours object-map into nested `create` rows for the
// VenueOpeningHour child table (one row per day, slots as a Json array).
const buildOpeningHourRows = (
  hours: OpeningHours,
): Prisma.VenueOpeningHourCreateWithoutVenueInput[] =>
  WEEK_DAYS.map((day) => {
    const d = hours[day];
    return {
      day,
      isOpen: d?.isOpen ?? true,
      openTime: d?.openTime ?? "09:00",
      closeTime: d?.closeTime ?? "21:00",
      slots: (d?.slots ?? []) as Prisma.InputJsonValue,
    };
  });

// File upload constraints
export const UPLOAD_CONSTRAINTS = {
  IMAGES: {
    MAX_COUNT: 20,
    MIN_COUNT: 5,
    MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"],
  },
  DOCUMENTS: {
    MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ["application/pdf", "image/jpeg", "image/png"],
  },
};

/**
 * Step 1: Create venue with contact info (venue lister details)
 * REFACTORED: Now accepts owner contact info, creates minimal venue record
 */
export const startVenueOnboarding = async (
  payload: IVenueOnboardingStep1,
): Promise<VenueDocument> => {
  // Check if venue lister already submitted with this email
  const existingVenue = await prisma.venue.findFirst({
    where: {
      ownerEmail: payload.ownerEmail,
      approvalStatus: { in: ["PENDING", "REVIEW"] },
    },
  });

  if (existingVenue) {
    throw new Error(
      "You already have a pending venue approval. Complete or cancel it first.",
    );
  }

  // Create minimal venue record with only contact info
  // Venue details will be filled in Step 2
  // GeoJSON location.coordinates [0, 0] -> lng/lat columns.
  const venue = await prisma.venue.create({
    data: {
      ownerName: payload.ownerName,
      ownerEmail: payload.ownerEmail,
      ownerPhone: payload.ownerPhone,
      // Placeholder values (will be updated in Step 2)
      name: "Pending Name",
      lng: 0,
      lat: 0,
      approvalStatus: "PENDING",
      sports: [],
      pricePerHour: 0,
      amenities: [],
      address: "",
      description: "",
      allowExternalCoaches: true,
      openingHours: {
        create: WEEK_DAYS.map((day) => ({
          day,
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [
            { startTime: "09:00", endTime: "21:00" },
          ] as Prisma.InputJsonValue,
        })),
      },
    },
    include: venueInclude,
  });

  return venue;
};

/**
 * Step 2: Update venue with detailed information
 * NOW Step 2: Venue details (name, location, sports, amenities, etc.)
 * PREVIOUSLY this was Step 1
 */
export const updateVenueDetails = async (
  payload: IVenueOnboardingStep2,
): Promise<VenueDocument> => {
  const existing = await prisma.venue.findUnique({
    where: { id: payload.venueId },
  });
  if (!existing) {
    throw new Error("Venue not found");
  }

  // Update venue details. GeoJSON location.coordinates -> lng/lat; sportPricing
  // object-map and openingHours object-map become child tables (replace in full).
  const venue = await prisma.venue.update({
    where: { id: payload.venueId },
    data: {
      name: payload.name,
      lng: payload.location?.coordinates?.[0] ?? null,
      lat: payload.location?.coordinates?.[1] ?? null,
      sports: payload.sports,
      pricePerHour: payload.pricePerHour,
      amenities: payload.amenities,
      address: payload.address,
      description: payload.description,
      allowExternalCoaches: payload.allowExternalCoaches,
      sportPricing: {
        deleteMany: {},
        create: Object.entries(payload.sportPricing || {}).map(
          ([sport, price]) => ({ sport, price }),
        ),
      },
      openingHours: {
        deleteMany: {},
        create: buildOpeningHourRows(payload.openingHours),
      },
    },
    include: venueInclude,
  });

  return venue;
};

/**
 * Step 2A: Get presigned URLs for image uploads (NOW Step 3)
 * Returns URLs for general venue images (3) and sport-specific images (5 per sport)
 */
export const getImageUploadPresignedUrls = async (
  venueId: string,
  sports: string[], // Array of selected sports
): Promise<IOnboardingUploadUrl[]> => {
  // Verify venue exists
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw new Error("Venue not found");
  }

  // Validate sports
  if (!sports || sports.length === 0) {
    throw new Error("At least one sport must be selected");
  }

  const urls: IOnboardingUploadUrl[] = [];

  // Generate 3 presigned URLs for general venue images
  for (let i = 0; i < 3; i++) {
    const uploadResponse = await s3Service.generateImageUploadUrl(
      `general_${i}.jpg`,
      "image/jpeg",
      venueId,
      i === 0, // First general image is the default cover photo
    );

    urls.push({
      field: `general_${i}`,
      uploadUrl: uploadResponse.uploadUrl,
      downloadUrl: uploadResponse.downloadUrl,
      s3Key: uploadResponse.key,
      fileName: uploadResponse.fileName,
      contentType: "image/jpeg",
      maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.MAX_SIZE_BYTES,
    });
  }

  // Sort sports alphabetically as per user requirement
  const sortedSports = [...sports].sort();

  // Generate 5 presigned URLs for each sport
  for (const sport of sortedSports) {
    for (let i = 0; i < 5; i++) {
      const uploadResponse = await s3Service.generateImageUploadUrl(
        `sport_${sport.toLowerCase().replace(/\s+/g, "_")}_${i}.jpg`,
        "image/jpeg",
        venueId,
        false, // Sport images cannot be cover photos
      );

      urls.push({
        field: `sport_${sport}_${i}`,
        uploadUrl: uploadResponse.uploadUrl,
        downloadUrl: uploadResponse.downloadUrl,
        s3Key: uploadResponse.key,
        fileName: uploadResponse.fileName,
        contentType: "image/jpeg",
        maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.MAX_SIZE_BYTES,
      });
    }
  }

  return urls;
};

/**
 * Step 3: Confirm images and set cover photo
 * Supports both legacy (flat array) and new (sport-specific) image structures
 */
export const confirmVenueImages = async (
  payload: IVenueOnboardingStep3,
): Promise<VenueDocument | null> => {
  // Handle new sport-specific structure
  if (payload.generalImages && payload.sportImages) {
    // Validate general images count
    if (payload.generalImages.length !== 3) {
      throw new Error("Exactly 3 general venue images are required");
    }

    // Validate sport images count (5 per sport)
    for (const [sport, images] of Object.entries(payload.sportImages)) {
      if (images.length !== 5) {
        throw new Error(`Exactly 5 images required for ${sport}`);
      }
    }

    const existing = await prisma.venue.findUnique({
      where: { id: payload.venueId },
    });
    if (!existing) {
      throw new Error("Venue not found");
    }

    // Update venue with categorized images. sportImages/sportImageKeys are now
    // the VenueSportImage child table (one row per sport); generalImages/
    // generalImageKeys remain scalar String[] columns on the venue.
    const venue = await prisma.venue.update({
      where: { id: payload.venueId },
      data: {
        generalImages: payload.generalImages,
        generalImageKeys: payload.generalImageKeys ?? [],
        coverPhotoUrl: payload.coverPhotoUrl,
        coverPhotoKey: payload.coverPhotoKey,
        sportImages: {
          deleteMany: {},
          create: Object.entries(payload.sportImages).map(
            ([sport, images]) => ({
              sport,
              images,
              imageKeys: payload.sportImageKeys?.[sport] ?? [],
            }),
          ),
        },
      },
      include: venueInclude,
    });

    return venue;
  }

  // Handle legacy structure (backward compatibility)
  if (payload.images && payload.images.length > 0) {
    if (payload.images.length < UPLOAD_CONSTRAINTS.IMAGES.MIN_COUNT) {
      throw new Error(
        `Minimum ${UPLOAD_CONSTRAINTS.IMAGES.MIN_COUNT} images required`,
      );
    }
    if (payload.images.length > UPLOAD_CONSTRAINTS.IMAGES.MAX_COUNT) {
      throw new Error(
        `Maximum ${UPLOAD_CONSTRAINTS.IMAGES.MAX_COUNT} images allowed`,
      );
    }

    const existing = await prisma.venue.findUnique({
      where: { id: payload.venueId },
    });
    if (!existing) {
      throw new Error("Venue not found");
    }

    const venue = await prisma.venue.update({
      where: { id: payload.venueId },
      data: {
        images: payload.images,
        imageKeys: payload.imageKeys,
        coverPhotoUrl: payload.coverPhotoUrl,
        coverPhotoKey: payload.coverPhotoKey,
      },
      include: venueInclude,
    });

    return venue;
  }

  throw new Error("No images provided");
};

/**
 * Step 3: Get presigned URLs for document uploads
 */
export const getDocumentUploadPresignedUrls = async (
  venueId: string,
  documents: Array<{ type: string; fileName: string; contentType: string }>,
): Promise<IOnboardingUploadUrl[]> => {
  // Verify venue exists
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw new Error("Venue not found");
  }

  // Validate document count (must have at least one, can have multiple per type)
  if (documents.length === 0) {
    throw new Error("At least one document is required");
  }

  const urls: IOnboardingUploadUrl[] = [];

  // Generate presigned URLs for each document
  for (const doc of documents) {
    const uploadResponse = await s3Service.generateDocumentUploadUrl(
      doc.fileName,
      doc.contentType,
      doc.type as
        | "OWNERSHIP_PROOF"
        | "BUSINESS_REGISTRATION"
        | "TAX_DOCUMENT"
        | "INSURANCE"
        | "CERTIFICATE",
      venueId,
    );

    urls.push({
      field: `document_${doc.type}`,
      uploadUrl: uploadResponse.uploadUrl,
      downloadUrl: uploadResponse.downloadUrl,
      s3Key: uploadResponse.key, // Store S3 key for regenerating URLs later
      fileName: uploadResponse.fileName,
      contentType: doc.contentType,
      maxSizeBytes: UPLOAD_CONSTRAINTS.DOCUMENTS.MAX_SIZE_BYTES,
    });
  }

  return urls;
};

/**
 * Step 4: Finalize venue onboarding with images and documents
 * Saves final images and documents, marks venue ready for admin approval
 */
export const finalizeVenueOnboarding = async (
  payload: IVenueOnboardingStep4,
): Promise<VenueDocument | null> => {
  // Validate images
  if (!payload.images || payload.images.length < 5) {
    throw new Error("Minimum 5 images required");
  }
  if (payload.images.length > 20) {
    throw new Error("Maximum 20 images allowed");
  }

  // Validate documents
  if (!payload.documents || payload.documents.length === 0) {
    throw new Error("At least one document is required");
  }

  const existing = await prisma.venue.findUnique({
    where: { id: payload.venueId },
  });
  if (!existing) {
    throw new Error("Venue not found");
  }

  // Transform documents into VenueDocument child rows (was an embedded array).
  const documentsToCreate: Prisma.VenueDocumentCreateWithoutVenueInput[] =
    payload.documents.map((doc: (typeof payload.documents)[number]) => ({
      type: doc.type as VenueDocumentType,
      url: doc.url,
      ...(doc.s3Key !== undefined && { s3Key: doc.s3Key }), // Only include s3Key if defined
      fileName: doc.fileName,
      uploadedAt: new Date(),
    }));

  // Update venue with images, cover photo, and documents
  const venue = await prisma.venue.update({
    where: { id: payload.venueId },
    data: {
      images: payload.images, // URLs (will be regenerated on fetch)
      imageKeys: payload.imageKeys, // S3 keys for regeneration
      coverPhotoUrl: payload.coverPhotoUrl, // URL (will be regenerated on fetch)
      coverPhotoKey: payload.coverPhotoKey, // S3 key for regeneration
      documents: {
        deleteMany: {},
        create: documentsToCreate,
      },
      approvalStatus: "PENDING", // Ready for admin review
    },
    include: venueInclude,
  });

  return venue;
};

/**
 * Get all pending venues (for admin panel)
 * Returns venues waiting for approval with owner details
 */
export const getPendingVenues = async (
  page: number = 1,
  limit: number = 20,
  approvalStatus?: "PENDING" | "REVIEW" | "REJECTED",
): Promise<{
  venues: IPendingVenue[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const where: Prisma.VenueWhereInput = approvalStatus
    ? { approvalStatus }
    : { approvalStatus: { not: "APPROVED" } };

  const skip = (page - 1) * limit;
  const total = await prisma.venue.count({ where });

  const venues = await prisma.venue.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  // Resolve owner email/phone in a second query (was `.populate("ownerId", ...)`;
  // ownerId is a plain String FK with no Prisma relation defined).
  const ownerIds = [
    ...new Set(venues.map((v) => v.ownerId).filter(Boolean) as string[]),
  ];
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, email: true, phone: true },
      })
    : [];
  const ownerById = new Map(owners.map((u) => [u.id, u]));

  return {
    venues: venues.map((v) => {
      const owner = v.ownerId ? ownerById.get(v.ownerId) : undefined;
      return {
        id: v.id || "",
        name: v.name,
        ownerEmail: v.ownerEmail || owner?.email || "",
        ownerPhone: v.ownerPhone || owner?.phone || "",
        sports: v.sports,
        approvalStatus: v.approvalStatus as "PENDING" | "REVIEW" | "REJECTED",
        submittedAt: v.createdAt,
        lastReviewedAt: v.updatedAt,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get venue onboarding details (for admin review)
 * Returns full venue info with all documents and images
 */
export const getVenueOnboardingDetails = async (
  venueId: string,
): Promise<VenueDocument | null> => {
  // TODO(prisma): the old `.populate("ownerId", "name email phone")` no longer
  // runs inline (ownerId is a String FK). Resolve the owner User in the caller
  // if it needs owner name/email/phone alongside the venue.
  return prisma.venue.findUnique({
    where: { id: venueId },
    include: venueInclude,
  });
};

/**
 * Admin: Approve venue
 * Creates user account for venue lister and links venue to that user
 * Updates approval status to APPROVED and sends credentials to venue lister
 */
export const approveVenue = async (
  venueId: string,
): Promise<VenueDocument | null> => {
  const existing = await prisma.venue.findUnique({ where: { id: venueId } });

  if (!existing) {
    throw new Error("Venue not found");
  }

  // Check if user already exists for this venue owner
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email: existing.ownerEmail }, { phone: existing.ownerPhone }],
    },
  });

  let tempPassword: string | undefined;
  let isNewUser = false;

  // If user doesn't exist, create a new VenueLister account
  if (!user) {
    // Generate temporary password
    tempPassword = Math.random().toString(36).slice(-8) + "!A1";
    isNewUser = true;

    // TODO(prisma): the Mongo model stored an embedded `venueListerProfile`
    // (businessDetails / payoutInfo / canAddMoreVenues). The Postgres User has
    // no column for it — persist that profile in a dedicated table/Json column
    // if the venue-lister dashboard still needs it. Password is now hashed here
    // (was a User pre-save hook) per PORTING_GUIDE §3.
    user = await prisma.user.create({
      data: {
        name: existing.ownerName,
        email: existing.ownerEmail,
        phone: existing.ownerPhone,
        password: await hashPassword(tempPassword),
        role: "VenueLister",
      },
    });
  }

  // Link venue to user account, mark APPROVED, and clear rejection/review fields.
  const venue = await prisma.venue.update({
    where: { id: venueId },
    data: {
      ownerId: user.id,
      approvalStatus: "APPROVED",
      ...(existing.rejectionReason ? { rejectionReason: "" } : {}),
      ...(existing.reviewNotes ? { reviewNotes: "" } : {}),
    },
    include: venueInclude,
  });

  // Send approval email with credentials (if new user)
  try {
    const credentialsSection =
      isNewUser && tempPassword
        ? `
          <div class="info-box" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
            <strong>🔐 Your Login Credentials:</strong>
            <p><strong>Email:</strong> ${venue.ownerEmail}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p><em>Please login and change your password immediately for security.</em></p>
          </div>
        `
        : "";

    const approvalEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: #ecfdf5;
            border-left: 4px solid #10b981;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .venue-details {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #e5e7eb;
          }
          .venue-details h3 {
            margin-top: 0;
            color: #059669;
          }
          .cta-button {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Congratulations!</h1>
          <p>Your venue has been approved!</p>
        </div>
        <div class="content">
          <p>Hi ${venue.ownerName},</p>

          <p>We're thrilled to inform you that your venue <strong>"${venue.name}"</strong> has been approved and is now live on PowerMySport!</p>

          ${credentialsSection}

          <div class="venue-details">
            <h3>Approved Venue Details:</h3>
            <p><strong>Venue Name:</strong> ${venue.name}</p>
            <p><strong>Address:</strong> ${venue.address}</p>
            <p><strong>Price per Hour:</strong> ₹${venue.pricePerHour}</p>
            <p><strong>Contact Phone:</strong> ${venue.ownerPhone}</p>
          </div>

          <div class="info-box">
            <strong>📍 What's Next?</strong>
            <p>Your venue is now available for coaches and players to book. You can manage bookings and venue details from your vendor dashboard.</p>
          </div>

          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || "https://powermysport.com"}/login" class="cta-button">
              ${isNewUser ? "Login Now →" : "Go to Your Dashboard →"}
            </a>
          </p>

          <div class="info-box">
            <strong>📞 Need Help?</strong>
            <p>If you have any questions, feel free to contact our support team at teams@powermysport.com</p>
          </div>

          <p>Best regards,<br/><strong>PowerMySport Team</strong></p>

          <div class="footer">
            <p>You received this email because your venue was approved on PowerMySport. © 2024 PowerMySport. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: venue.ownerEmail,
      subject: `🎉 Your Venue "${venue.name}" Has Been Approved!`,
      html: approvalEmailHtml,
    });

    console.log(`✅ Approval email sent to ${venue.ownerEmail}`);

    // Send in-app notification to venue owner
    if (user?.id) {
      NotificationService.send({
        userId: user.id.toString(),
        type: "VENUE_APPROVAL_APPROVED",
        title: "Venue Approved",
        message: `Congratulations! Your venue "${venue.name}" has been approved.`,
        data: {
          venueId: venue.id.toString(),
          venueName: venue.name,
          approvedAt: new Date().toISOString(),
          isNewUser,
          ...(isNewUser && tempPassword ? { hasCredentials: true } : {}),
        },
      }).catch((err: Error) =>
        console.error("Failed to send venue approval notification:", err),
      );
    }
  } catch (error) {
    console.error("❌ Failed to send approval email:", error);
    // Don't throw - approval was successful, just email failed
  }

  return venue;
};

/**
 * Admin: Reject venue
 * Updates approval status to REJECTED with reason
 */
export const rejectVenue = async (
  venueId: string,
  reason: string,
): Promise<VenueDocument | null> => {
  const existing = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!existing) {
    throw new Error("Venue not found");
  }

  const venue = await prisma.venue.update({
    where: { id: venueId },
    data: {
      approvalStatus: "REJECTED",
      rejectionReason: reason,
    },
    include: venueInclude,
  });

  // Send in-app notification to venue owner (if linked to a user account)
  if (venue.ownerId) {
    NotificationService.send({
      userId: venue.ownerId.toString(),
      type: "VENUE_APPROVAL_REJECTED",
      title: "Venue Rejected",
      message: `Your venue "${venue.name}" submission has been rejected.`,
      data: {
        venueId: venue.id.toString(),
        venueName: venue.name,
        reason: reason,
        rejectedAt: new Date().toISOString(),
      },
    }).catch((err: Error) =>
      console.error("Failed to send venue rejection notification:", err),
    );
  }

  // Send rejection email to venue owner
  try {
    const ownerEmail =
      venue.ownerEmail ||
      (venue.ownerId
        ? (await prisma.user.findUnique({ where: { id: venue.ownerId } }))
            ?.email
        : undefined);

    if (ownerEmail) {
      const rejectionEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
            .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Venue Application Update</h1>
            <p>Your submission requires attention</p>
          </div>
          <div class="content">
            <p>Hi ${venue.ownerName},</p>
            <p>Thank you for submitting your venue <strong>"${venue.name}"</strong> on PowerMySport. After careful review, we were unable to approve your application at this time.</p>
            <div class="reason-box">
              <strong>❌ Reason for Rejection:</strong>
              <p>${reason}</p>
            </div>
            <div class="info-box">
              <strong>💡 What you can do:</strong>
              <p>You are welcome to address the concerns mentioned above and re-submit your venue application. Our team is here to help you get listed successfully.</p>
            </div>
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "https://powermysport.com"}/list-your-venue" class="cta-button">Re-apply Now →</a>
            </p>
            <div class="info-box">
              <strong>📞 Need Help?</strong>
              <p>If you have questions about this decision, please contact our support team at teams@powermysport.com</p>
            </div>
            <p>Best regards,<br/><strong>PowerMySport Team</strong></p>
            <div class="footer">
              <p>You received this email because you submitted a venue application on PowerMySport. © 2024 PowerMySport. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: ownerEmail,
        subject: `Update on Your Venue Application — "${venue.name}"`,
        html: rejectionEmailHtml,
      });

      console.log(`✅ Rejection email sent to ${ownerEmail}`);
    }
  } catch (emailError) {
    console.error("❌ Failed to send venue rejection email:", emailError);
    // Don't throw — rejection status was already saved
  }

  return venue;
};

/**
 * Admin: Mark venue for review
 * Updates approval status to REVIEW with optional notes
 */
export const markVenueForReview = async (
  venueId: string,
  notes?: string,
): Promise<VenueDocument | null> => {
  const existing = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!existing) {
    throw new Error("Venue not found");
  }

  const venue = await prisma.venue.update({
    where: { id: venueId },
    data: {
      approvalStatus: "REVIEW",
      reviewNotes: notes ?? null,
    },
    include: venueInclude,
  });

  // Send in-app notification to venue owner (if linked to a user account)
  if (venue.ownerId) {
    NotificationService.send({
      userId: venue.ownerId.toString(),
      type: "VENUE_MARKED_FOR_REVIEW",
      title: "Venue Under Review",
      message: `Your venue "${venue.name}" is being reviewed by our team.`,
      data: {
        venueId: venue.id.toString(),
        venueName: venue.name,
        notes: notes || "",
        reviewStartedAt: new Date().toISOString(),
      },
    }).catch((err: Error) =>
      console.error("Failed to send venue review notification:", err),
    );
  }

  // Send review notification email to venue owner
  try {
    const ownerEmail =
      venue.ownerEmail ||
      (venue.ownerId
        ? (await prisma.user.findUnique({ where: { id: venue.ownerId } }))
            ?.email
        : undefined);

    if (ownerEmail) {
      const reviewEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
            .notes-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .info-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔍 Venue Under Review</h1>
            <p>We're looking at your submission</p>
          </div>
          <div class="content">
            <p>Hi ${venue.ownerName},</p>
            <p>Your venue <strong>"${venue.name}"</strong> is currently under active review by our team. We'll get back to you shortly with a decision.</p>
            ${
              notes
                ? `
            <div class="notes-box">
              <strong>📋 Reviewer Notes:</strong>
              <p>${notes}</p>
            </div>`
                : ""
            }
            <div class="info-box">
              <strong>⏱️ What happens next?</strong>
              <p>Our review team will carefully evaluate all submitted documents and images. This process typically takes 2-3 business days. You will receive an email once a decision has been made.</p>
            </div>
            <div class="info-box">
              <strong>📞 Need Help?</strong>
              <p>If you have questions or want to provide additional information, contact us at teams@powermysport.com</p>
            </div>
            <p>Best regards,<br/><strong>PowerMySport Team</strong></p>
            <div class="footer">
              <p>You received this email because your venue application is under review on PowerMySport. © 2024 PowerMySport. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: ownerEmail,
        subject: `Your Venue "${venue.name}" Is Under Review`,
        html: reviewEmailHtml,
      });

      console.log(`✅ Review notification email sent to ${ownerEmail}`);
    }
  } catch (emailError) {
    console.error(
      "❌ Failed to send venue review notification email:",
      emailError,
    );
    // Don't throw — review status was already saved
  }

  return venue;
};

/**
 * Check if venue onboarding is complete
 * Returns true if all steps are done and venue is approved
 */
export const isVenueOnboardingComplete = (venue: VenueDocument): boolean => {
  return !!(
    venue.name &&
    venue.images?.length >= UPLOAD_CONSTRAINTS.IMAGES.MIN_COUNT &&
    venue.coverPhotoUrl &&
    venue.documents?.length > 0 &&
    venue.approvalStatus === "APPROVED"
  );
};

/**
 * Delete venue (for canceling onboarding)
 * Only allowed if venue is not approved
 */
export const deleteVenueOnboarding = async (
  venueId: string,
  ownerId: string,
): Promise<void> => {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { documents: true },
  });

  if (!venue || !venue.ownerId) {
    throw new Error("Venue not found");
  }

  // Only allow deletion by owner or admin
  if (venue.ownerId.toString() !== ownerId) {
    throw new Error("Unauthorized: You can only delete your own venues");
  }

  // Don't allow deletion of approved venues
  if (venue.approvalStatus === "APPROVED") {
    throw new Error(
      "Cannot delete approved venues. Contact admin for assistance.",
    );
  }

  // Delete associated files from S3
  const docKeys = venue.documents.map((doc: any) => {
    // Extract S3 key from URL if needed
    return doc.url;
  });

  if (docKeys.length > 0) {
    await s3Service.deleteFiles(docKeys, "documents");
  }

  if (venue.images.length > 0) {
    await s3Service.deleteFiles(venue.images, "images");
  }

  // Delete venue (normalized children cascade via onDelete: Cascade)
  await prisma.venue.delete({ where: { id: venueId } });
};
