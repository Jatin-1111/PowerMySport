import { Request, Response } from "express";
import { Booking } from "../models/Booking";
import { User } from "../models/User";
import {
  checkCoachAvailability,
  createCoach,
  deleteCoach,
  findCoachesNearby,
  getAllCoaches,
  getCoachById,
  getCoachByUserId,
  submitCoachVerification,
  updateCoach,
} from "../services/CoachService";
import { doTimesOverlap } from "../utils/booking";
import { transformDocument } from "../middleware/responseTransform";
import { getPaginationParams } from "../utils/pagination";

interface CoachDiscoveryContext {
  page: number;
  limit: number;
  sportFilter: string | undefined;
  latitude: number | undefined;
  longitude: number | undefined;
  radiusMeters: number;
  hasLocation: boolean;
}

const buildCoachDiscoveryContext = (req: Request): CoachDiscoveryContext => {
  const lat = (req.query.lat || req.query.latitude) as string | undefined;
  const lng = (req.query.lng || req.query.longitude) as string | undefined;
  const radius = (req.query.radius || req.query.maxDistance) as
    | string
    | undefined;
  const { sport } = req.query;

  const sportFilter = sport as string | undefined;
  const { page, limit } = getPaginationParams(
    req.query.page,
    req.query.limit,
    20,
    100,
  );

  const hasLocation = Boolean(lat && lng);
  const latitude = hasLocation ? parseFloat(lat as string) : undefined;
  const longitude = hasLocation ? parseFloat(lng as string) : undefined;

  return {
    page,
    limit,
    sportFilter,
    latitude,
    longitude,
    radiusMeters: radius ? parseInt(radius as string, 10) : 5000,
    hasLocation,
  };
};

/**
 * Discovery endpoint: Search for coaches near a location
 * GET /api/coaches/discover?lat=28.6139&lng=77.2090&radius=5000&sport=cricket
 */
export const discoverCoachesNearby = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const requestStartedAt = Date.now();
    const context = buildCoachDiscoveryContext(req);

    const startedAt = Date.now();
    const coaches =
      !context.hasLocation ||
      context.latitude === undefined ||
      context.longitude === undefined
        ? await getAllCoaches(context.sportFilter, context.limit)
        : await findCoachesNearby(
            context.latitude,
            context.longitude,
            context.radiusMeters / 1000,
            context.sportFilter,
            context.limit,
          );
    const coachesFetchMs = Date.now() - startedAt;
    const totalDurationMs = Date.now() - requestStartedAt;

    console.info(
      "[discoverCoachesNearby]",
      JSON.stringify({
        hasLocation: context.hasLocation,
        radiusMeters: context.radiusMeters,
        sportFilter: context.sportFilter || null,
        page: context.page,
        limit: context.limit,
        coachCount: coaches.length,
        coachesFetchMs,
        totalDurationMs,
      }),
    );

    res.status(200).json({
      success: true,
      message: "Coach discovery results retrieved successfully",
      data: {
        coaches,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Coach discovery failed",
    });
  }
};

/**
 * Create a new coach profile
 * POST /api/coaches
 */
export const createNewCoach = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Validate required fields
    const { bio, certifications, sports, hourlyRate, serviceMode } = req.body;

    if (!serviceMode) {
      res.status(400).json({
        success: false,
        message: "Service mode is required",
      });
      return;
    }

    if (!sports || !Array.isArray(sports) || sports.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one sport is required",
      });
      return;
    }

    // Check if user already has a coach profile
    const existingCoach = await getCoachByUserId(req.user.id);
    if (existingCoach) {
      res.status(400).json({
        success: false,
        message: "Coach profile already exists for this user",
      });
      return;
    }

    const coach = await createCoach({
      userId: req.user.id,
      ...req.body,
    });

    console.log("Created coach:", {
      id: coach.id,
      serviceMode: coach.serviceMode,
    });

    // Convert to JSON and transform _id to id
    const coachData = transformDocument(coach.toJSON());

    console.log("Coach JSON response:", {
      id: coachData.id,
      serviceMode: coachData.serviceMode,
    });

    res.status(201).json({
      success: true,
      message: "Coach profile created successfully",
      data: coachData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create coach profile",
    });
  }
};

