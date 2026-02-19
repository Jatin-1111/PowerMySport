import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z
    .enum(["PLAYER", "VENUE_LISTER", "COACH"])
    .optional()
    .default("PLAYER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const venueSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  location: z.string().min(1, "Location is required"),
  sports: z.array(z.string()).min(1, "At least one sport is required"),
  pricePerHour: z.number().min(0, "Price must be non-negative"),
  sportPricing: z.record(z.string(), z.number().min(0)).optional(),
  amenities: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(""),
  images: z.array(z.string()).optional().default([]),
});

export const venueImageUploadSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z.string().min(1),
      }),
    )
    .min(1)
    .max(20),
  coverPhotoIndex: z.number().min(0).max(19),
});

export const bookingSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  sport: z.string().min(1, "Sport is required"),
  date: z.string().datetime(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Start time must be in HH:mm format"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "End time must be in HH:mm format"),
});

const coachVerificationDocumentTypeSchema = z.enum([
  "CERTIFICATION",
  "ID_PROOF",
  "ADDRESS_PROOF",
  "BACKGROUND_CHECK",
  "INSURANCE",
  "OTHER",
]);

export const coachVerificationStep1Schema = z.object({
  bio: z
    .string()
    .min(20, "Bio must be at least 20 characters")
    .max(2000, "Bio cannot exceed 2000 characters"),
});

export const coachVerificationStep2Schema = z.object({
  bio: z
    .string()
    .min(20, "Bio must be at least 20 characters")
    .max(2000, "Bio cannot exceed 2000 characters"),
  sports: z
    .array(z.string().min(1, "Sport cannot be empty"))
    .min(1, "At least one sport is required"),
  certifications: z.array(z.string().min(1)).optional().default([]),
  serviceMode: z.enum(["OWN_VENUE", "FREELANCE", "HYBRID"]).optional(),
});

export const coachVerificationStep3Schema = z.object({
  documents: z
    .array(
      z.object({
        type: coachVerificationDocumentTypeSchema,
        url: z.string().url("Document URL must be valid"),
        s3Key: z.string().optional(),
        fileName: z.string().min(1, "File name is required"),
        uploadedAt: z.union([z.string().datetime(), z.date()]).optional(),
      }),
    )
    .min(1, "At least one verification document is required"),
});

// ============================================
// VENUE ONBOARDING SCHEMAS (4-Step Flow)
// ============================================

/**
 * Step 1: Venue Lister Contact Information
 * REFACTORED: Now takes contact info instead of venue details
 */
export const venueOnboardingStep1Schema = z.object({
  ownerName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  ownerEmail: z.string().email("Please provide a valid email address"),
  ownerPhone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(
      /^[+]?[0-9\s().\-]+$/,
      "Please provide a valid phone number (digits, spaces, +, -, (), . allowed)",
    ),
});

/**
 * Step 2: Venue Details (REFACTORED from Step 1)
 * Previously Step 1, now contains all venue information
 */
export const venueOnboardingStep2Schema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  name: z
    .string()
    .min(2, "Venue name must be at least 2 characters")
    .max(100, "Venue name cannot exceed 100 characters"),
  sports: z.array(z.string().min(1)).min(1, "At least one sport is required"),
  pricePerHour: z.number().min(0, "Price must be non-negative"),
  sportPricing: z.record(z.string(), z.number().min(0)).optional(),
  amenities: z.array(z.string()).optional().default([]),
  address: z.string().min(5, "Address must be at least 5 characters"),
  openingHours: z.object({
    monday: z
      .object({
        isOpen: z.boolean(),
        openTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
        closeTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.isOpen) {
            return (
              data.openTime && data.closeTime && data.openTime < data.closeTime
            );
          }
          return true;
        },
        { message: "Opening time must be before closing time when open" },
      ),
    tuesday: z
      .object({
        isOpen: z.boolean(),
        openTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
        closeTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.isOpen) {
            return (
              data.openTime && data.closeTime && data.openTime < data.closeTime
            );
          }
          return true;
        },
        { message: "Opening time must be before closing time when open" },
      ),
    wednesday: z
      .object({
        isOpen: z.boolean(),
        openTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
        closeTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.isOpen) {
            return (
              data.openTime && data.closeTime && data.openTime < data.closeTime
            );
          }
          return true;
        },
        { message: "Opening time must be before closing time when open" },
      ),
    thursday: z
      .object({
        isOpen: z.boolean(),
        openTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
        closeTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.isOpen) {
            return (
              data.openTime && data.closeTime && data.openTime < data.closeTime
            );
          }
          return true;
        },
        { message: "Opening time must be before closing time when open" },
      ),
    friday: z
      .object({
        isOpen: z.boolean(),
        openTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
        closeTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.isOpen) {
            return (
              data.openTime && data.closeTime && data.openTime < data.closeTime
            );
          }
          return true;
        },
        { message: "Opening time must be before closing time when open" },
      ),
    saturday: z
      .object({
        isOpen: z.boolean(),
        openTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
        closeTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.isOpen) {
            return (
              data.openTime && data.closeTime && data.openTime < data.closeTime
            );
          }
          return true;
        },
        { message: "Opening time must be before closing time when open" },
      ),
    sunday: z
      .object({
        isOpen: z.boolean(),
        openTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
        closeTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.isOpen) {
            return (
              data.openTime && data.closeTime && data.openTime < data.closeTime
            );
          }
          return true;
        },
        { message: "Opening time must be before closing time when open" },
      ),
  }),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .default(""),
  allowExternalCoaches: z.boolean().optional().default(true),
  location: z.object({
    type: z.enum(["Point"]),
    coordinates: z
      .array(z.number())
      .length(2, "Coordinates must have [longitude, latitude]"),
  }),
});

