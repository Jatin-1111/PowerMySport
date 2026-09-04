import { Request, Response } from "express";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { S3Service } from "../../../shared/services/S3Service";
import { User } from "../../../client/models/User";
import { Coach } from "../../../client/models/Coach";
import { recordAuditLog } from "../../services/AuditLogService";
import {
  getCoachById,
  listCoachVerificationRequests,
  updateCoachVerificationStatus,
  updateCoach,
  submitCoachVerification,
} from "../../../client/services/CoachService";
import { transformDocument } from "../../../middleware/responseTransform";
import {
  sendCoachVerificationReminderEmail,
  sendCoachVerificationStatusEmail,
  sendCoachAdminCredentialsEmail,
} from "../../../utils/email";
import { NotificationService } from "../../../client/services/NotificationService";
import { log, normalizeAdminResponse, buildUserSummary, generateTempPassword } from "./shared";

const normalizeCoachResponse = (coach: unknown) => {
  if (!coach || typeof coach !== "object") {
    return coach;
  }

  const objectValue = coach as { toObject?: () => Record<string, unknown> };
  const plain =
    typeof objectValue.toObject === "function"
      ? objectValue.toObject()
      : (coach as Record<string, unknown>);

  return {
    ...plain,
    id:
      typeof plain.id === "string"
        ? plain.id
        : plain._id &&
            typeof plain._id === "object" &&
            typeof (plain._id as { toString?: () => string }).toString === "function"
          ? (plain._id as { toString: () => string }).toString()
          : "",
  };
};

/**
 * Admin: List coaches
 * GET /api/admin/coaches
 */
export const listCoaches = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
  const skip = (page - 1) * limit;
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";

  const filter: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "ALL") {
    filter.verificationStatus = statusFilter;
  }

  const [total, coaches] = await Promise.all([
    Coach.countDocuments(filter),
    Coach.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "userId",
        select: "_id name email phone photoUrl photoS3Key role",
      })
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    message: "Coaches retrieved successfully",
    data: coaches.map((coach) => normalizeCoachResponse(coach)),
    pagination: {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

/**
 * Admin: Get presigned upload URL for coach verification documents / venue images
 * POST /api/admin/coaches/:coachId/verification/upload-url
 */
export const getAdminCoachVerificationUploadUrlHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    if (!coachId) {
      throw new AppError("coachId is required", 400);
    }

    const coach = await getCoachById(coachId);
    if (!coach) {
      throw new AppError("Coach not found", 404);
    }

    const { fileName, contentType, documentType, purpose } = req.body as {
      fileName?: string;
      contentType?: string;
      documentType?: string;
      purpose?: "DOCUMENT" | "VENUE_IMAGE";
    };

    if (!fileName || !contentType) {
      throw new AppError("fileName and contentType are required", 400);
    }

    const s3Service = new S3Service();

    const uploadData =
      purpose === "VENUE_IMAGE"
        ? await s3Service.generateCoachVenueImageUploadUrl(
            fileName,
            contentType,
            coach._id.toString()
          )
        : await s3Service.generateCoachVerificationUploadUrl(
            fileName,
            contentType,
            coach._id.toString(),
            (documentType as any) || "OTHER"
          );

    res.status(200).json({
      success: true,
      message:
        purpose === "VENUE_IMAGE"
          ? "Venue image upload URL generated"
          : "Verification document upload URL generated",
      data: uploadData,
    });
  }
);

/**
 * Admin: Update coach profile (partial) by coachId
 * PUT /api/admin/coaches/:coachId
 */
export const updateCoachAdminHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    if (!coachId) {
      throw new AppError("coachId is required", 400);
    }

    // Strip fields an admin must not set via the generic coach update — these
    // are governed by the dedicated verification flow or derived server-side.
    const updates: Record<string, unknown> = { ...(req.body || {}) };
    for (const f of [
      "isVerified",
      "verificationStatus",
      "userId",
      "createdBy",
      "rating",
      "reviewCount",
      "_id",
    ]) {
      delete updates[f];
    }

    const updated = await updateCoach(coachId, updates as any);
    if (!updated) {
      throw new AppError("Coach not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Coach updated successfully",
      data: transformDocument(updated.toJSON()),
    });
  }
);

/**
 * Admin: Submit coach verification on behalf of coach
 * POST /api/admin/coaches/:coachId/verification/submit
 */
export const submitCoachVerificationAdminHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    if (!coachId) {
      throw new AppError("coachId is required", 400);
    }

    const coach = await getCoachById(coachId);
    if (!coach) {
      throw new AppError("Coach not found", 404);
    }

    const payload = req.body as { documents?: any[] };

    const submitted = await submitCoachVerification((coach.userId as any).toString(), {
      documents: payload.documents || [],
    });

    res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      data: transformDocument(submitted.toJSON()),
    });
  }
);

/**
 * List coach verification requests
 * GET /api/admin/coaches/verification?status=PENDING&page=1&limit=20
 */
export const listCoachVerifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const status = req.query.status as
      "UNVERIFIED" | "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED" | undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);

    const result = await listCoachVerificationRequests(status, page, limit);

    res.status(200).json({
      success: true,
      message: "Coach verification requests retrieved",
      data: result.coaches,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  }
);