/**
 * Get coach profile by ID
 * GET /api/coaches/:coachId
 */
export const getCoach = async (req: Request, res: Response): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    const coach = await getCoachById(coachId);

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    const isPubliclyVisible =
      coach.isVerified || coach.verificationStatus === "VERIFIED";

    if (!isPubliclyVisible) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    // Convert to JSON and transform _id to id
    const coachData = transformDocument(coach.toJSON());

    res.status(200).json({
      success: true,
      message: "Coach retrieved successfully",
      data: coachData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch coach",
    });
  }
};

/**
 * Get current user's coach profile
 * GET /api/coaches/my-profile
 */
export const getMyCoachProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const coach = await getCoachByUserId(req.user.id);

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    // Convert to JSON and transform _id to id
    const coachData = transformDocument(coach.toJSON());

    console.log("getMyCoachProfile returning:", {
      id: coachData.id,
      serviceMode: coachData.serviceMode,
    });

    res.status(200).json({
      success: true,
      message: "Coach profile retrieved successfully",
      data: coachData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch coach profile",
    });
  }
};

/**
 * Update coach availability by sport
 * PUT /api/coaches/my-profile/availability
 */
export const updateMyCoachAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const { availabilityBySport } = req.body as {
      availabilityBySport?: Record<
        string,
        Array<{ dayOfWeek: number; startTime: string; endTime: string }>
      >;
    };

    if (!availabilityBySport || typeof availabilityBySport !== "object") {
      res.status(400).json({
        success: false,
        message: "availabilityBySport is required",
      });
      return;
    }

    const coach = await getCoachByUserId(req.user.id);
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const normalizedBySport: Record<
      string,
      Array<{ dayOfWeek: number; startTime: string; endTime: string }>
    > = {};

    for (const [sport, slots] of Object.entries(availabilityBySport)) {
      normalizedBySport[sport] = (slots || [])
        .map((slot) => ({
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: String(slot.startTime),
          endTime: String(slot.endTime),
        }))
        .filter(
          (slot) =>
            Number.isInteger(slot.dayOfWeek) &&
            slot.dayOfWeek >= 0 &&
            slot.dayOfWeek <= 6 &&
            /^([01]\d|2[0-3]):([0-5]\d)$/.test(slot.startTime) &&
            /^([01]\d|2[0-3]):([0-5]\d)$/.test(slot.endTime) &&
            slot.startTime < slot.endTime,
        );
    }

    const flattened = Object.values(normalizedBySport).flat();

    const coachId = (coach.id || coach._id.toString()) as string;
    const updated = await updateCoach(coachId, {
      availabilityBySport: normalizedBySport,
      availability: flattened,
    });

    res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      data: transformDocument(updated?.toJSON()),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update coach availability",
    });
  }
};

/**
 * Update coach profile
 * PUT /api/coaches/:coachId
 */
