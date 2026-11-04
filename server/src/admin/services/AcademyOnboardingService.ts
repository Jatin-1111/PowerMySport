import Academy, { AcademyDocument } from "../models/Academy";
import { User } from "../../client/models/User";
import SubscriptionPlan from "../../client/models/SubscriptionPlan";
import SessionPackage from "../../client/models/SessionPackage";
import { IAcademyPendingReview, IOnboardingUploadUrl } from "../../types/index";
import { escapeHtml, sendEmail } from "../../utils/email";
import { NotificationService } from "../../client/services/NotificationService";
import { s3Service } from "../../shared/services/S3Service";
import { encryptValue, isEncryptedValue } from "../../shared/utils/encryption";
import { issueOnboardingToken } from "../../utils/academyOnboardingToken";
import { log as __rootLog } from "../../utils/logger";
import { AppError } from "../../utils/AppError";
import { sendVerificationCode, verifyCode } from "../../shared/services/EmailVerificationService";
const log = __rootLog.child("academyOnboarding");

// `updateAcademyStep` writes with findByIdAndUpdate, which does not run the
// model's pre-save hook, so the payout fields have to be sealed here or they
// land in the database as plaintext.
const sealPayoutValue = (value: unknown): unknown =>
  typeof value === "string" && value && !isEncryptedValue(value) ? encryptValue(value) : value;

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
}): Promise<{ academy: AcademyDocument; onboardingToken: string }> => {
  // Only a draft whose email was confirmed blocks a new start. An unconfirmed
  // draft proves nothing about who owns the address, so it must not lock the
  // real owner out.
  const existingAcademy = await Academy.findOne({
    contactEmail: payload.ownerEmail,
    onboardingCompleted: false,
    emailVerified: true,
  });

  if (existingAcademy) {
    throw new Error("You already have an incomplete academy onboarding. Complete or start fresh.");
  }

  let slug = generateSlug(payload.name);
  let counter = 1;
  while (await Academy.findOne({ slug })) {
    slug = `${generateSlug(payload.name)}-${counter}`;
    counter += 1;
  }

  // No account is linked here: nobody has proved they own this email yet. The
  // owner account is linked at approval, by the verified email only.
  // The caller has no account to authorise later steps against, so they are
  // handed this token once; only its hash is stored.
  const { token: onboardingToken, hash: onboardingTokenHash } = issueOnboardingToken();

  const academy = await Academy.create({
    onboardingTokenHash,
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

  return { academy, onboardingToken };
};

/**
 * Every venue photo must be one we issued an upload link for, for this academy.
 * The photos are shown on public pages, so an address typed in from anywhere else
 * (another site, a tracking link, something unsuitable) is refused. Uploads are
 * stored under `venues/<academyId>/images/`.
 */
const assertVenuePhotosAreOurs = (academyId: string, venues: Record<string, any>[]): void => {
  const prefix = `venues/${academyId}/images/`;
  venues.forEach((venue, index) => {
    const name = `Venue ${index + 1}`;
    const sets: { label: string; urls: string[]; keys: string[] }[] = [
      {
        label: `${name} general photos`,
        urls: venue.generalImages ?? [],
        keys: venue.generalImageKeys ?? [],
      },
      ...Object.keys(venue.sportImages ?? {}).map((sport) => ({
        label: `${name} ${sport} photos`,
        urls: venue.sportImages[sport] ?? [],
        keys: venue.sportImageKeys?.[sport] ?? [],
      })),
    ];
    for (const { label, urls, keys } of sets) {
      if (keys.length !== urls.length) {
        throw new AppError(`${label} must be uploaded through the form`, 400);
      }
      if (
        keys.some(
          (key: string) => typeof key !== "string" || !key.startsWith(prefix) || key.includes("..")
        )
      ) {
        throw new AppError(`${label} must be uploaded through the form`, 400);
      }
    }
    if (!(venue.generalImages ?? []).includes(venue.coverPhotoUrl)) {
      throw new AppError(`${name} cover photo must be one of its general photos`, 400);
    }
  });
};

export const updateAcademyStep = async (
  academyId: string,
  stepNumber: number,
  payload: any
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
    const venues = (payload.academyVenues as Record<string, any>[]) || [];
    assertVenuePhotosAreOurs(academyId, venues);
    updateData.academyVenues = venues;
  }

  if (stepNumber === 5) {
    // Name, email and sports only, even if a caller sends more: these are people
    // who have not agreed to be listed, so nothing else about them is stored.
    updateData.academyCoaches = ((payload.academyCoaches as Record<string, unknown>[]) || []).map(
      (coach) => ({
        firstName: String(coach.firstName).trim(),
        lastName: String(coach.lastName).trim(),
        email: String(coach.email).trim().toLowerCase(),
        sports: coach.sports,
      })
    );
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
    // A bank account, a UPI ID, or both. Whatever was not given is cleared, so
    // sending UPI only after a bank account replaces it instead of keeping stale
    // details. Values are trimmed here because the request body is not replaced
    // by the validator's cleaned copy.
    const given = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    updateData.bankAccountNumber = sealPayoutValue(given(payload.bankAccountNumber));
    updateData.bankIfsc = sealPayoutValue(given(payload.bankIfsc));
    updateData.bankAccountName = given(payload.bankAccountName);
    updateData.upiId = sealPayoutValue(given(payload.upiId));
    updateData.payoutFrequency = payload.payoutFrequency;
    updateData.cancellationPolicy = given(payload.cancellationPolicy);
    updateData.refundPolicy = given(payload.refundPolicy);
  }

  if (stepNumber > academy.onboardingStep) {
    updateData.onboardingStep = stepNumber;
  }

  const updatedAcademy = await Academy.findByIdAndUpdate(academyId, updateData, {
    new: true,
  });

  if (!updatedAcademy) {
    throw new Error("Failed to update academy");
  }

  return updatedAcademy;
};

/** Email the owner a confirmation code for the academy's contact address. */
export const sendAcademyEmailCode = async (academyId: string): Promise<void> => {
  const academy = await ensureAcademyExists(academyId);
  if (academy.emailVerified) return;
  const result = await sendVerificationCode(academy.contactEmail, academy.contactPersonName);
  if (!result.success) {
    throw new AppError(result.message, 429);
  }
};

export const verifyAcademyEmail = async (academyId: string, code: string): Promise<void> => {
  const academy = await ensureAcademyExists(academyId);
  const result = await verifyCode(academy.contactEmail, code);
  if (!result.success) {
    throw new AppError(result.message, 400);
  }
  await Academy.findByIdAndUpdate(academyId, { emailVerified: true });
};

export const getAcademyOnboardingProgress = async (
  academyId: string
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
    completedSteps: Array.from({ length: academy.onboardingStep - 1 }, (_, i) => i + 1),
    data: academy.toObject(),
  };
};