/**
 * Get single coach details for admin verification review
 * GET /api/admin/coaches/:coachId
 */
export const getCoachVerificationDetails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const coach = await getCoachById(coachId);

    if (!coach) {
      throw new AppError("Coach not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Coach details retrieved",
      data: normalizeAdminResponse(coach),
    });
  }
);

/**
 * Approve coach verification
 * POST /api/admin/coaches/:coachId/verify
 */
export const approveCoachVerification = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const coach = await updateCoachVerificationStatus(coachId, "VERIFIED", req.user.id);

    try {
      const user = await User.findById(coach.userId).select("_id name email").lean();
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "VERIFIED",
        });
      }

      // Send in-app notification
      if (user?._id) {
        NotificationService.send({
          userId: user._id.toString(),
          type: "COACH_VERIFICATION_VERIFIED",
          title: "Coach Verification Approved",
          message: "Congratulations! Your coach profile has been verified.",
          data: {
            coachId: coachId,
            verifiedAt: new Date().toISOString(),
          },
        }).catch((err: Error) => log.error("Failed to send verification notification:", err));
      }
    } catch (emailError) {
      log.error("Failed to send coach verification email:", emailError);
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "coach.verify",
      targetType: "Coach",
      targetId: coachId,
    });

    res.status(200).json({
      success: true,
      message: "Coach verified successfully",
      data: coach,
    });
  }
);

/**
 * Reject coach verification
 * POST /api/admin/coaches/:coachId/reject
 */
export const rejectCoachVerification = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const { reason } = req.body as { reason?: string };
    if (!reason) {
      throw new AppError("Rejection reason is required", 400);
    }

    const coach = await updateCoachVerificationStatus(coachId, "REJECTED", req.user.id, reason);

    try {
      const user = await User.findById(coach.userId).select("_id name email").lean();
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "REJECTED",
          notes: reason,
        });
      }

      // Send in-app notification
      if (user?._id) {
        NotificationService.send({
          userId: user._id.toString(),
          type: "COACH_VERIFICATION_REJECTED",
          title: "Coach Verification Rejected",
          message: "Your coach verification request has been rejected.",
          data: {
            coachId: coachId,
            reason: reason,
            rejectedAt: new Date().toISOString(),
          },
        }).catch((err: Error) => log.error("Failed to send rejection notification:", err));
      }
    } catch (emailError) {
      log.error("Failed to send coach verification email:", emailError);
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "coach.reject",
      targetType: "Coach",
      targetId: coachId,
      metadata: { reason },
    });

    res.status(200).json({
      success: true,
      message: "Coach verification rejected",
      data: coach,
    });
  }
);

/**
 * Mark coach verification for review
 * POST /api/admin/coaches/:coachId/mark-review
 */
export const markCoachVerificationForReview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const { notes } = req.body as { notes?: string };

    const coach = await updateCoachVerificationStatus(coachId, "REVIEW", req.user.id, notes);

    try {
      const user = await User.findById(coach.userId).select("_id name email").lean();
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "REVIEW",
          ...(notes ? { notes } : {}),
        });
      }

      // Send in-app notification
      if (user?._id) {
        NotificationService.send({
          userId: user._id.toString(),
          type: "COACH_VERIFICATION_REVIEW",
          title: "Coach Verification Under Review",
          message: "Your coach verification is under review by our team.",
          data: {
            coachId: coachId,
            notes: notes || "",
            reviewStartedAt: new Date().toISOString(),
          },
        }).catch((err: Error) => log.error("Failed to send review notification:", err));
      }
    } catch (emailError) {
      log.error("Failed to send coach verification email:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Coach verification marked for review",
      data: coach,
    });
  }
);

/**
 * Notify coach to complete/submit verification
 * POST /api/admin/coaches/:coachId/notify
 */
export const notifyCoachVerificationPending = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const coach = await getCoachById(coachId);

    if (!coach) {
      throw new AppError("Coach not found", 404);
    }

    if (coach.verificationStatus === "VERIFIED") {
      throw new AppError("Coach is already verified", 400);
    }

    if (coach.lastVerificationReminderAt) {
      const elapsedMs = Date.now() - new Date(coach.lastVerificationReminderAt).getTime();
      if (elapsedMs < REMINDER_COOLDOWN_MS) {
        const remainingMs = REMINDER_COOLDOWN_MS - elapsedMs;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        throw new AppError(
          `Reminder cooldown active. Try again in ${remainingMinutes} minute(s).`,
          429
        );
      }
    }

    const user = await User.findById(coach.userId).select("_id name email");
    if (!user?._id) {
      throw new AppError("Coach user not found", 404);
    }

    if (!user.email) {
      throw new AppError("Coach does not have an email address", 400);
    }

    await sendCoachVerificationReminderEmail({
      name: user.name || "Coach",
      email: user.email,
    });

    coach.lastVerificationReminderAt = new Date();
    await coach.save();

    NotificationService.send({
      userId: user._id.toString(),
      type: "COACH_VERIFICATION_PENDING",
      title: "Complete Your Coach Verification",
      message:
        "Please complete and submit your coach verification profile and documents for admin review.",
      data: {
        coachId,
        currentStatus: coach.verificationStatus || "UNVERIFIED",
        remindedAt: new Date().toISOString(),
      },
    }).catch((err: Error) => log.error("Failed to send in-app verification reminder:", err));

    res.status(200).json({
      success: true,
      message: "Verification reminder email sent",
    });
  }
);