export const updateCoachProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    // Validate coachId is provided and is a valid MongoDB ObjectId
    if (!coachId || coachId === "undefined") {
      res.status(400).json({
        success: false,
        message: "Invalid coach ID provided",
      });
      return;
    }

    // Verify ownership
    const existingCoach = await getCoachById(coachId);
    if (!existingCoach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    // Handle both populated userId (object) and unpopulated userId (ObjectId)
    const userId = existingCoach.userId as any;
    const coachUserId =
      typeof userId === "object" && userId !== null
        ? userId._id?.toString() || userId.id
        : userId.toString();

    if (coachUserId !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: "You can only update your own coach profile",
      });
      return;
    }

    // Handle ownVenueDetails validation and preservation
    const updates = { ...req.body };
    const newServiceMode = updates.serviceMode || existingCoach.serviceMode;

    // Handle service mode specific logic
    if (newServiceMode === "OWN_VENUE" || newServiceMode === "HYBRID") {
      // For OWN_VENUE/HYBRID modes: preserve existing ownVenueDetails if not providing new ones
      if (!updates.ownVenueDetails && existingCoach.ownVenueDetails) {
        updates.ownVenueDetails = existingCoach.ownVenueDetails;
      }
      // If no ownVenueDetails provided, that's ok - they can add them later
    } else if (newServiceMode === "FREELANCE") {
      // For FREELANCE mode: clear ownVenueDetails if switching from OWN_VENUE/HYBRID
      if (
        existingCoach.serviceMode !== "FREELANCE" &&
        !updates.ownVenueDetails
      ) {
        updates.ownVenueDetails = undefined;
      }
    }

    const coach = await updateCoach(coachId, updates);

    // Convert to JSON and transform _id to id
    const coachData = transformDocument(coach?.toJSON());

    res.status(200).json({
      success: true,
      message: "Coach profile updated successfully",
      data: coachData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update coach profile",
    });
  }
};

/**
 * Delete coach profile
 * DELETE /api/coaches/:coachId
 */
export const deleteCoachProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    // Verify ownership
    const existingCoach = await getCoachById(coachId);
    if (!existingCoach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    // Handle both populated userId (object) and unpopulated userId (ObjectId)
    const userId = existingCoach.userId as any;
    const coachUserId =
      typeof userId === "object" && userId !== null
        ? userId._id?.toString() || userId.id
        : userId.toString();

    if (coachUserId !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: "You can only delete your own coach profile",
      });
      return;
    }

    await deleteCoach(coachId);

    res.status(200).json({
      success: true,
      message: "Coach profile deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete coach profile",
    });
  }
};

/**
 * Check coach availability
 * GET /api/coaches/availability/:coachId
 */
export const getCoachAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const { date, startTime, endTime, sport } = req.query;

    if (!date) {
      res.status(400).json({
        success: false,
        message: "date is required",
      });
      return;
    }

    if (startTime && endTime) {
      const available = await checkCoachAvailability(
        coachId,
        new Date(date as string),
        startTime as string,
        endTime as string,
      );

      res.status(200).json({
        success: true,
        message: "Availability checked successfully",
        data: {
          available,
        },
      });
      return;
    }

    const coach = await getCoachById(coachId);
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    const targetDate = new Date(date as string);
    const dayOfWeek = targetDate.getDay();
    const availabilityBySport = (coach as any).availabilityBySport as
      | Record<
          string,
          Array<{ dayOfWeek: number; startTime: string; endTime: string }>
        >
      | undefined;

    const selectedSport = typeof sport === "string" ? sport : undefined;
    const sourceSlots =
      (selectedSport && availabilityBySport?.[selectedSport]) ||
      coach.availability ||
      [];

    const daySlots = sourceSlots.filter((slot) => slot.dayOfWeek === dayOfWeek);

    const toMinutes = (time: string) => {
      const [hh = "0", mm = "0"] = time.split(":");
      return Number(hh) * 60 + Number(mm);
    };

    const toTime = (minutes: number) => {
      const hrs = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");
      const mins = (minutes % 60).toString().padStart(2, "0");
      return `${hrs}:${mins}`;
    };

    const candidateSlots: string[] = [];
    daySlots.forEach((slot) => {
      const startMinutes = toMinutes(slot.startTime);
      const endMinutes = toMinutes(slot.endTime);
      for (
        let current = startMinutes;
        current + 60 <= endMinutes;
        current += 60
      ) {
        const start = toTime(current);
        const end = toTime(current + 60);
        candidateSlots.push(`${start}-${end}`);
      }
    });

    const activeBookings = await Booking.find({
      coachId,
      date: {
        $gte: new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
        ),
        $lt: new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate() + 1,
        ),
      },
      status: { $in: ["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS"] },
    }).select("startTime endTime");

    const bookedSlots = activeBookings.map((booking) => ({
      startTime: booking.startTime,
      endTime: booking.endTime,
    }));

    const now = new Date();
    const isToday =
      targetDate.getFullYear() === now.getFullYear() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() === now.getDate();

    const availableSlots = candidateSlots.filter((slot) => {
      const [slotStart = "00:00", slotEnd = "00:00"] = slot.split("-");

      // Filter out past time slots for today
      if (isToday) {
        const [startHour = "0", startMinute = "0"] = slotStart.split(":");
        const slotStartDateTime = new Date(targetDate);
        slotStartDateTime.setHours(
          parseInt(startHour, 10),
          parseInt(startMinute, 10),
          0,
          0,
        );

        // If the slot has already started, don't show it
        if (slotStartDateTime <= now) {
          return false;
        }
      }

      return !bookedSlots.some((booked) =>
        doTimesOverlap(slotStart, slotEnd, booked.startTime, booked.endTime),
      );
    });

    res.status(200).json({
      success: true,
      message: "Availability retrieved successfully",
      data: {
        availableSlots,
        bookedSlots,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to check availability",
    });
  }
};

