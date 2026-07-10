import Academy, { AcademyDocument } from "../models/Academy";
import { User } from "../../client/models/User";
import SubscriptionPlan from "../../client/models/SubscriptionPlan";
import SessionPackage from "../../client/models/SessionPackage";
import { IAcademyPendingReview, IOnboardingUploadUrl } from "../../types/index";
import { sendEmail } from "../../utils/email";
import { NotificationService } from "../../client/services/NotificationService";
import { s3Service } from "../../shared/services/S3Service";

export const UPLOAD_CONSTRAINTS = {
  IMAGES: {
    logo: {
      maxSize: 2 * 1024 * 1024,
      types: ["image/jpeg", "image/png"],
    },
    coverPhoto: {
      maxSize: 5 * 1024 * 1024,
      types: ["image/jpeg", "image/png"],
    },
    galleryPhotos: {
      maxSize: 5 * 1024 * 1024,
      types: ["image/jpeg", "image/png"],
      maxCount: 10,
    },
    academyVenueGeneral: {
      maxSize: 5 * 1024 * 1024,
      types: ["image/jpeg", "image/png"],
      maxCount: 3,
    },
    academyVenueSport: {
      maxSize: 5 * 1024 * 1024,
      types: ["image/jpeg", "image/png"],
      maxCount: 5,
    },
    academyVenueCover: {
      maxSize: 5 * 1024 * 1024,
      types: ["image/jpeg", "image/png"],
    },
    academyCoachPhoto: {
      maxSize: 2 * 1024 * 1024,
      types: ["image/jpeg", "image/png"],
    },
  },
  DOCUMENTS: {
    panDocument: {
      maxSize: 5 * 1024 * 1024,
      types: ["application/pdf", "image/jpeg", "image/png"],
    },
    gstDocument: {
      maxSize: 5 * 1024 * 1024,
      types: ["application/pdf", "image/jpeg", "image/png"],
    },
  },
} as const;

const generateSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/-+/g, "-");

const ensureAcademyExists = async (academyId: string) => {
  const academy = await Academy.findById(academyId);
  if (!academy) {
    throw new Error("Academy not found");
  }
  return academy;
};

