import crypto from "crypto";
import type { Academy } from "@prisma/client";
import prisma from "../../lib/prisma";
import { IAcademyPendingReview, IOnboardingUploadUrl } from "../../types/index";
import { sendEmail } from "../../utils/email";
import { NotificationService } from "../../client/services/NotificationService";
import { s3Service } from "../../shared/services/S3Service";

// ---------------------------------------------------------------------------
// Relocated AES-256-GCM bank-field crypto (see SCHEMA_CHANGES §11).
// In Mongo this lived as getter/setter + a pre-save hook on the Academy model.
// Prisma has no hooks, so the encrypt-on-write / decrypt-on-read logic moves
// here and is applied explicitly around every Academy write/read that touches
// bankAccountNumber / bankIfsc / upiId. Requires BANK_ENCRYPTION_KEY (32-byte
// hex) in the environment — see server/.env.example.
// ---------------------------------------------------------------------------
const rawEncryptionKey = process.env.BANK_ENCRYPTION_KEY || "";
const ENCRYPTION_KEY = Buffer.from(rawEncryptionKey, "hex");
if (!rawEncryptionKey || ENCRYPTION_KEY.length !== 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: BANK_ENCRYPTION_KEY must be a 32-byte hex string.");
  }
  console.warn(
    "WARNING: BANK_ENCRYPTION_KEY is missing or invalid. Academy bank fields will not be encrypted correctly.",
  );
}

const isEncryptedValue = (value: string): boolean =>
  value.split(":").length === 3;

const encryptValue = (plaintext: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

const decryptValue = (ciphertext: string): string => {
  if (!ciphertext || !isEncryptedValue(ciphertext)) {
    return ciphertext;
  }

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      return ciphertext;
    }

    const [ivHex, tagHex, encHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return ciphertext;
  }
};

// Encrypt bank fields on any updateData object before it is written (mirrors
// the old setter/pre-save behavior: only encrypt non-empty, not-already-
// encrypted values).
const encryptBankFieldsForWrite = (
  updateData: Record<string, unknown>,
): void => {
  for (const field of ["bankAccountNumber", "bankIfsc", "upiId"] as const) {
    const value = updateData[field];
    if (typeof value === "string" && value && !isEncryptedValue(value)) {
      updateData[field] = encryptValue(value);
    }
  }
};

// Decrypt bank fields on read (mirrors the old getters + toJSON/toObject
// getters:true). Returns a new object so the stored/cached row is untouched.
const decryptBankFieldsForRead = <T extends Academy>(academy: T): T => {
  return {
    ...academy,
    bankAccountNumber: decryptValue(academy.bankAccountNumber),
    bankIfsc: decryptValue(academy.bankIfsc),
    upiId: decryptValue(academy.upiId),
  };
};

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
  const academy = await prisma.academy.findUnique({ where: { id: academyId } });
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
}): Promise<Academy> => {
  const existingAcademy = await prisma.academy.findFirst({
    where: {
      contactEmail: payload.ownerEmail,
      onboardingCompleted: false,
    },
  });

  if (existingAcademy) {
    throw new Error(
      "You already have an incomplete academy onboarding. Complete or start fresh.",
    );
  }

  let slug = generateSlug(payload.name);
  let counter = 1;
  while (await prisma.academy.findUnique({ where: { slug } })) {
    slug = `${generateSlug(payload.name)}-${counter}`;
    counter += 1;
  }

  // Do not create a new account here. Link an existing owner account only.
  const existingOwner = await prisma.user.findFirst({
    where: {
      OR: [{ email: payload.ownerEmail }, { phone: payload.ownerPhone }],
    },
    select: { id: true },
  });

  const academy = await prisma.academy.create({
    data: {
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
      ownerId: existingOwner?.id ?? null,
      photos: [],
      photoKeys: [],
      // GeoJSON Point -> lng/lat columns (SCHEMA_CHANGES §7).
      lng: 0,
      lat: 0,
      // operatingHours (7-day object) kept as a Json blob.
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
      subscriptionPlanIds: [],
      sessionPackageIds: [],
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
    },
  });

  return decryptBankFieldsForRead(academy);
};