const normalizeVerificationDocuments = (
  documents?: Array<{
    type: string;
    url: string;
    s3Key?: string;
    fileName: string;
    uploadedAt?: string | Date;
  }>,
) => {
  const allowedTypes = [
    "CERTIFICATION",
    "ID_PROOF",
    "ADDRESS_PROOF",
    "BACKGROUND_CHECK",
    "INSURANCE",
    "OTHER",
  ] as const;

  const normalizedDocs = (documents || []).map((doc) => {
    if (!allowedTypes.includes(doc.type as (typeof allowedTypes)[number])) {
      throw new Error("Invalid document type");
    }
    if (!doc.url || !doc.fileName) {
      throw new Error("Document url and fileName are required");
    }

    return {
      type: doc.type as (typeof allowedTypes)[number],
      url: doc.url,
      fileName: doc.fileName,
      ...(doc.s3Key ? { s3Key: doc.s3Key } : {}),
      ...(doc.uploadedAt
        ? { uploadedAt: new Date(doc.uploadedAt) }
        : { uploadedAt: new Date() }),
    };
  });

  return normalizedDocs;
};

const hasValidBio = (bio?: string) => Boolean(bio && bio.trim().length > 0);

const hasValidMobileNumber = (mobileNumber?: string) => {
  if (!mobileNumber || !mobileNumber.trim()) {
    return false;
  }

  return /^[+]?[0-9\s().\-]+$/.test(mobileNumber.trim());
};

const hasCoordinates = (
  coordinates?: unknown,
): coordinates is [number, number] => {
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  );
};

const hasStep1Completed = async (userId: string, bioCandidate?: string) => {
  const [existingUser, existingCoach] = await Promise.all([
    User.findById(userId).select("phone photoUrl"),
    getCoachByUserId(userId),
  ]);

  const phoneFromUser = existingUser?.phone;
  const photoFromUser = existingUser?.photoUrl;
  const bioFromCoach = existingCoach?.bio;

  return (
    Boolean(photoFromUser?.trim()) &&
    hasValidMobileNumber(phoneFromUser) &&
    hasValidBio(bioCandidate || bioFromCoach)
  );
};

/**
 * Save coach verification step 1 (Bio)
 * POST /api/coaches/verification/step1
 */