export const startAcademyOnboarding = async (payload: {
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  name: string;
  legalName: string;
  sports: string[];
  ageGroups: ("kids" | "teens" | "adults" | "all")[];
  establishedYear?: number;
  description: string;
  logoUrl?: string;
  logoKey?: string;
}): Promise<AcademyDocument> => {
  const existingAcademy = await Academy.findOne({
    contactEmail: payload.ownerEmail,
    onboardingCompleted: false,
  });

  if (existingAcademy) {
    throw new Error(
      "You already have an incomplete academy onboarding. Complete or start fresh.",
    );
  }

  let slug = generateSlug(payload.name);
  let counter = 1;
  while (await Academy.findOne({ slug })) {
    slug = `${generateSlug(payload.name)}-${counter}`;
    counter += 1;
  }

  // Do not create a new account here. Link an existing owner account only.
  const existingOwner = await User.findOne({
    $or: [{ email: payload.ownerEmail }, { phone: payload.ownerPhone }],
  }).select("_id");

  const academy = await Academy.create({
    name: payload.name,
    legalName: payload.legalName,
    slug,
    sports: payload.sports,
    ageGroups: payload.ageGroups,
    establishedYear: payload.establishedYear,
    description: payload.description,
    logoUrl: payload.logoUrl,
    logoKey: payload.logoKey,
    contactPersonName: payload.ownerName,
    contactEmail: payload.ownerEmail,
    contactPhone: payload.ownerPhone,
    ownerId: existingOwner?._id,
    photos: [],
    photoKeys: [],
    location: {
      type: "Point",
      coordinates: [0, 0],
    },
    operatingHours: {
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
    languagesSpoken: ["English", "Hindi"],
    whatsappNumber: payload.ownerPhone,
    allowsExternalCoaches: true,
    academyVenues: [],
    academyCoaches: [],
    venueIds: [],
    coachIds: [],
    subscriptionPlans: [],
    sessionPackages: [],
    businessType: "sole_proprietorship",
    sessionRatePerHour: 0,
    trialsessionOffered: false,
    payoutFrequency: "weekly",
    onboardingStep: 1,
    onboardingCompleted: false,
    isApproved: false,
    kycVerified: false,
    isActive: false,
    rating: 0,
    reviewCount: 0,
    batchTimings: ["morning"],
    maxBatchSize: 20,
  });

  return academy;
};

export const updateAcademyStep = async (
  academyId: string,
  stepNumber: number,
  payload: any,
): Promise<AcademyDocument> => {
  const academy = await ensureAcademyExists(academyId);
  const updateData: Record<string, unknown> = {};

  if (stepNumber === 2) {
    updateData.location = payload.location;
    updateData.address = payload.address;
    updateData.city = payload.city;
    updateData.state = payload.state;
    updateData.pincode = payload.pincode;
    updateData.placeId = payload.placeId;
    updateData.contactPersonName = payload.contactPersonName;
    updateData.contactPhone = payload.contactPhone;
    updateData.contactEmail = payload.contactEmail;
    updateData.whatsappNumber = payload.whatsappNumber;
    updateData.languagesSpoken = payload.languagesSpoken;
  }

  if (stepNumber === 3) {
    updateData.businessType = payload.businessType;
    updateData.panNumber = payload.panNumber;
    updateData.panDocumentUrl = payload.panDocumentUrl;
    updateData.panDocumentKey = payload.panDocumentKey;
    updateData.gstNumber = payload.gstNumber;
    updateData.gstDocumentUrl = payload.gstDocumentUrl;
    updateData.gstDocumentKey = payload.gstDocumentKey;
    updateData.msmeRegistration = payload.msmeRegistration;
    updateData.sportsAuthorityAffiliation = payload.sportsAuthorityAffiliation;
    updateData.aadhaarLast4 = payload.aadhaarLast4;
  }

  if (stepNumber === 4) {
    updateData.academyVenues = payload.academyVenues || [];
  }

  if (stepNumber === 5) {
    updateData.academyCoaches = payload.academyCoaches || [];
    updateData.venueIds = [];
    updateData.coachIds = [];
  }

  if (stepNumber === 6) {
    updateData.sessionRatePerHour = payload.sessionRatePerHour;
    updateData.batchTimings = payload.batchTimings;
    updateData.maxBatchSize = payload.maxBatchSize;
    updateData.trialsessionOffered = payload.trialsessionOffered;
    updateData.trialSessionPrice = payload.trialSessionPrice;
  }

  if (stepNumber === 7) {
    updateData.bankAccountNumber = payload.bankAccountNumber;
    updateData.bankIfsc = payload.bankIfsc;
    updateData.bankAccountName = payload.bankAccountName;
    updateData.upiId = payload.upiId;
    updateData.payoutFrequency = payload.payoutFrequency;
    updateData.cancellationPolicy = payload.cancellationPolicy;
    updateData.refundPolicy = payload.refundPolicy;
  }

  if (stepNumber > academy.onboardingStep) {
    updateData.onboardingStep = stepNumber;
  }

  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    updateData,
    {
      new: true,
    },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to update academy");
  }

  return updatedAcademy;
};

export const getAcademyOnboardingProgress = async (
  academyId: string,
): Promise<{
  academyId: string;
  currentStep: number;
  completedSteps: number[];
  data: any;
}> => {
  const academy = await ensureAcademyExists(academyId);
  return {
    academyId: academy._id.toString(),
    currentStep: academy.onboardingStep,
    completedSteps: Array.from(
      { length: academy.onboardingStep - 1 },
      (_, i) => i + 1,
    ),
    data: academy.toObject(),
  };
};