export const updateAcademyStep = async (
  academyId: string,
  stepNumber: number,
  payload: any,
): Promise<Academy> => {
  const academy = await ensureAcademyExists(academyId);
  const updateData: Record<string, unknown> = {};

  if (stepNumber === 2) {
    // GeoJSON Point -> lng/lat columns (SCHEMA_CHANGES §7).
    // TODO(prisma): geo radius discovery for academies must move to a PostGIS/
    // earthdistance $queryRaw; here we only persist the coordinates.
    if (payload.location?.coordinates) {
      updateData.lng = payload.location.coordinates[0];
      updateData.lat = payload.location.coordinates[1];
    }
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

  // Relocated pre-save hook: encrypt bank fields before writing.
  encryptBankFieldsForWrite(updateData);

  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: updateData,
  });

  if (!updatedAcademy) {
    throw new Error("Failed to update academy");
  }

  return decryptBankFieldsForRead(updatedAcademy);
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
    academyId: academy.id.toString(),
    currentStep: academy.onboardingStep,
    completedSteps: Array.from(
      { length: academy.onboardingStep - 1 },
      (_, i) => i + 1,
    ),
    data: decryptBankFieldsForRead(academy),
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
): Promise<Academy> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: {
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
  });

  if (!updatedAcademy) {
    throw new Error("Failed to confirm images");
  }

  return decryptBankFieldsForRead(updatedAcademy);
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
): Promise<Academy> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: {
      panDocumentUrl: payload.panDocumentUrl,
      panDocumentKey: payload.panDocumentKey,
      ...(payload.gstDocumentUrl
        ? {
            gstDocumentUrl: payload.gstDocumentUrl,
            gstDocumentKey: payload.gstDocumentKey,
          }
        : {}),
    },
  });

  if (!updatedAcademy) {
    throw new Error("Failed to confirm documents");
  }

  return decryptBankFieldsForRead(updatedAcademy);
};

export const submitAcademyForApproval = async (
  academyId: string,
): Promise<Academy> => {
  const academy = await ensureAcademyExists(academyId);

  if (academy.onboardingStep < 7) {
    throw new Error(
      "All 7 onboarding steps must be completed before submission",
    );
  }
  if (!academy.panNumber || !academy.panDocumentUrl) {
    throw new Error("PAN details are required");
  }
  // Presence checks work on the encrypted-at-rest values (non-empty stays
  // non-empty once encrypted), so no decryption is needed here.
  if (!academy.bankAccountNumber && !academy.upiId) {
    throw new Error("Payout details are required");
  }

  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: {
      onboardingCompleted: true,
      isApproved: false,
      kycVerified: false,
    },
  });

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

  return decryptBankFieldsForRead(updatedAcademy);
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
  const where: Record<string, unknown> = { onboardingCompleted: true };
  if (filter === "pending") where.isApproved = false;
  if (filter === "approved") where.isApproved = true;
  if (filter === "rejected") {
    // Mongo: { $exists:true, $ne:"" } -> has a non-null, non-empty reason.
    where.AND = [
      { rejectionReason: { not: null } },
      { rejectionReason: { not: "" } },
    ];
  }

  const [total, academies] = await Promise.all([
    prisma.academy.count({ where: where as any }),
    prisma.academy.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    academies: academies.map((a) => ({
      id: a.id?.toString() || "",
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
): Promise<Academy | null> => {
  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
  });
  if (!academy) {
    return null;
  }

  // Mongo populated ownerId (User) + subscriptionPlans + sessionPackages. There
  // are no Prisma relations on these String[] FKs, so join in code (see
  // PORTING_GUIDE §1 populate helper) and re-attach in the same shape.
  const [owner, subscriptionPlans, sessionPackages] = await Promise.all([
    academy.ownerId
      ? prisma.user.findUnique({
          where: { id: academy.ownerId },
          select: { id: true, name: true, email: true, phone: true },
        })
      : Promise.resolve(null),
    prisma.subscriptionPlan.findMany({
      where: { id: { in: academy.subscriptionPlanIds } },
    }),
    prisma.sessionPackage.findMany({
      where: { id: { in: academy.sessionPackageIds } },
    }),
  ]);

  return {
    ...decryptBankFieldsForRead(academy),
    ownerId: owner ?? academy.ownerId,
    subscriptionPlans,
    sessionPackages,
  } as unknown as Academy;
};

export const approveAcademy = async (
  academyId: string,
): Promise<Academy | null> => {
  const academy = await ensureAcademyExists(academyId);
  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: {
      isApproved: true,
      ...(academy.kycVerified ? { isActive: true } : {}),
    },
  });

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
          academyId: academy.id.toString(),
          academyName: academy.name,
          approvedAt: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to send approval notification:", error);
  }

  return decryptBankFieldsForRead(updatedAcademy);
};