export const saveCoachVerificationStep1Handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({ success: false, message: "Coach role required" });
      return;
    }

    const { bio, mobileNumber } = req.body as {
      bio: string;
      mobileNumber: string;
    };

    if (!hasValidBio(bio)) {
      res.status(400).json({
        success: false,
        message: "Bio is required to complete step 1",
      });
      return;
    }

    if (!hasValidMobileNumber(mobileNumber)) {
      res.status(400).json({
        success: false,
        message: "A valid mobile number is required to complete step 1",
      });
      return;
    }

    const user = await User.findById(req.user.id).select("photoUrl");
    if (!user?.photoUrl?.trim()) {
      res.status(400).json({
        success: false,
        message: "Profile picture is required before continuing",
      });
      return;
    }

    await User.findByIdAndUpdate(req.user.id, { phone: mobileNumber });

    const existingCoach = await getCoachByUserId(req.user.id);

    if (!existingCoach) {
      res.status(200).json({
        success: true,
        message: "Step 1 captured. Continue to step 2.",
        data: { bio, mobileNumber },
      });
      return;
    }

    const coachId = (existingCoach.id ||
      existingCoach._id?.toString()) as string;
    const coach = await updateCoach(coachId, {
      bio,
      onboardingProgressStep: Math.max(
        Number(existingCoach.onboardingProgressStep || 1),
        1,
      ) as 1 | 2 | 3,
    });

    const coachData = transformDocument(coach?.toJSON());

    res.status(200).json({
      success: true,
      message: "Step 1 saved successfully",
      data: coachData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save verification step 1",
    });
  }
};

/**
 * Save coach verification step 2 (Sports + hourly rate + core profile)
 * POST /api/coaches/verification/step2
 */
