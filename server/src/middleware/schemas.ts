import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  acceptedTerms: z
    .boolean()
    .refine((value) => value === true, "Terms of Service must be accepted"),
  acceptedPrivacy: z
    .boolean()
    .refine((value) => value === true, "Privacy Policy must be accepted"),
  role: z
    .enum(["PLAYER", "VENUE_LISTER", "COACH"])
    .optional()
    .default("PLAYER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const adminCreateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email format"),
  role: z
    .enum([
      "SUPPORT_ADMIN",
      "OPERATIONS_ADMIN",
      "FINANCE_ADMIN",
      "ANALYTICS_ADMIN",
      "SYSTEM_ADMIN",
    ])
    .optional()
    .default("SUPPORT_ADMIN"),
  permissions: z.array(z.string().min(1)).optional(),
});

export const adminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.confirmPassword) {
        return true;
      }
      return data.newPassword === data.confirmPassword;
    },
    {
      message: "New password and confirm password must match",
      path: ["confirmPassword"],
    },
  );

export const communityUpdateProfileSchema = z.object({
  isIdentityPublic: z.boolean().optional(),
  messagePrivacy: z.enum(["EVERYONE", "REQUEST_ONLY", "NONE"]).optional(),
  readReceiptsEnabled: z.boolean().optional(),
  lastSeenVisible: z.boolean().optional(),
  anonymousAlias: z
    .string()
    .trim()
    .min(3, "Anonymous alias must be at least 3 characters")
    .max(40, "Anonymous alias cannot exceed 40 characters")
    .optional(),
});

export const communityBlockSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
});

export const communityStartConversationSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
});

export const communitySendMessageSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  content: z
    .string()
    .trim()
    .min(1, "Message content is required")
    .max(2000, "Message cannot exceed 2000 characters"),
});

export const communityUpdateMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message content is required")
    .max(2000, "Message cannot exceed 2000 characters"),
});

export const communityCreateGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Group name must be at least 2 characters")
    .max(60, "Group name cannot exceed 60 characters"),
  description: z
    .string()
    .trim()
    .max(240, "Description cannot exceed 240 characters")
    .optional(),
  sport: z
    .string()
    .trim()
    .max(60, "Sport cannot exceed 60 characters")
    .optional(),
  city: z
    .string()
    .trim()
    .max(80, "City cannot exceed 80 characters")
    .optional(),
  audience: z.enum(["ALL", "PLAYERS_ONLY", "COACHES_ONLY"]).optional(),
});

export const communityAddGroupMemberSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
});

export const communityUpdateGroupSettingsSchema = z.object({
  memberAddPolicy: z.enum(["ADMIN_ONLY", "ANY_MEMBER"]),
});

const geoLocationSchema = z.object({
  type: z.literal("Point"),
  coordinates: z
    .tuple([z.number(), z.number()])
    .refine(
      ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
      {
        message: "Coordinates must be valid longitude/latitude values",
      },
    ),
});

export const venueSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  location: geoLocationSchema,
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

export const bookingSchema = z
  .object({
    venueId: z.string().min(1, "Venue ID is required").optional(),
    coachId: z.string().min(1, "Coach ID is required").optional(),
    dependentId: z.string().min(1, "Dependent ID is required").optional(),
    playerLocation: geoLocationSchema.optional(),
    sport: z.string().min(1, "Sport is required"),
    promoCode: z.string().trim().min(1).max(40).optional(),
    date: z.string().datetime(),
    startTime: z
      .string()
      .regex(
        /^([01]?\d|2[0-3]):([0-5]\d)$/,
        "Start time must be in HH:mm format",
      ),
    endTime: z
      .string()
      .regex(
        /^([01]?\d|2[0-3]):([0-5]\d)$/,
        "End time must be in HH:mm format",
      ),
  })
  .refine((data) => data.venueId || data.coachId, {
    message: "Either venueId or coachId is required",
    path: ["venueId"],
  })
  .refine(
    (data) => {
      if (!data.coachId) return true;
      return Boolean(data.playerLocation);
    },
    {
      message: "Player location is required when booking a coach",
      path: ["playerLocation"],
    },
  );