export const getImageUploadPresignedUrls = async (
  academyId: string,
  imageTypes: string[],
): Promise<IOnboardingUploadUrl[]> => {
  await ensureAcademyExists(academyId);
  const urls: IOnboardingUploadUrl[] = [];

  for (const type of imageTypes) {
    // Support legacy/simple types
    if (type === "logo") {
      const uploadResponse = await s3Service.generateImageUploadUrl(
        "logo.jpg",
        "image/jpeg",
        academyId,
        false,
      );
      urls.push({
        field: "logo",
        uploadUrl: uploadResponse.uploadUrl,
        downloadUrl: uploadResponse.downloadUrl,
        s3Key: uploadResponse.key,
        fileName: uploadResponse.fileName,
        contentType: "image/jpeg",
        maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.logo.maxSize,
      });
    }

    if (type === "coverPhoto") {
      const uploadResponse = await s3Service.generateImageUploadUrl(
        "cover.jpg",
        "image/jpeg",
        academyId,
        true,
      );
      urls.push({
        field: "coverPhoto",
        uploadUrl: uploadResponse.uploadUrl,
        downloadUrl: uploadResponse.downloadUrl,
        s3Key: uploadResponse.key,
        fileName: uploadResponse.fileName,
        contentType: "image/jpeg",
        maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.coverPhoto.maxSize,
      });
    }

    if (type === "galleryPhotos") {
      for (let i = 0; i < 5; i += 1) {
        const uploadResponse = await s3Service.generateImageUploadUrl(
          `gallery_${i}.jpg`,
          "image/jpeg",
          academyId,
          false,
        );
        urls.push({
          field: `galleryPhoto_${i}`,
          uploadUrl: uploadResponse.uploadUrl,
          downloadUrl: uploadResponse.downloadUrl,
          s3Key: uploadResponse.key,
          fileName: uploadResponse.fileName,
          contentType: "image/jpeg",
          maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.galleryPhotos.maxSize,
        });
      }
    }

    // New types for academy onboarding step 4 (venues) and step 5 (coaches)
    if (type === "academyVenue_general") {
      // Provide 3 general images per venue call
      for (let i = 0; i < 3; i += 1) {
        const uploadResponse = await s3Service.generateImageUploadUrl(
          `academy/${academyId}/venue_general_${Date.now()}_${i}.jpg`,
          "image/jpeg",
          academyId,
          false,
        );
        urls.push({
          field: `academyVenue_general_${i}`,
          uploadUrl: uploadResponse.uploadUrl,
          downloadUrl: uploadResponse.downloadUrl,
          s3Key: uploadResponse.key,
          fileName: uploadResponse.fileName,
          contentType: "image/jpeg",
          maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.academyVenueGeneral.maxSize,
        });
      }
    }

    if (type === "academyVenue_sport") {
      // Provide 5 sport-specific images (frontend should request per sport as needed)
      for (let i = 0; i < 5; i += 1) {
        const uploadResponse = await s3Service.generateImageUploadUrl(
          `academy/${academyId}/venue_sport_${Date.now()}_${i}.jpg`,
          "image/jpeg",
          academyId,
          false,
        );
        urls.push({
          field: `academyVenue_sport_${i}`,
          uploadUrl: uploadResponse.uploadUrl,
          downloadUrl: uploadResponse.downloadUrl,
          s3Key: uploadResponse.key,
          fileName: uploadResponse.fileName,
          contentType: "image/jpeg",
          maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.academyVenueSport.maxSize,
        });
      }
    }

    if (type === "academyVenue_cover") {
      const uploadResponse = await s3Service.generateImageUploadUrl(
        `academy/${academyId}/venue_cover_${Date.now()}.jpg`,
        "image/jpeg",
        academyId,
        true,
      );
      urls.push({
        field: `academyVenue_cover`,
        uploadUrl: uploadResponse.uploadUrl,
        downloadUrl: uploadResponse.downloadUrl,
        s3Key: uploadResponse.key,
        fileName: uploadResponse.fileName,
        contentType: "image/jpeg",
        maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.academyVenueCover.maxSize,
      });
    }

    if (type === "academyCoach_photo") {
      const uploadResponse = await s3Service.generateImageUploadUrl(
        `academy/${academyId}/coach_photo_${Date.now()}.jpg`,
        "image/jpeg",
        academyId,
        false,
      );
      urls.push({
        field: `academyCoach_photo`,
        uploadUrl: uploadResponse.uploadUrl,
        downloadUrl: uploadResponse.downloadUrl,
        s3Key: uploadResponse.key,
        fileName: uploadResponse.fileName,
        contentType: "image/jpeg",
        maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.academyCoachPhoto.maxSize,
      });
    }
  }

  return urls;
};