export const saveCoachVerificationStep2Handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({ success: false, message: "Coach role required" });
      return;
    }

    const {
      bio,
      sports,
      certifications,
      hourlyRate,
      sportPricing,
      serviceMode,
      baseLocation,
      serviceRadiusKm,
      travelBufferTime,
      ownVenueDetails,
    } = req.body as {
      bio: string;
      sports: string[];
      certifications?: string[];
      hourlyRate: number;
      sportPricing?: Record<string, number>;
      serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
      baseLocation?: {
        type: "Point";
        coordinates: [number, number];
      };
      serviceRadiusKm?: number;
      travelBufferTime?: number;
      ownVenueDetails?: {
        name: string;
        address: string;
        description?: string;
        openingHours?: string;
        images?: string[];
        imageS3Keys?: string[];
        coordinates?: [number, number];
        location?: {
          type: string;
          coordinates: [number, number];
        };
      };
    };

    const step1Completed = await hasStep1Completed(req.user.id, bio);
    if (!step1Completed) {
      res.status(400).json({
        success: false,
        message:
          "Complete step 1 first: profile picture, bio, and valid mobile number are required",
      });
      return;
    }

    if (!Array.isArray(sports) || sports.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one sport is required to complete step 2",
      });
      return;
    }

    if (!Number.isFinite(Number(hourlyRate)) || Number(hourlyRate) <= 0) {
      res.status(400).json({
        success: false,
        message: "A valid hourly rate greater than 0 is required",
      });
      return;
    }

    if (
      serviceMode !== "OWN_VENUE" &&
      serviceMode !== "FREELANCE" &&
      serviceMode !== "HYBRID"
    ) {
      res.status(400).json({
        success: false,
        message: "A valid service mode is required for step 2",
      });
      return;
    }

    const effectiveServiceMode = serviceMode;

    if (
      effectiveServiceMode === "OWN_VENUE" ||
      effectiveServiceMode === "HYBRID"
    ) {
      if (!ownVenueDetails?.name?.trim() || !ownVenueDetails?.address?.trim()) {
        res.status(400).json({
          success: false,
          message:
            "Venue name and address are required for OWN_VENUE or HYBRID mode",
        });
        return;
      }

      const ownVenueCoordinates =
        ownVenueDetails.location?.coordinates || ownVenueDetails.coordinates;
      if (!hasCoordinates(ownVenueCoordinates)) {
        res.status(400).json({
          success: false,
          message:
            "Venue coordinates are required for OWN_VENUE or HYBRID mode",
        });
        return;
      }
    }

    if (effectiveServiceMode !== "OWN_VENUE") {
      if (!hasCoordinates(baseLocation?.coordinates)) {
        res.status(400).json({
          success: false,
          message:
            "Base location coordinates are required for FREELANCE or HYBRID mode",
        });
        return;
      }

      if (
        !Number.isFinite(Number(serviceRadiusKm)) ||
        Number(serviceRadiusKm) <= 0
      ) {
        res.status(400).json({
          success: false,
          message: "Service radius must be a valid number greater than 0",
        });
        return;
      }

      if (
        !Number.isFinite(Number(travelBufferTime)) ||
        Number(travelBufferTime) < 0
      ) {
        res.status(400).json({
          success: false,
          message: "Travel buffer time must be a valid non-negative number",
        });
        return;
      }
    }

    // Build venue details for coach if provided
    let venueDetailsPayload;
    if (
      ownVenueDetails &&
      (serviceMode === "OWN_VENUE" || serviceMode === "HYBRID")
    ) {
      // Validate that coordinates exist
      const coordinates =
        ownVenueDetails.location?.coordinates || ownVenueDetails.coordinates;

      if (
        !coordinates ||
        !Array.isArray(coordinates) ||
        coordinates.length !== 2
      ) {
        res.status(400).json({
          success: false,
          message:
            "Venue coordinates are required and must be [longitude, latitude]",
        });
        return;
      }

      // Pass through the ownVenueDetails as-is, ensuring coordinates are at the right level
      venueDetailsPayload = {
        name: ownVenueDetails.name,
        address: ownVenueDetails.address,
        location: {
          type: "Point",
          coordinates: [Number(coordinates[0]), Number(coordinates[1])],
        },
        sports,
        amenities: [],
        pricePerHour: hourlyRate,
        description: ownVenueDetails.description || "",
        images: ownVenueDetails.images || [],
        imageS3Keys: ownVenueDetails.imageS3Keys || [],
        openingHours: ownVenueDetails.openingHours || "09:00-18:00",
      };
    }

    const existingCoach = await getCoachByUserId(req.user.id);

    if (existingCoach) {
      const coachId = (existingCoach.id ||
        existingCoach._id?.toString()) as string;
      const updatePayload: any = {
        bio,
        sports,
        certifications: certifications || [],
        hourlyRate,
        sportPricing: sportPricing || {},
        serviceMode: serviceMode || existingCoach.serviceMode || "FREELANCE",
        onboardingProgressStep: Math.max(
          Number(existingCoach.onboardingProgressStep || 1),
          2,
        ) as 1 | 2 | 3,
      };

      if (baseLocation) {
        updatePayload.baseLocation = {
          type: "Point",
          coordinates: [
            Number(baseLocation.coordinates[0]),
            Number(baseLocation.coordinates[1]),
          ],
        };
      }

      if (serviceMode !== "OWN_VENUE") {
        updatePayload.serviceRadiusKm = serviceRadiusKm || 10;
        updatePayload.travelBufferTime = travelBufferTime || 30;
      }

      if (venueDetailsPayload) {
        updatePayload.ownVenueDetails = venueDetailsPayload;
      }

      const coach = await updateCoach(coachId, updatePayload);

      const coachData = transformDocument(coach?.toJSON());

      res.status(200).json({
        success: true,
        message: "Step 2 saved successfully",
        data: coachData,
      });
      return;
    }

    const createPayload: any = {
      userId: req.user.id,
      bio,
      sports,
      certifications: certifications || [],
      hourlyRate,
      sportPricing: sportPricing || {},
      serviceMode: serviceMode || "FREELANCE",
      onboardingProgressStep: 2,
      availability: [],
      ...(serviceMode !== "OWN_VENUE" && {
        serviceRadiusKm: serviceRadiusKm || 10,
        travelBufferTime: travelBufferTime || 30,
      }),
    };

    if (baseLocation) {
      createPayload.baseLocation = {
        type: "Point",
        coordinates: [
          Number(baseLocation.coordinates[0]),
          Number(baseLocation.coordinates[1]),
        ],
      };
    }

    if (venueDetailsPayload) {
      createPayload.ownVenueDetails = venueDetailsPayload;
    }

    const coach = await createCoach(createPayload);

    const coachData = transformDocument(coach.toJSON());

    res.status(201).json({
      success: true,
      message: "Step 2 saved successfully",
      data: coachData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save verification step 2",
    });
  }
};