export const rejectAcademy = async (
  academyId: string,
  rejectionReason: string,
): Promise<Academy | null> => {
  const academy = await ensureAcademyExists(academyId);
  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: {
      isApproved: false,
      rejectionReason,
      onboardingStep: 6,
    },
  });

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
          academyId: academy.id.toString(),
          academyName: academy.name,
          reason: rejectionReason,
        },
      });
    }
  } catch (error) {
    console.error("Failed to send rejection notification:", error);
  }

  return decryptBankFieldsForRead(updatedAcademy);
};

export const markAcademyKycVerified = async (
  academyId: string,
): Promise<Academy | null> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: { kycVerified: true, isActive: true },
  });

  if (!updatedAcademy) {
    throw new Error("Failed to mark KYC verified");
  }

  return decryptBankFieldsForRead(updatedAcademy);
};

export const suspendAcademy = async (
  academyId: string,
  reason?: string,
): Promise<Academy | null> => {
  await ensureAcademyExists(academyId);
  const updatedAcademy = await prisma.academy.update({
    where: { id: academyId },
    data: {
      isActive: false,
      rejectionReason: reason || "Suspended by admin",
    },
  });

  if (!updatedAcademy) {
    throw new Error("Failed to suspend academy");
  }

  return decryptBankFieldsForRead(updatedAcademy);
};

export const createSubscriptionPlan = async (payload: {
  academyId: string;
  name: string;
  duration: "monthly" | "quarterly" | "annual";
  price: number;
  includes?: string[];
  maxSessions?: number;
}) => {
  await ensureAcademyExists(payload.academyId);

  // NOTE: the Mongo call passed `includes: payload.includes || []`, but neither
  // the old Mongoose schema nor the Prisma schema has an `includes` field
  // (the plan uses includesVenue/includesCoaching booleans instead), so — as
  // in Mongo, where the unknown key was silently stripped — it is not persisted.
  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.subscriptionPlan.create({
      data: {
        academyId: payload.academyId,
        name: payload.name,
        duration: payload.duration,
        price: payload.price,
        maxSessions: payload.maxSessions ?? null,
        isActive: true,
      },
    });

    await tx.academy.update({
      where: { id: payload.academyId },
      data: { subscriptionPlanIds: { push: created.id } },
    });

    return created;
  });

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
  await ensureAcademyExists(payload.academyId);

  const pkg = await prisma.$transaction(async (tx) => {
    const created = await tx.sessionPackage.create({
      data: {
        academyId: payload.academyId,
        // TODO(prisma): `name` is required on SessionPackage but the original
        // signature does not accept one (the Mongo create relied on the caller
        // never hitting the required-name validation). Derive a stable default;
        // add `name` to the payload if a caller needs to set it explicitly.
        name: `${payload.sessionCount}-session ${payload.sport} package`,
        sessionCount: payload.sessionCount,
        price: payload.price,
        validityDays: payload.validityDays,
        sport: payload.sport,
        ...(payload.coachId ? { coachId: payload.coachId } : {}),
        isActive: true,
      },
    });

    await tx.academy.update({
      where: { id: payload.academyId },
      data: { sessionPackageIds: { push: created.id } },
    });

    return created;
  });

  return pkg;
};