export const confirmAcademyImages = async (
  academyId: string,
  payload: {
    logoUrl?: string;
    logoKey?: string;
    coverPhotoUrl?: string;
    coverPhotoKey?: string;
    galleryPhotoUrls?: string[];
    galleryPhotoKeys?: string[];
  },
): Promise<AcademyDocument> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      ...(payload.logoUrl
        ? { logoUrl: payload.logoUrl, logoKey: payload.logoKey }
        : {}),
      ...(payload.coverPhotoUrl
        ? {
            coverPhotoUrl: payload.coverPhotoUrl,
            coverPhotoKey: payload.coverPhotoKey,
          }
        : {}),
      ...(payload.galleryPhotoUrls?.length
        ? {
            photos: payload.galleryPhotoUrls,
            photoKeys: payload.galleryPhotoKeys || [],
          }
        : {}),
    },
    { new: true },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to confirm images");
  }

  return updatedAcademy;
};

export const getDocumentUploadPresignedUrls = async (
  academyId: string,
  docTypes: ("panDocument" | "gstDocument")[],
): Promise<IOnboardingUploadUrl[]> => {
  await ensureAcademyExists(academyId);
  const urls: IOnboardingUploadUrl[] = [];

  for (const docType of docTypes) {
    const fileName =
      docType === "panDocument" ? "pan_document.pdf" : "gst_document.pdf";
    const uploadResponse = await s3Service.generateDocumentUploadUrl(
      fileName,
      "application/pdf",
      docType,
      academyId,
    );

    urls.push({
      field: docType,
      uploadUrl: uploadResponse.uploadUrl,
      downloadUrl: uploadResponse.downloadUrl,
      s3Key: uploadResponse.key,
      fileName: uploadResponse.fileName,
      contentType: "application/pdf",
      maxSizeBytes: UPLOAD_CONSTRAINTS.DOCUMENTS[docType].maxSize,
    });
  }

  return urls;
};

export const confirmAcademyDocuments = async (
  academyId: string,
  payload: {
    panDocumentUrl: string;
    panDocumentKey: string;
    gstDocumentUrl?: string;
    gstDocumentKey?: string;
  },
): Promise<AcademyDocument> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      panDocumentUrl: payload.panDocumentUrl,
      panDocumentKey: payload.panDocumentKey,
      ...(payload.gstDocumentUrl
        ? {
            gstDocumentUrl: payload.gstDocumentUrl,
            gstDocumentKey: payload.gstDocumentKey,
          }
        : {}),
    },
    { new: true },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to confirm documents");
  }

  return updatedAcademy;
};