export const bookingCheckInCodeSchema = z.object({
  checkInCode: z.string().min(1, "Check-in code is required"),
});

export const promoValidateSchema = z.object({
  code: z.string().trim().min(1, "Promo code is required"),
  subtotal: z.number().min(0, "Subtotal must be non-negative"),
  hasCoach: z.boolean().optional().default(false),
});

export const promoCreateSchema = z
  .object({
    code: z.string().trim().min(3).max(40),
    description: z.string().trim().min(3).max(200),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    discountValue: z.number().min(0),
    applicableTo: z.enum(["ALL", "VENUE_ONLY", "COACH_ONLY"]).optional(),
    minBookingAmount: z.number().min(0).optional(),
    maxDiscountAmount: z.number().min(0).optional(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
    maxUsageTotal: z.number().int().min(1).optional(),
    maxUsagePerUser: z.number().int().min(1).optional(),
  })
  .refine((data) => new Date(data.validUntil) > new Date(data.validFrom), {
    message: "validUntil must be after validFrom",
    path: ["validUntil"],
  });

export const bookingWaitlistSchema = z
  .object({
    venueId: z.string().min(1, "Venue ID is required").optional(),
    coachId: z.string().min(1, "Coach ID is required").optional(),
    sport: z.string().trim().min(1, "Sport is required"),
    date: z.string().datetime(),
    startTime: z
      .string()
      .regex(
        /^([01]?\d|2[0-3]):([0-5]\d)$/,
        "Start time must be in HH:mm format",
      ),
    endTime: z
      .string()
      .regex(
        /^([01]?\d|2[0-3]):([0-5]\d)$/,
        "End time must be in HH:mm format",
      ),
    alternateSlots: z.array(z.string()).optional().default([]),
  })
  .refine((data) => data.venueId || data.coachId, {
    message: "Either venueId or coachId is required",
    path: ["venueId"],
  });

export const communityReportSchema = z.object({
  targetType: z.enum(["MESSAGE", "GROUP", "POST", "ANSWER"]),
  targetId: z.string().min(1, "Target ID is required"),
  reason: z.string().trim().min(3, "Reason is required").max(120),
  details: z.string().trim().max(1000).optional(),
});

export const communityCreatePostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Title must be at least 10 characters")
    .max(180, "Title cannot exceed 180 characters"),
  body: z
    .string()
    .trim()
    .min(20, "Post body must be at least 20 characters")
    .max(5000, "Post body cannot exceed 5000 characters"),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty")
        .max(40, "Tag cannot exceed 40 characters"),
    )
    .max(8, "A post can have at most 8 tags")
    .optional(),
  sport: z
    .string()
    .trim()
    .max(60, "Sport cannot exceed 60 characters")
    .optional(),
  city: z
    .string()
    .trim()
    .max(80, "City cannot exceed 80 characters")
    .optional(),
});

export const communityUpdatePostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Title must be at least 10 characters")
    .max(180, "Title cannot exceed 180 characters")
    .optional(),
  body: z
    .string()
    .trim()
    .min(20, "Post body must be at least 20 characters")
    .max(5000, "Post body cannot exceed 5000 characters")
    .optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty")
        .max(40, "Tag cannot exceed 40 characters"),
    )
    .max(8, "A post can have at most 8 tags")
    .optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  sport: z
    .string()
    .trim()
    .max(60, "Sport cannot exceed 60 characters")
    .optional(),
  city: z
    .string()
    .trim()
    .max(80, "City cannot exceed 80 characters")
    .optional(),
});