export const getImageUploadPresignedUrls = async (
  academyId: string,
  imageTypes: string[]
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
        false
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
        true
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
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          s3Service.generateImageUploadUrl(`gallery_${i}.jpg`, "image/jpeg", academyId, false)
        )
      );
      responses.forEach((uploadResponse, i) => {
        urls.push({
          field: `galleryPhoto_${i}`,
          uploadUrl: uploadResponse.uploadUrl,
          downloadUrl: uploadResponse.downloadUrl,
          s3Key: uploadResponse.key,
          fileName: uploadResponse.fileName,
          contentType: "image/jpeg",
          maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.galleryPhotos.maxSize,
        });
      });
    }

    // New types for academy onboarding step 4 (venues) and step 5 (coaches)
    if (type === "academyVenue_general") {
      // Provide 3 general images per venue call
      const responses = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          s3Service.generateImageUploadUrl(
            `academy/${academyId}/venue_general_${Date.now()}_${i}.jpg`,
            "image/jpeg",
            academyId,
            false
          )
        )
      );
      responses.forEach((uploadResponse, i) => {
        urls.push({
          field: `academyVenue_general_${i}`,
          uploadUrl: uploadResponse.uploadUrl,
          downloadUrl: uploadResponse.downloadUrl,
          s3Key: uploadResponse.key,
          fileName: uploadResponse.fileName,
          contentType: "image/jpeg",
          maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.academyVenueGeneral.maxSize,
        });
      });
    }

    if (type === "academyVenue_sport") {
      // Provide 5 sport-specific images (frontend should request per sport as needed)
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          s3Service.generateImageUploadUrl(
            `academy/${academyId}/venue_sport_${Date.now()}_${i}.jpg`,
            "image/jpeg",
            academyId,
            false
          )
        )
      );
      responses.forEach((uploadResponse, i) => {
        urls.push({
          field: `academyVenue_sport_${i}`,
          uploadUrl: uploadResponse.uploadUrl,
          downloadUrl: uploadResponse.downloadUrl,
          s3Key: uploadResponse.key,
          fileName: uploadResponse.fileName,
          contentType: "image/jpeg",
          maxSizeBytes: UPLOAD_CONSTRAINTS.IMAGES.academyVenueSport.maxSize,
        });
      });
    }

    if (type === "academyVenue_cover") {
      const uploadResponse = await s3Service.generateImageUploadUrl(
        `academy/${academyId}/venue_cover_${Date.now()}.jpg`,
        "image/jpeg",
        academyId,
        true
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
        false
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
  }
): Promise<AcademyDocument> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      ...(payload.logoUrl ? { logoUrl: payload.logoUrl, logoKey: payload.logoKey } : {}),
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
    { new: true }
  );

  if (!updatedAcademy) {
    throw new Error("Failed to confirm images");
  }

  return updatedAcademy;
};

