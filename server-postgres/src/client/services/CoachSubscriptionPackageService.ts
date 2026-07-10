import mongoose from "mongoose";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import {
  SubscriptionFrequency,
  CoachSubscriptionPackageDocument,
} from "../models/CoachSubscriptionPackage";

const toObjectId = (id: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }
  return new mongoose.Types.ObjectId(id);
};

/**
 * Create a new subscription package for a coach
 */
export const createCoachSubscriptionPackage = async (payload: {
  coachId: string;
  name: string;
  description?: string;
  frequency: SubscriptionFrequency;
  price: number;
  features?: string[];
  maxStudents?: number | null;
  maxSessions?: number | null;
  isActive?: boolean;
}): Promise<CoachSubscriptionPackageDocument> => {
  if (payload.price < 0) {
    throw new Error("Price cannot be negative");
  }

  if (!["MONTHLY", "QUARTERLY", "YEARLY"].includes(payload.frequency)) {
    throw new Error("Invalid frequency. Must be MONTHLY, QUARTERLY, or YEARLY");
  }

  return CoachSubscriptionPackage.create({
    coachId: toObjectId(payload.coachId),
    name: payload.name.trim(),
    description: payload.description?.trim() || "",
    frequency: payload.frequency,
    price: payload.price,
    features: payload.features || [],
    maxStudents: payload.maxStudents !== undefined ? payload.maxStudents : null,
    maxSessions: payload.maxSessions !== undefined ? payload.maxSessions : null,
    isActive: payload.isActive !== false,
  });
};

/**
 * Get all active packages for a coach
 */
export const getCoachSubscriptionPackages = async (
  coachId: string,
  options?: { isActive?: boolean },
): Promise<CoachSubscriptionPackageDocument[]> => {
  const filters: Record<string, any> = {
    coachId: toObjectId(coachId),
  };

  if (typeof options?.isActive === "boolean") {
    filters.isActive = options.isActive;
  }

  return CoachSubscriptionPackage.find(filters)
    .sort({ isActive: -1, frequency: 1, createdAt: -1 })
    .lean();
};

/**
 * Get a specific package by ID
 */
export const getCoachSubscriptionPackageById = async (
  packageId: string,
): Promise<CoachSubscriptionPackageDocument | null> => {
  return CoachSubscriptionPackage.findById(toObjectId(packageId)).lean();
};

/**
 * Get package with coach info
 */
export const getCoachSubscriptionPackageWithCoach = async (
  packageId: string,
): Promise<CoachSubscriptionPackageDocument | null> => {
  return CoachSubscriptionPackage.findById(toObjectId(packageId))
    .populate("coachId", "bio sports rating reviewCount")
    .lean();
};

/**
 * Update a subscription package
 */
export const updateCoachSubscriptionPackage = async (
  packageId: string,
  payload: Partial<{
    name: string;
    description: string;
    price: number;
    features: string[];
    maxStudents: number | null;
    maxSessions: number | null;
    isActive: boolean;
  }>,
): Promise<CoachSubscriptionPackageDocument | null> => {
  if (payload.price !== undefined && payload.price < 0) {
    throw new Error("Price cannot be negative");
  }

  const updateData: Record<string, any> = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name.trim();
  }
  if (payload.description !== undefined) {
    updateData.description = payload.description.trim();
  }
  if (payload.price !== undefined) {
    updateData.price = payload.price;
  }
  if (payload.features !== undefined) {
    updateData.features = payload.features;
  }
  if (payload.maxStudents !== undefined) {
    updateData.maxStudents = payload.maxStudents;
  }
  if (payload.maxSessions !== undefined) {
    updateData.maxSessions = payload.maxSessions;
  }
  if (payload.isActive !== undefined) {
    updateData.isActive = payload.isActive;
  }

  return CoachSubscriptionPackage.findByIdAndUpdate(
    toObjectId(packageId),
    updateData,
    { new: true, runValidators: true },
  ).lean();
};

/**
 * Delete a subscription package
 */
export const deleteCoachSubscriptionPackage = async (
  packageId: string,
): Promise<boolean> => {
  const result = await CoachSubscriptionPackage.deleteOne({
    _id: toObjectId(packageId),
  });
  return result.deletedCount > 0;
};

/**
 * Get packages by frequency
 */
export const getCoachPackagesByFrequency = async (
  coachId: string,
  frequency: SubscriptionFrequency,
): Promise<CoachSubscriptionPackageDocument | null> => {
  return CoachSubscriptionPackage.findOne({
    coachId: toObjectId(coachId),
    frequency,
    isActive: true,
  }).lean();
};

/**
 * Get all packages for a coach by frequency
 */
export const getCoachAllPackagesByFrequency = async (
  coachId: string,
): Promise<{
  monthly: CoachSubscriptionPackageDocument | undefined;
  quarterly: CoachSubscriptionPackageDocument | undefined;
  yearly: CoachSubscriptionPackageDocument | undefined;
}> => {
  const packages = await CoachSubscriptionPackage.find({
    coachId: toObjectId(coachId),
    isActive: true,
  }).lean();

  return {
    monthly: packages.find((p) => p.frequency === "MONTHLY"),
    quarterly: packages.find((p) => p.frequency === "QUARTERLY"),
    yearly: packages.find((p) => p.frequency === "YEARLY"),
  };
};

/**
 * Count active packages for a coach
 */
export const countCoachSubscriptionPackages = async (
  coachId: string,
): Promise<number> => {
  return CoachSubscriptionPackage.countDocuments({
    coachId: toObjectId(coachId),
    isActive: true,
  });
};

/**
 * Validate coach owns this package
 */
export const validateCoachOwnsPackage = async (
  coachId: string,
  packageId: string,
): Promise<boolean> => {
  const result = await CoachSubscriptionPackage.exists({
    _id: toObjectId(packageId),
    coachId: toObjectId(coachId),
  });
  return !!result;
};