/**
 * Step 3: Venue Images Upload (REFACTORED from Step 2)
 * Now called for Step 3, previously Step 2
 */
export const getImageUploadUrlsSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  sports: z
    .array(z.string())
    .min(1, "At least one sport is required")
    .max(10, "Maximum 10 sports allowed"),
});

/**
 * Step 3B: Confirm Images (REFACTORED from Step 2)
 * Now Step 3 images confirmation
 */
export const venueOnboardingStep3ImagesSchema = z
  .object({
    venueId: z.string().min(1, "Venue ID is required"),
    // Legacy images array (optional now)
    images: z.array(z.string().url()).optional().default([]),

    // New structure
    generalImages: z.array(z.string().url()).optional(),
    generalImageKeys: z.array(z.string()).optional(),
    sportImages: z.record(z.string(), z.array(z.string().url())).optional(),
    sportImageKeys: z.record(z.string(), z.array(z.string())).optional(),

    coverPhotoUrl: z.string().url("Cover photo URL must be valid"),
    coverPhotoKey: z.string().optional(),
  })
  .refine(
    (data) => {
      // Check if using new structure
      if (data.generalImages && data.sportImages) {
        // Validate general images (must be 3)
        if (data.generalImages.length !== 3) return false;

        // Validate sport images (must be 5 per sport)
        const sportImages = data.sportImages;
        if (!sportImages) return false;

        const sports = Object.keys(sportImages);
        if (sports.length === 0) return false;

        for (const sport of sports) {
          const images = sportImages[sport];
          if (!images || images.length !== 5) return false;
        }

        return true;
      }

      // Fallback to legacy structure validation
      return data.images.length >= 5 && data.images.length <= 20;
    },
    {
      message:
        "Invalid images: Requirement is either 3 general images + 5 per sport, OR 5-20 total images (legacy)",
    },
  );

/**
 * Step 4: Finalize Onboarding with Images + Documents
 * Frontend sends complete payload with both images and documents
 */
export const venueOnboardingStep4Schema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  images: z
    .array(z.string().url("Image URL must be valid"))
    .min(5, "Minimum 5 images required")
    .max(20, "Maximum 20 images allowed"),
  coverPhotoUrl: z.string().url("Cover photo URL must be valid"),
  documents: z
    .array(
      z.object({
        type: z.enum(
          [
            "OWNERSHIP_PROOF",
            "BUSINESS_REGISTRATION",
            "TAX_DOCUMENT",
            "INSURANCE",
            "CERTIFICATE",
          ],
          {
            message:
              "Invalid document type. Must be one of: OWNERSHIP_PROOF, BUSINESS_REGISTRATION, TAX_DOCUMENT, INSURANCE, CERTIFICATE",
          },
        ),
        url: z.string().url("Document URL must be valid"),
        fileName: z.string().min(1, "File name is required"),
      }),
    )
    .min(1, "At least one document is required"),
});

/**
 * Get Presigned URLs for Documents
 */
export const getDocumentUploadUrlsSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  documents: z
    .array(
      z.object({
        type: z.enum(
          [
            "OWNERSHIP_PROOF",
            "BUSINESS_REGISTRATION",
            "TAX_DOCUMENT",
            "INSURANCE",
            "CERTIFICATE",
          ],
          {
            message: "Invalid document type",
          },
        ),
        fileName: z.string().min(1, "File name is required"),
        contentType: z.enum(["application/pdf", "image/jpeg", "image/png"], {
          message: "Document must be PDF, JPG, or PNG",
        }),
      }),
    )
    .min(1, "At least one document is required"),
});

/**
 * Admin: Approve Venue
 */
export const adminApproveVenueSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
});

/**
 * Admin: Reject Venue
 */
export const adminRejectVenueSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  reason: z
    .string()
    .min(5, "Rejection reason must be at least 5 characters")
    .max(500, "Rejection reason cannot exceed 500 characters"),
});

/**
 * Admin: Mark for Review
 */
export const adminReviewVenueSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  notes: z
    .string()
    .min(5, "Review notes must be at least 5 characters")
    .max(500, "Review notes cannot exceed 500 characters")
    .optional(),
});

/**
 * Email Verification: Send Code
 */
export const sendVerificationCodeSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

/**
 * Email Verification: Verify Code
 */
export const verifyEmailCodeSchema = z.object({
  email: z.string().email("Invalid email format"),
  code: z
    .string()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d{6}$/, "Verification code must contain only digits"),
  venueId: z.string().min(1, "Venue ID is required"),
});
