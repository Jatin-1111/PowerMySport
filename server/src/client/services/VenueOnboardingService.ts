import crypto from "crypto";
import { User } from "../models/User";
import { Venue, VenueDocument } from "../models/Venue";
import {
  IOnboardingUploadUrl,
  IPendingVenue,
  IVenueDocument,
  IVenueOnboardingStep1,
  IVenueOnboardingStep2,
  IVenueOnboardingStep3,
  IVenueOnboardingStep4,
} from "../../types/index";
import { escapeHtml, sendEmail } from "../../utils/email";
import { s3Service } from "../../shared/services/S3Service";
import { NotificationService } from "./NotificationService";
import { log as __rootLog } from "../../utils/logger";
import { AppError } from "../../utils/AppError";
import { requestPasswordReset } from "../../shared/services/AuthService/passwordManagement";
const log = __rootLog.child("venueOnboarding");

/**
 * VenueOnboardingService
 *
 * Handles the complete 4-step venue onboarding process:
 * 1. Venue lister contact info (name, email, phone)
 * 2. Venue details (name, location, sports, price, etc.)
 * 3. Venue images (5-20 images with cover photo)
 * 4. Required documents (ownership, registration, tax, insurance, certificates)
 */

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
  payload: IVenueOnboardingStep1
): Promise<VenueDocument> => {
  // Check if venue lister already submitted with this email
  const existingVenue = await Venue.findOne({
    ownerEmail: payload.ownerEmail,
    approvalStatus: { $in: ["PENDING", "REVIEW"] },
  });

  if (existingVenue) {
    throw new Error("You already have a pending venue approval. Complete or cancel it first.");
  }

  // Create minimal venue record with only contact info
  // Venue details will be filled in Step 2
  const venue = new Venue({
    ownerName: payload.ownerName,
    ownerEmail: payload.ownerEmail,
    ownerPhone: payload.ownerPhone,
    // Placeholder values (will be updated in Step 2)
    name: "Pending Name",
    location: {
      type: "Point",
      coordinates: [0, 0],
    },
    approvalStatus: "PENDING",
    documents: [],
    images: [],
    sports: [],
    pricePerHour: 0,
    amenities: [],
    address: "",
    openingHours: {
      monday: {
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
        slots: [{ startTime: "09:00", endTime: "21:00" }],
      },
      tuesday: {
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
        slots: [{ startTime: "09:00", endTime: "21:00" }],
      },
      wednesday: {
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
        slots: [{ startTime: "09:00", endTime: "21:00" }],
      },
      thursday: {
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
        slots: [{ startTime: "09:00", endTime: "21:00" }],
      },
      friday: {
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
        slots: [{ startTime: "09:00", endTime: "21:00" }],
      },
      saturday: {
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
        slots: [{ startTime: "09:00", endTime: "21:00" }],
      },
      sunday: {
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
        slots: [{ startTime: "09:00", endTime: "21:00" }],
      },
    },
    description: "",
    allowExternalCoaches: true,
  });

  await venue.save();
  return venue;
};

/**
 * Step 2: Update venue with detailed information
 * NOW Step 2: Venue details (name, location, sports, amenities, etc.)
 * PREVIOUSLY this was Step 1
 */
export const updateVenueDetails = async (
  payload: IVenueOnboardingStep2
): Promise<VenueDocument> => {
  const venue = await Venue.findById(payload.venueId);
  if (!venue) {
    throw new Error("Venue not found");
  }
  if (venue.approvalStatus === "APPROVED") {
    throw new AppError("This venue is approved. Edit it from the venue dashboard.", 409);
  }

  // Update venue details
  venue.name = payload.name;
  venue.location = payload.location;
  venue.sports = payload.sports;
  venue.pricePerHour = payload.pricePerHour;
  venue.sportPricing = payload.sportPricing || {};
  venue.amenities = payload.amenities;
  venue.address = payload.address;
  venue.openingHours = payload.openingHours;
  venue.description = payload.description;
  venue.allowExternalCoaches = payload.allowExternalCoaches;

  await venue.save();
  return venue;
};

/**
 * Step 2A: Get presigned URLs for image uploads (NOW Step 3)
 * Returns URLs for general venue images (3) and sport-specific images (5 per sport)
 */