export const communityCreateAnswerSchema = z.object({
  content: z
    .string()
    .trim()
    .min(10, "Answer must be at least 10 characters")
    .max(5000, "Answer cannot exceed 5000 characters"),
});

export const communityVoteSchema = z.object({
  targetType: z.enum(["POST", "ANSWER"]),
  targetId: z.string().min(1, "Target ID is required"),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export const communityModerationActionSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]),
  resolutionNote: z.string().trim().max(1000).optional(),
});

export const funnelEventSchema = z.object({
  eventName: z.string().trim().min(1, "eventName is required").max(80),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  source: z.enum(["WEB", "MOBILE", "SERVER"]).optional().default("WEB"),
});

export const createReviewSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  targetType: z.enum(["VENUE", "COACH"]),
  targetId: z.string().min(1, "Target ID is required"),
  rating: z.number().min(1).max(5),
  review: z.string().max(1000).optional(),
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
  mobileNumber: z
    .string()
    .min(10, "Mobile number must be at least 10 digits")
    .regex(/^[+]?[0-9\s().\-]+$/, "Please provide a valid mobile number"),
});

export const coachVerificationStep2Schema = z
  .object({
    bio: z
      .string()
      .min(20, "Bio must be at least 20 characters")
      .max(2000, "Bio cannot exceed 2000 characters"),
    sports: z
      .array(z.string().min(1, "Sport cannot be empty"))
      .min(1, "At least one sport is required"),
    certifications: z.array(z.string().min(1)).optional().default([]),
    hourlyRate: z.number().min(1, "Hourly rate must be greater than 0"),
    sportPricing: z
      .record(z.string(), z.number().min(1))
      .optional()
      .default({}),
    serviceMode: z.enum(["OWN_VENUE", "FREELANCE", "HYBRID"]).optional(),
    baseLocation: geoLocationSchema.optional(),
    serviceRadiusKm: z
      .number()
      .min(1, "Service radius must be greater than 0")
      .max(500, "Service radius is too large")
      .optional(),
    travelBufferTime: z
      .number()
      .min(0, "Travel buffer time must be non-negative")
      .max(600, "Travel buffer time is too large")
      .optional(),
    ownVenueDetails: z
      .object({
        name: z.string().min(1, "Venue name is required"),
        address: z.string().min(1, "Venue address is required"),
        description: z.string().optional().default(""),
        openingHours: z.string().optional().default("09:00-18:00"),
        images: z
          .array(z.string().url("Venue image URL must be valid"))
          .optional()
          .default([]),
        imageS3Keys: z.array(z.string().min(1)).optional().default([]),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        location: z
          .object({
            type: z.literal("Point"),
            coordinates: z
              .tuple([z.number(), z.number()])
              .refine(
                ([lon, lat]) =>
                  lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90,
                { message: "Coordinates must be valid [longitude, latitude]" },
              ),
          })
          .optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.sportPricing || Object.keys(data.sportPricing).length === 0) {
        return true;
      }

      return data.sports.every((sport) => {
        const rate = data.sportPricing?.[sport];
        return typeof rate === "number" && rate > 0;
      });
    },
    {
      message: "Each selected sport must have a valid price",
      path: ["sportPricing"],
    },
  )
  .refine(
    (data) => {
      if (data.serviceMode === "FREELANCE" || data.serviceMode === "HYBRID") {
        return Boolean(data.baseLocation);
      }
      return true;
    },
    {
      message: "Base location is required for FREELANCE and HYBRID coaches",
      path: ["baseLocation"],
    },
  );

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
    .optional()
    .default([]),
});

