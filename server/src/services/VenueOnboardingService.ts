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
} from "../types";
import { sendEmail } from "../utils/email";
import { s3Service } from "./S3Service";

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
  payload: IVenueOnboardingStep1,
): Promise<VenueDocument> => {
  // Check if venue lister already submitted with this email
  const existingVenue = await Venue.findOne({
    ownerEmail: payload.ownerEmail,
    approvalStatus: { $in: ["PENDING", "REVIEW"] },
  });

  if (existingVenue) {
    throw new Error(
      "You already have a pending venue approval. Complete or cancel it first.",
    );
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
      monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
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
  payload: IVenueOnboardingStep2,
): Promise<VenueDocument> => {
  const venue = await Venue.findById(payload.venueId);
  if (!venue) {
    throw new Error("Venue not found");
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
  sports: string[], // Array of selected sports
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
      { new: true },
    );

    if (!venue) {
      throw new Error("Venue not found");
    }

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

    const venue = await Venue.findByIdAndUpdate(
      payload.venueId,
      {
        images: payload.images,
        imageKeys: payload.imageKeys,
        coverPhotoUrl: payload.coverPhotoUrl,
        coverPhotoKey: payload.coverPhotoKey,
      },
      { new: true },
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
  documents: Array<{ type: string; fileName: string; contentType: string }>,
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

  // Transform documents
  const documentsToSave: IVenueDocument[] = payload.documents.map(
    (doc: (typeof payload.documents)[number]) => ({
      type: doc.type as
        | "OWNERSHIP_PROOF"
        | "BUSINESS_REGISTRATION"
        | "TAX_DOCUMENT"
        | "INSURANCE"
        | "CERTIFICATE",
      url: doc.url,
      ...(doc.s3Key !== undefined && { s3Key: doc.s3Key }), // Only include s3Key if defined
      fileName: doc.fileName,
      uploadedAt: new Date(),
    }),
  );

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
    { new: true },
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
  approvalStatus?: "PENDING" | "REVIEW" | "REJECTED",
): Promise<{
  venues: IPendingVenue[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const query: any = { approvalStatus: { $ne: "APPROVED" } };

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
      ownerEmail: (v.ownerId as any)?.email || "",
      ownerPhone: (v.ownerId as any)?.phone || "",
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
export const getVenueOnboardingDetails = async (
  venueId: string,
): Promise<VenueDocument | null> => {
  return Venue.findById(venueId).populate("ownerId", "name email phone");
};

/**
 * Admin: Approve venue
 * Creates user account for venue lister and links venue to that user
 * Updates approval status to APPROVED and sends credentials to venue lister
 */
export const approveVenue = async (
  venueId: string,
): Promise<VenueDocument | null> => {
  const venue = await Venue.findById(venueId);

  if (!venue) {
    throw new Error("Venue not found");
  }

  // Check if user already exists for this venue owner
  let user = await User.findOne({
    $or: [{ email: venue.ownerEmail }, { phone: venue.ownerPhone }],
  });

  let tempPassword: string | undefined;
  let isNewUser = false;

  // If user doesn't exist, create a new VENUE_LISTER account
  if (!user) {
    // Generate temporary password
    tempPassword = Math.random().toString(36).slice(-8) + "!A1";
    isNewUser = true;

    user = new User({
      name: venue.ownerName,
      email: venue.ownerEmail,
      phone: venue.ownerPhone,
      password: tempPassword, // User model will hash this
      role: "VENUE_LISTER",
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
            <p>If you have any questions, feel free to contact our support team at support@powermysport.com</p>
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
  const venue = await Venue.findByIdAndUpdate(
    venueId,
    {
      approvalStatus: "REJECTED",
      rejectionReason: reason,
    },
    { new: true },
  );

  if (!venue) {
    throw new Error("Venue not found");
  }

  // TODO: Send rejection email to venue owner
  // const owner = await User.findById(venue.ownerId);
  // await emailService.sendVenueRejectedEmail(owner?.email, reason);

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
  const venue = await Venue.findByIdAndUpdate(
    venueId,
    {
      approvalStatus: "REVIEW",
      reviewNotes: notes,
    },
    { new: true },
  );

  if (!venue) {
    throw new Error("Venue not found");
  }

  // TODO: Send review notification email to venue owner
  // if (notes) {
  //   const owner = await User.findById(venue.ownerId);
  //   await emailService.sendVenueReviewEmail(owner?.email, notes);
  // }

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

  // Delete venue
  await Venue.findByIdAndDelete(venueId);
};