/**
 * Create coach directly from admin
 * POST /api/admin/coaches/create
 */
export const createCoachAdminHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      profilePhotoUrl,
      profilePhotoKey,
      bio,
      sports,
      hourlyRate,
      sportPricing,
      serviceMode,
      baseLocation,
      serviceRadiusKm,
      travelBufferTime,
      venueId,
      ownVenueDetails,
      verificationStatus,
      convertExistingUser,
    } = req.body;

    const normalizedEmail = typeof email === "string" ? email.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    let user = await User.findOne({
      $or: [{ email: normalizedEmail.toLowerCase() }, { phone: normalizedPhone }],
    });
    let tempPassword: string | undefined;
    let createdUser = false;

    if (user) {
      if (user.role === "Coach") {
        const existingCoach = await Coach.findOne({ userId: user._id });
        if (existingCoach) {
          res.status(409).json({
            success: false,
            message: "Coach profile already exists for this account",
            existingRole: user.role,
            targetRole: "Coach",
            existingUser: buildUserSummary(user),
          });
          return;
        }
      } else if (user.role === "Player" || user.role === "Parent") {
        if (!convertExistingUser) {
          res.status(409).json({
            success: false,
            message: "User already exists as PLAYER. Convert this account to COACH to continue.",
            requiresConversion: true,
            existingRole: user.role,
            targetRole: "Coach",
            existingUser: buildUserSummary(user),
          });
          return;
        }

        user.role = "Coach";
        await user.save();
      } else {
        res.status(409).json({
          success: false,
          message:
            "An account already exists with a different role. Coach accounts must be separate.",
          requiresSeparateAccount: true,
          existingRole: user.role,
          targetRole: "Coach",
          existingUser: buildUserSummary(user),
        });
        return;
      }
    } else {
      tempPassword = generateTempPassword(12);
      const newUser = new User({
        name: `${firstName} ${lastName}`,
        email: normalizedEmail,
        phone: normalizedPhone,
        role: "Coach",
        isActive: true,
        password: tempPassword, // Will be hashed by schema middleware
      });

      user = await newUser.save();
      createdUser = true;
    }

    if (profilePhotoUrl || profilePhotoKey) {
      user.photoUrl = profilePhotoUrl || user.photoUrl;
      user.photoS3Key = profilePhotoKey || user.photoS3Key;
      await user.save();
    }

    const normalizedOwnVenueDetails =
      ownVenueDetails && typeof ownVenueDetails === "object"
        ? {
            name: ownVenueDetails.name,
            address: ownVenueDetails.address,
            description: ownVenueDetails.description || "",
            openingHours: ownVenueDetails.openingHours || "",
            images: ownVenueDetails.images || [],
            imageS3Keys: ownVenueDetails.imageS3Keys || [],
            location:
              ownVenueDetails.location || ownVenueDetails.coordinates
                ? {
                    type: "Point",
                    coordinates:
                      ownVenueDetails.location?.coordinates || ownVenueDetails.coordinates,
                  }
                : undefined,
            sports,
            amenities: [],
            pricePerHour: hourlyRate,
          }
        : undefined;

    // Create coach profile
    const newCoach = new Coach({
      userId: user._id,
      bio,
      sports,
      hourlyRate,
      sportPricing: sportPricing || {},
      serviceMode: serviceMode || "FREELANCE",
      baseLocation,
      serviceRadiusKm,
      travelBufferTime,
      ...(normalizedOwnVenueDetails ? { ownVenueDetails: normalizedOwnVenueDetails } : {}),
      venueId: venueId || undefined,
      verificationStatus: verificationStatus || "VERIFIED",
      isVerified: (verificationStatus || "VERIFIED") === "VERIFIED",
      createdBy: req.user.id,
    });

    const coach = await newCoach.save();

    if (createdUser && tempPassword) {
      try {
        await sendCoachAdminCredentialsEmail({
          name: user.name,
          email: user.email,
          password: tempPassword,
          loginUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
        });
      } catch (emailError) {
        log.error("Failed to send coach credentials email:", emailError);
      }
    }

    // Send in-app notification
    try {
      NotificationService.send({
        userId: user._id.toString(),
        type: "COACH_VERIFICATION_VERIFIED",
        title: "Welcome to PowerMySport",
        message: "Your coach account has been created and verified successfully.",
        data: {
          coachId: coach._id.toString(),
          createdAt: new Date().toISOString(),
        },
      }).catch((err: Error) => log.error("Failed to send coach creation notification:", err));
    } catch (notificationError) {
      log.error("Failed to send in-app notification:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Coach created successfully",
      data: { coach, user },
    });
  }
);