export const coachSubscriptionCreateSchema = z.object({
  planId: z.string().min(1, "planId is required"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
});

export const coachSubscriptionCancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const coachSubscriptionOverrideRequestSchema = z.object({
  requestedPlanId: z.string().min(1).optional(),
  note: z
    .string()
    .trim()
    .min(5, "Override request note must be at least 5 characters")
    .max(1000, "Override request note cannot exceed 1000 characters"),
});

export const adminCreateCoachPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Plan code must be at least 2 characters")
    .max(40, "Plan code cannot exceed 40 characters"),
  name: z
    .string()
    .trim()
    .min(2, "Plan name must be at least 2 characters")
    .max(120, "Plan name cannot exceed 120 characters"),
  description: z.string().trim().max(600).optional(),
  pricing: z
    .object({
      monthly: z.number().min(0).optional(),
      yearly: z.number().min(0).optional(),
    })
    .refine(
      (value) => value.monthly !== undefined || value.yearly !== undefined,
      {
        message: "At least one pricing option is required",
        path: ["monthly"],
      },
    ),
  features: z.array(z.string().trim().min(1)).optional().default([]),
  isActive: z.boolean().optional(),
  supportsOverrides: z.boolean().optional(),
});

export const adminUpdateCoachPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(600).optional(),
    pricing: z
      .object({
        monthly: z.number().min(0).optional(),
        yearly: z.number().min(0).optional(),
      })
      .optional(),
    features: z.array(z.string().trim().min(1)).optional(),
    isActive: z.boolean().optional(),
    supportsOverrides: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required to update the plan",
  });

export const adminReviewCoachOverrideSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(1000).optional(),
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
export const venueOnboardingStep2Schema = z
  .object({
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
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
          closeTime: z
            .string()
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
        })
        .refine(
          (data) => {
            if (data.isOpen) {
              return (
                data.openTime &&
                data.closeTime &&
                data.openTime < data.closeTime
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
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
          closeTime: z
            .string()
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
        })
        .refine(
          (data) => {
            if (data.isOpen) {
              return (
                data.openTime &&
                data.closeTime &&
                data.openTime < data.closeTime
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
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
          closeTime: z
            .string()
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
        })
        .refine(
          (data) => {
            if (data.isOpen) {
              return (
                data.openTime &&
                data.closeTime &&
                data.openTime < data.closeTime
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
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
          closeTime: z
            .string()
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
        })
        .refine(
          (data) => {
            if (data.isOpen) {
              return (
                data.openTime &&
                data.closeTime &&
                data.openTime < data.closeTime
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
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
          closeTime: z
            .string()
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
        })
        .refine(
          (data) => {
            if (data.isOpen) {
              return (
                data.openTime &&
                data.closeTime &&
                data.openTime < data.closeTime
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
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
          closeTime: z
            .string()
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
        })
        .refine(
          (data) => {
            if (data.isOpen) {
              return (
                data.openTime &&
                data.closeTime &&
                data.openTime < data.closeTime
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
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
          closeTime: z
            .string()
            .regex(
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Time must be in HH:MM format",
            )
            .optional(),
        })
        .refine(
          (data) => {
            if (data.isOpen) {
              return (
                data.openTime &&
                data.closeTime &&
                data.openTime < data.closeTime
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
  })
  .refine(
    (data) => Object.values(data.openingHours).some((day) => day.isOpen),
    {
      message: "At least one day must be open",
      path: ["openingHours"],
    },
  );

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

const venueCoachSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Coach name must be at least 2 characters")
    .max(100, "Coach name cannot exceed 100 characters"),
  sport: z
    .string()
    .trim()
    .min(1, "Sport is required")
    .max(60, "Sport cannot exceed 60 characters"),
  hourlyRate: z.number().positive("Hourly rate must be greater than 0"),
  bio: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .min(20, "Coach bio must be at least 20 characters")
        .max(500, "Coach bio cannot exceed 500 characters"),
    ])
    .optional(),
  profilePhoto: z
    .union([z.string().url("Profile photo must be a valid URL"), z.literal("")])
    .optional(),
});

export const venueOnboardingStep5Schema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  coaches: z
    .array(venueCoachSchema)
    .max(20, "A venue can have at most 20 coaches")
    .default([])
    .optional(),
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