export const getDocumentUploadPresignedUrls = async (
  academyId: string,
  docTypes: ("panDocument" | "gstDocument")[]
): Promise<IOnboardingUploadUrl[]> => {
  await ensureAcademyExists(academyId);
  const urls: IOnboardingUploadUrl[] = [];

  for (const docType of docTypes) {
    const fileName = docType === "panDocument" ? "pan_document.pdf" : "gst_document.pdf";
    const uploadResponse = await s3Service.generateDocumentUploadUrl(
      fileName,
      "application/pdf",
      docType,
      academyId
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
  }
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
    { new: true }
  );

  if (!updatedAcademy) {
    throw new Error("Failed to confirm documents");
  }

  return updatedAcademy;
};

export const submitAcademyForApproval = async (academyId: string): Promise<AcademyDocument> => {
  const academy = await ensureAcademyExists(academyId);

  if (!academy.emailVerified) {
    throw new AppError("Verify your email address before submitting for review", 403);
  }
  if (academy.onboardingStep < 7) {
    throw new Error("All 7 onboarding steps must be completed before submission");
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
      // A resubmission is a fresh submission, not a standing rejection.
      rejectionReason: "",
    },
    { new: true }
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
        <p>Your academy "${escapeHtml(academy.name)}" has been submitted for review.</p>
        <p>Our team will verify your documents and get back to you within 3-5 business days.</p>
      `,
    });
  } catch (error) {
    log.error("Failed to send submission confirmation email:", error);
  }

  return updatedAcademy;
};

export const getPendingAcademies = async (
  page = 1,
  limit = 20,
  filter?: "pending" | "approved" | "rejected"
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
    .sort({ createdAt: -1 })
    .lean();

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
      isActive: a.isActive,
      rejectionReason: a.rejectionReason,
      lifecycle: a.lifecycle,
      submittedAt: a.createdAt,
      lastReviewedAt: a.updatedAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAcademyOnboardingDetails = async (
  academyId: string
): Promise<AcademyDocument | null> =>
  Academy.findById(academyId)
    .populate("ownerId", "name email phone")
    .populate("subscriptionPlans")
    .populate("sessionPackages");

export const approveAcademy = async (academyId: string): Promise<AcademyDocument | null> => {
  const academy = await ensureAcademyExists(academyId);
  if (!academy.onboardingCompleted) {
    throw new AppError("This academy has not submitted its onboarding for review", 409);
  }
  // One decision, no half-approved state: the KYC check comes first, and
  // approving then makes the academy live.
  if (!academy.kycVerified) {
    throw new AppError("Run the KYC check before approving this academy", 409);
  }

  // Link the owner by the verified contact email only; a phone number is not
  // proof of identity. Other roles keep separate credentials from academy owners.
  let ownerId = academy.ownerId;
  if (!ownerId) {
    const owner = await User.findOne({ email: academy.contactEmail }).select("_id role");
    if (owner && owner.role !== "Academy") {
      throw new AppError(
        "An account with this email already exists under a different role. The owner must register the academy with a separate email address.",
        409
      );
    }
    ownerId = owner?._id;
  }

  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      ...(ownerId ? { ownerId } : {}),
      isApproved: true,
      isActive: true,
    },
    { new: true }
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
    log.error("Failed to send approval email:", error);
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
    log.error("Failed to send approval notification:", error);
  }

  return updatedAcademy;
};

export const rejectAcademy = async (
  academyId: string,
  rejectionReason: string
): Promise<AcademyDocument | null> => {
  const academy = await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      isApproved: false,
      rejectionReason,
      onboardingStep: 6,
    },
    { new: true }
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
        <p>Thank you for submitting your academy "${escapeHtml(academy.name)}".</p>
        <p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>
        <p>Please update the required information and resubmit.</p>
      `,
    });
  } catch (error) {
    log.error("Failed to send rejection email:", error);
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
    log.error("Failed to send rejection notification:", error);
  }

  return updatedAcademy;
};

export const markAcademyKycVerified = async (
  academyId: string
): Promise<AcademyDocument | null> => {
  const academy = await ensureAcademyExists(academyId);
  // The KYC check alone does not list an academy; Approve does. An academy that
  // was already approved (and is waiting on this check) goes live now.
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    { kycVerified: true, ...(academy.isApproved ? { isActive: true } : {}) },
    { new: true }
  );

  if (!updatedAcademy) {
    throw new Error("Failed to mark KYC verified");
  }

  return updatedAcademy;
};

export const suspendAcademy = async (
  academyId: string,
  reason?: string
): Promise<AcademyDocument | null> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await Academy.findByIdAndUpdate(
    academyId,
    {
      isActive: false,
      rejectionReason: reason || "Suspended by admin",
    },
    { new: true }
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
