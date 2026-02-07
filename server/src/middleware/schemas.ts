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
  amenities: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(""),
  images: z.array(z.string()).optional().default([]),
});

export const bookingSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  date: z.string().datetime(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Start time must be in HH:mm format"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "End time must be in HH:mm format"),
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
  amenities: z.array(z.string()).optional().default([]),
  address: z.string().min(5, "Address must be at least 5 characters"),
  openingHours: z.string().optional().default("9:00 AM - 9:00 PM"),
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
  imageCount: z.number().min(5).max(20, "Image count must be between 5 and 20"),
  coverPhotoIndex: z.number().min(0).max(19, "Invalid cover photo index"),
});

/**
 * Step 3B: Confirm Images (REFACTORED from Step 2)
 * Now Step 3 images confirmation
 */
export const venueOnboardingStep3ImagesSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  images: z
    .array(z.string().url())
    .min(5, "Minimum 5 images required")
    .max(20, "Maximum 20 images allowed"),
  coverPhotoUrl: z.string().url("Cover photo URL must be valid"),
});

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