export const getImageUploadPresignedUrls = async (
  venueId: string,
  sports: string[] // Array of selected sports
): Promise<IOnboardingUploadUrl[]> => {
  // Verify venue exists
  const venue = await Venue.findById(venueId);
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
      i === 0 // First general image is the default cover photo
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
        false // Sport images cannot be cover photos
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
  payload: IVenueOnboardingStep3
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

    // Update venue with categorized images
    const venue = await Venue.findByIdAndUpdate(
      payload.venueId,
      {
        generalImages: payload.generalImages,
        generalImageKeys: payload.generalImageKeys,
        sportImages: payload.sportImages,
        sportImageKeys: payload.sportImageKeys,
        coverPhotoUrl: payload.coverPhotoUrl,
        coverPhotoKey: payload.coverPhotoKey,
      },
      { new: true }
    );

    if (!venue) {
      throw new Error("Venue not found");
    }

    return venue;
  }

  // Handle legacy structure (backward compatibility)
  if (payload.images && payload.images.length > 0) {
    if (payload.images.length < UPLOAD_CONSTRAINTS.IMAGES.MIN_COUNT) {
      throw new Error(`Minimum ${UPLOAD_CONSTRAINTS.IMAGES.MIN_COUNT} images required`);
    }
    if (payload.images.length > UPLOAD_CONSTRAINTS.IMAGES.MAX_COUNT) {
      throw new Error(`Maximum ${UPLOAD_CONSTRAINTS.IMAGES.MAX_COUNT} images allowed`);
    }

    const venue = await Venue.findByIdAndUpdate(
      payload.venueId,
      {
        images: payload.images,
        imageKeys: payload.imageKeys,
        coverPhotoUrl: payload.coverPhotoUrl,
        coverPhotoKey: payload.coverPhotoKey,
      },
      { new: true }
    );

    if (!venue) {
      throw new Error("Venue not found");
    }

    return venue;
  }

  throw new Error("No images provided");
};

/**
 * Step 3: Get presigned URLs for document uploads
 */
export const getDocumentUploadPresignedUrls = async (
  venueId: string,
  documents: Array<{ type: string; fileName: string; contentType: string }>
): Promise<IOnboardingUploadUrl[]> => {
  // Verify venue exists
  const venue = await Venue.findById(venueId);
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
        "OWNERSHIP_PROOF" | "BUSINESS_REGISTRATION" | "TAX_DOCUMENT" | "INSURANCE" | "CERTIFICATE",
      venueId
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
  payload: IVenueOnboardingStep4
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

  // Transform documents
  const documentsToSave: IVenueDocument[] = payload.documents.map(
    (doc: (typeof payload.documents)[number]) => ({
      type: doc.type as
        "OWNERSHIP_PROOF" | "BUSINESS_REGISTRATION" | "TAX_DOCUMENT" | "INSURANCE" | "CERTIFICATE",
      url: doc.url,
      ...(doc.s3Key !== undefined && { s3Key: doc.s3Key }), // Only include s3Key if defined
      fileName: doc.fileName,
      uploadedAt: new Date(),
    })
  );

  const existing = await Venue.findById(payload.venueId).select("emailVerified approvalStatus");
  if (!existing) {
    throw new Error("Venue not found");
  }
  if (existing.approvalStatus === "APPROVED") {
    throw new AppError("This venue is already approved", 409);
  }
  if (!existing.emailVerified) {
    throw new AppError("Verify your email address before submitting for review", 403);
  }

  // Update venue with images, cover photo, and documents
  const venue = await Venue.findByIdAndUpdate(
    payload.venueId,
    {
      images: payload.images, // URLs (will be regenerated on fetch)
      imageKeys: payload.imageKeys, // S3 keys for regeneration
      coverPhotoUrl: payload.coverPhotoUrl, // URL (will be regenerated on fetch)
      coverPhotoKey: payload.coverPhotoKey, // S3 key for regeneration
      documents: documentsToSave,
      approvalStatus: "PENDING", // Ready for admin review
    },
    { new: true }
  );

  if (!venue) {
    throw new Error("Venue not found");
  }

  return venue;
};

/**
 * Get all pending venues (for admin panel)
 * Returns venues waiting for approval with owner details
 */