/**
 * Submit coach verification step 3 (Documents)
 * POST /api/coaches/verification/step3
 */
export const submitCoachVerificationStep3Handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const { documents } = req.body as {
      documents?: Array<{
        type: string;
        url: string;
        s3Key?: string;
        fileName: string;
        uploadedAt?: string;
      }>;
    };

    const existingCoach = await getCoachByUserId(req.user.id);
    if (!existingCoach) {
      res.status(400).json({
        success: false,
        message: "Complete step 2 before submitting verification",
      });
      return;
    }

    const step1Completed = await hasStep1Completed(
      req.user.id,
      existingCoach.bio,
    );
    if (!step1Completed) {
      res.status(400).json({
        success: false,
        message:
          "Step 1 is incomplete. Add profile picture, bio, and mobile number first",
      });
      return;
    }

    if (
      !Array.isArray(existingCoach.sports) ||
      existingCoach.sports.length === 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Step 2 is incomplete. Add at least one sport and pricing before submitting",
      });
      return;
    }

    if (
      !Number.isFinite(Number(existingCoach.hourlyRate)) ||
      Number(existingCoach.hourlyRate) <= 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Step 2 is incomplete. Add a valid hourly rate before submitting",
      });
      return;
    }

    const normalizedDocs = normalizeVerificationDocuments(documents);

    const coach = await submitCoachVerification(req.user.id, {
      documents: normalizedDocs,
    });

    const coachData = transformDocument(coach?.toJSON());

    res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      data: coachData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to submit verification",
    });
  }
};

/**
 * Submit coach verification documents
 * POST /api/coaches/verification
 */
export const submitCoachVerificationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await submitCoachVerificationStep3Handler(req, res);
};
/**
 * Get presigned URL for coach verification document upload
 * POST /api/coaches/verification/upload-url
 */
export const getCoachVerificationUploadUrlHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const { fileName, contentType, documentType, purpose } = req.body as {
      fileName?: string;
      contentType?: string;
      documentType?:
        | "CERTIFICATION"
        | "ID_PROOF"
        | "ADDRESS_PROOF"
        | "BACKGROUND_CHECK"
        | "INSURANCE"
        | "OTHER";
      purpose?: "DOCUMENT" | "VENUE_IMAGE";
    };

    if (!fileName || !contentType || !documentType) {
      res.status(400).json({
        success: false,
        message: "fileName, contentType, and documentType are required",
      });
      return;
    }

    const coach = await getCoachByUserId(req.user.id);
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const { S3Service } = require("../services/S3Service");
    const s3Service = new S3Service();
    const uploadData =
      purpose === "VENUE_IMAGE"
        ? await s3Service.generateCoachVenueImageUploadUrl(
            fileName,
            contentType,
            coach._id.toString(),
          )
        : await s3Service.generateCoachVerificationUploadUrl(
            fileName,
            contentType,
            coach._id.toString(),
            documentType,
          );

    res.status(200).json({
      success: true,
      message:
        purpose === "VENUE_IMAGE"
          ? "Venue image upload URL generated"
          : "Verification document upload URL generated",
      data: uploadData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate upload URL",
    });
  }
};