export const submitAcademyForApproval = async (
  academyId: string,
): Promise<AcademyDocument> => {
  const academy = await ensureAcademyExists(academyId);

  if (academy.onboardingStep < 7) {
    throw new Error(
      "All 7 onboarding steps must be completed before submission",
    );
  }
  if (!academy.panNumber || !academy.panDocumentUrl) {
    throw new Error("PAN details are required");
  }
  if (!academy.bankAccountNumber && !academy.upiId) {
    throw new Error("Payout details are required");
  }

  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      onboardingCompleted: true,
      isApproved: false,
      kycVerified: false,
    },
    { new: true },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to submit academy");
  }

  try {
    await sendEmail({
      to: academy.contactEmail,
      subject: "Academy Submission Received - Under Review",
      html: `
        <h2>Submission Received</h2>
        <p>Your academy "${academy.name}" has been submitted for review.</p>
        <p>Our team will verify your documents and get back to you within 3-5 business days.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send submission confirmation email:", error);
  }

  return updatedAcademy;
};

export const getPendingAcademies = async (
  page = 1,
  limit = 20,
  filter?: "pending" | "approved" | "rejected",
): Promise<{
  academies: IAcademyPendingReview[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const query: Record<string, unknown> = { onboardingCompleted: true };
  if (filter === "pending") query.isApproved = false;
  if (filter === "approved") query.isApproved = true;
  if (filter === "rejected") query.rejectionReason = { $exists: true, $ne: "" };

  const total = await Academy.countDocuments(query);
  const academies = await Academy.find(query)
    .populate("ownerId", "email phone name")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    academies: academies.map((a) => ({
      id: a._id?.toString() || "",
      name: a.name,
      legalName: a.legalName,
      city: a.city || "",
      sports: a.sports,
      ownerEmail: a.contactEmail,
      ownerPhone: a.contactPhone,
      isApproved: a.isApproved,
      kycVerified: a.kycVerified,
      submittedAt: a.createdAt,
      lastReviewedAt: a.updatedAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAcademyOnboardingDetails = async (
  academyId: string,
): Promise<AcademyDocument | null> =>
  Academy.findById(academyId)
    .populate("ownerId", "name email phone")
    .populate("subscriptionPlans")
    .populate("sessionPackages");

export const approveAcademy = async (
  academyId: string,
): Promise<AcademyDocument | null> => {
  const academy = await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      isApproved: true,
      ...(academy.kycVerified ? { isActive: true } : {}),
    },
    { new: true },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to approve academy");
  }

  try {
    await sendEmail({
      to: academy.contactEmail,
      subject: `Academy "${academy.name}" Approved!`,
      html: `
        <h2>Congratulations!</h2>
        <p>Your academy has been approved and is now live on PowerMySport!</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send approval email:", error);
  }

  try {
    if (academy.ownerId) {
      await NotificationService.send({
        userId: academy.ownerId.toString(),
        type: "ACADEMY_APPROVED",
        title: "Academy Approved",
        message: `Your academy "${academy.name}" has been approved!`,
        data: {
          academyId: academy._id.toString(),
          academyName: academy.name,
          approvedAt: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to send approval notification:", error);
  }

  return updatedAcademy;
};

export const rejectAcademy = async (
  academyId: string,
  rejectionReason: string,
): Promise<AcademyDocument | null> => {
  const academy = await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      isApproved: false,
      rejectionReason,
      onboardingStep: 6,
    },
    { new: true },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to reject academy");
  }

  try {
    await sendEmail({
      to: academy.contactEmail,
      subject: "Academy Submission - Additional Information Needed",
      html: `
        <h2>Additional Information Needed</h2>
        <p>Thank you for submitting your academy "${academy.name}".</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
        <p>Please update the required information and resubmit.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send rejection email:", error);
  }

  try {
    if (academy.ownerId) {
      await NotificationService.send({
        userId: academy.ownerId.toString(),
        type: "ACADEMY_REJECTED",
        title: "Academy Submission - More Information Needed",
        message: `Your academy submission needs more information: ${rejectionReason}`,
        data: {
          academyId: academy._id.toString(),
          academyName: academy.name,
          reason: rejectionReason,
        },
      });
    }
  } catch (error) {
    console.error("Failed to send rejection notification:", error);
  }

  return updatedAcademy;
};

export const markAcademyKycVerified = async (
  academyId: string,
): Promise<AcademyDocument | null> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    { kycVerified: true, isActive: true },
    { new: true },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to mark KYC verified");
  }

  return updatedAcademy;
};

export const suspendAcademy = async (
  academyId: string,
  reason?: string,
): Promise<AcademyDocument | null> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      isActive: false,
      rejectionReason: reason || "Suspended by admin",
    },
    { new: true },
  );

  if (!updatedAcademy) {
    throw new Error("Failed to suspend academy");
  }

  return updatedAcademy;
};

export const createSubscriptionPlan = async (payload: {
  academyId: string;
  name: string;
  duration: "monthly" | "quarterly" | "annual";
  price: number;
  includes?: string[];
  maxSessions?: number;
}) => {
  const academy = await ensureAcademyExists(payload.academyId);
  const plan = await SubscriptionPlan.create({
    academyId: payload.academyId,
    name: payload.name,
    duration: payload.duration,
    price: payload.price,
    includes: payload.includes || [],
    maxSessions: payload.maxSessions ?? null,
    isActive: true,
  });

  academy.subscriptionPlans.push(plan._id as never);
  await academy.save();
  return plan;
};

export const createSessionPackage = async (payload: {
  academyId: string;
  sessionCount: number;
  price: number;
  validityDays: number;
  sport: string;
  coachId?: string;
}) => {
  const academy = await ensureAcademyExists(payload.academyId);
  const pkg = await SessionPackage.create({
    academyId: payload.academyId,
    sessionCount: payload.sessionCount,
    price: payload.price,
    validityDays: payload.validityDays,
    sport: payload.sport,
    ...(payload.coachId ? { coachId: payload.coachId } : {}),
    isActive: true,
  });

  academy.sessionPackages.push(pkg._id as never);
  await academy.save();
  return pkg;
};