export const getPendingVenues = async (
  page: number = 1,
  limit: number = 20,
  approvalStatus?: "PENDING" | "REVIEW" | "REJECTED"
): Promise<{
  venues: IPendingVenue[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  // A venue exists from step 1, so a draft that never reached document upload
  // is not a submission and does not belong in the review queue.
  const query: any = { approvalStatus: { $ne: "APPROVED" }, "documents.0": { $exists: true } };

  if (approvalStatus) {
    query.approvalStatus = approvalStatus;
  }

  const skip = (page - 1) * limit;
  const total = await Venue.countDocuments(query);

  const venues = await Venue.find(query)
    .populate("ownerId", "email phone")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    venues: venues.map((v) => ({
      id: v._id?.toString() || "",
      name: v.name,
      ownerEmail: v.ownerEmail || (v.ownerId as any)?.email || "",
      ownerPhone: v.ownerPhone || (v.ownerId as any)?.phone || "",
      sports: v.sports,
      approvalStatus: v.approvalStatus as "PENDING" | "REVIEW" | "REJECTED",
      submittedAt: v.createdAt,
      lastReviewedAt: v.updatedAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get venue onboarding details (for admin review)
 * Returns full venue info with all documents and images
 */
export const getVenueOnboardingDetails = async (venueId: string): Promise<VenueDocument | null> => {
  return Venue.findById(venueId).populate("ownerId", "name email phone");
};

/**
 * Admin: Approve venue
 * Creates user account for venue lister and links venue to that user
 * Updates approval status to APPROVED and sends credentials to venue lister
 */
export const approveVenue = async (venueId: string): Promise<VenueDocument | null> => {
  const venue = await Venue.findById(venueId);

  if (!venue) {
    throw new Error("Venue not found");
  }

  if (
    !venue.documents?.length ||
    (venue.images?.length ?? 0) < UPLOAD_CONSTRAINTS.IMAGES.MIN_COUNT
  ) {
    throw new AppError("This venue has not finished onboarding (images and documents)", 409);
  }

  // The owner's email must have been confirmed during onboarding: approval
  // creates (or links) an account for it and sends account email there.
  if (!venue.emailVerified) {
    throw new AppError("The owner has not verified their email address", 409);
  }

  // Match by the verified email only. A phone number is not proof of identity,
  // so it never links a venue to an account. Coaches, parents and other roles
  // keep separate credentials from venue listers.
  const existingByEmail = await User.findOne({ email: venue.ownerEmail });
  if (existingByEmail && existingByEmail.role !== "VenueLister") {
    throw new AppError(
      "An account with this email already exists under a different role. The owner must register the venue with a separate email address.",
      409
    );
  }
  if (!existingByEmail && (await User.exists({ phone: venue.ownerPhone }))) {
    throw new AppError(
      "This phone number already belongs to another account. Ask the owner for a different number.",
      409
    );
  }

  let user = existingByEmail;
  let isNewUser = false;

  // No one is told a password. The account gets an unguessable one and the owner
  // sets their own through the standard reset link sent below.
  if (!user) {
    isNewUser = true;

    user = new User({
      name: venue.ownerName,
      email: venue.ownerEmail,
      phone: venue.ownerPhone,
      password: `${crypto.randomBytes(24).toString("base64url")}!A1`, // User model will hash this
      role: "VenueLister",
      venueListerProfile: {
        businessDetails: {
          name: venue.ownerName,
          address: venue.address || "",
        },
        payoutInfo: {
          accountNumber: "",
          ifsc: "",
          bankName: "",
        },
        canAddMoreVenues: false, // Restrict to only the approved venue
      },
    });

    await user.save();
  }

  // Link venue to user account
  venue.ownerId = user._id as any;
  venue.approvalStatus = "APPROVED";
  // Clear rejection/review fields
  if (venue.rejectionReason) {
    venue.rejectionReason = "";
  }
  if (venue.reviewNotes) {
    venue.reviewNotes = "";
  }

  await venue.save();

  // New account: send the standard set-password link (the account has no usable
  // password until the owner follows it).
  if (isNewUser) {
    try {
      await requestPasswordReset(venue.ownerEmail);
    } catch (error) {
      log.error("Failed to send set-password email to new venue lister:", error);
    }
  }

  // Send approval email (explains how to set a password for a new account)
  try {
    const credentialsSection = isNewUser
      ? `
          <div class="info-box" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
            <strong>Set your password:</strong>
            <p>We created an account for ${escapeHtml(venue.ownerEmail)}. A separate email has a link to set your password. If it does not arrive, use "Forgot password" on the login page.</p>
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
          <h1>Congratulations!</h1>
          <p>Your venue has been approved!</p>
        </div>
        <div class="content">
          <p>Hi ${escapeHtml(venue.ownerName)},</p>
          
          <p>We're thrilled to inform you that your venue <strong>"${escapeHtml(venue.name)}"</strong> has been approved and is now live on PowerMySport!</p>

          ${credentialsSection}

          <div class="venue-details">
            <h3>Approved Venue Details:</h3>
            <p><strong>Venue Name:</strong> ${escapeHtml(venue.name)}</p>
            <p><strong>Address:</strong> ${escapeHtml(venue.address)}</p>
            <p><strong>Price per Hour:</strong> ₹${venue.pricePerHour}</p>
            <p><strong>Contact Phone:</strong> ${escapeHtml(venue.ownerPhone)}</p>
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
      subject: `Your Venue "${venue.name}" Has Been Approved!`,
      html: approvalEmailHtml,
    });

    log.info(`Approval email sent to ${venue.ownerEmail}`);

    // Send in-app notification to venue owner
    if (user?._id) {
      NotificationService.send({
        userId: user._id.toString(),
        type: "VENUE_APPROVAL_APPROVED",
        title: "Venue Approved",
        message: `Congratulations! Your venue "${venue.name}" has been approved.`,
        data: {
          venueId: venue._id.toString(),
          venueName: venue.name,
          approvedAt: new Date().toISOString(),
          isNewUser,
          ...(isNewUser ? { hasCredentials: true } : {}),
        },
      }).catch((err: Error) => log.error("Failed to send venue approval notification:", err));
    }
  } catch (error) {
    log.error("Failed to send approval email:", error);
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
  reason: string
): Promise<VenueDocument | null> => {
  const venue = await Venue.findByIdAndUpdate(
    venueId,
    {
      approvalStatus: "REJECTED",
      rejectionReason: reason,
    },
    { new: true }
  );

  if (!venue) {
    throw new Error("Venue not found");
  }

  // Send in-app notification to venue owner (if linked to a user account)
  if (venue.ownerId) {
    NotificationService.send({
      userId: venue.ownerId.toString(),
      type: "VENUE_APPROVAL_REJECTED",
      title: "Venue Rejected",
      message: `Your venue "${venue.name}" submission has been rejected.`,
      data: {
        venueId: venue._id.toString(),
        venueName: venue.name,
        reason: reason,
        rejectedAt: new Date().toISOString(),
      },
    }).catch((err: Error) => log.error("Failed to send venue rejection notification:", err));
  }

  // Send rejection email to venue owner
  try {
    const ownerEmail =
      venue.ownerEmail || (venue.ownerId ? (await User.findById(venue.ownerId))?.email : undefined);

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
            <p>Hi ${escapeHtml(venue.ownerName)},</p>
            <p>Thank you for submitting your venue <strong>"${escapeHtml(venue.name)}"</strong> on PowerMySport. After careful review, we were unable to approve your application at this time.</p>
            <div class="reason-box">
              <strong>❌ Reason for Rejection:</strong>
              <p>${escapeHtml(reason)}</p>
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
        subject: `Update on Your Venue Application: "${venue.name}"`,
        html: rejectionEmailHtml,
      });

      log.info(`Rejection email sent to ${ownerEmail}`);
    }
  } catch (emailError) {
    log.error("Failed to send venue rejection email:", emailError);
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
  notes?: string
): Promise<VenueDocument | null> => {
  const venue = await Venue.findByIdAndUpdate(
    venueId,
    {
      approvalStatus: "REVIEW",
      reviewNotes: notes,
    },
    { new: true }
  );

  if (!venue) {
    throw new Error("Venue not found");
  }

  // Send in-app notification to venue owner (if linked to a user account)
  if (venue.ownerId) {
    NotificationService.send({
      userId: venue.ownerId.toString(),
      type: "VENUE_MARKED_FOR_REVIEW",
      title: "Venue Under Review",
      message: `Your venue "${venue.name}" is being reviewed by our team.`,
      data: {
        venueId: venue._id.toString(),
        venueName: venue.name,
        notes: notes || "",
        reviewStartedAt: new Date().toISOString(),
      },
    }).catch((err: Error) => log.error("Failed to send venue review notification:", err));
  }

  // Send review notification email to venue owner
  try {
    const ownerEmail =
      venue.ownerEmail || (venue.ownerId ? (await User.findById(venue.ownerId))?.email : undefined);

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
            <p>Hi ${escapeHtml(venue.ownerName)},</p>
            <p>Your venue <strong>"${escapeHtml(venue.name)}"</strong> is currently under active review by our team. We'll get back to you shortly with a decision.</p>
            ${
              notes
                ? `
            <div class="notes-box">
              <strong>📋 Reviewer Notes:</strong>
              <p>${escapeHtml(notes)}</p>
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

      log.info(`Review notification email sent to ${ownerEmail}`);
    }
  } catch (emailError) {
    log.error("Failed to send venue review notification email:", emailError);
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
export const deleteVenueOnboarding = async (venueId: string, ownerId: string): Promise<void> => {
  const venue = await Venue.findById(venueId);

  if (!venue || !venue.ownerId) {
    throw new Error("Venue not found");
  }

  // Only allow deletion by owner or admin
  if (venue.ownerId.toString() !== ownerId) {
    throw new Error("Unauthorized: You can only delete your own venues");
  }

  // Don't allow deletion of approved venues
  if (venue.approvalStatus === "APPROVED") {
    throw new Error("Cannot delete approved venues. Contact admin for assistance.");
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

  // Delete venue
  await Venue.findByIdAndDelete(venueId);
};
