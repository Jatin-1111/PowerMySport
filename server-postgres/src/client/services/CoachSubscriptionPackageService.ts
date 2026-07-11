import type {
  CoachSubscriptionPackage,
  SubscriptionFrequency,
} from "@prisma/client";
import prisma from "../../lib/prisma";

// Legacy alias — the Mongoose document type is replaced by the Prisma row type.
type CoachSubscriptionPackageDocument = CoachSubscriptionPackage;
export type { SubscriptionFrequency };

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

  return prisma.coachSubscriptionPackage.create({
    data: {
      coachId: payload.coachId,
      name: payload.name.trim(),
      description: payload.description?.trim() || "",
      frequency: payload.frequency,
      price: payload.price,
      features: payload.features || [],
      maxStudents: payload.maxStudents !== undefined ? payload.maxStudents : null,
      maxSessions: payload.maxSessions !== undefined ? payload.maxSessions : null,
      isActive: payload.isActive !== false,
    },
  });
};

/**
 * Get all active packages for a coach
 */
export const getCoachSubscriptionPackages = async (
  coachId: string,
  options?: { isActive?: boolean },
): Promise<CoachSubscriptionPackageDocument[]> => {
  const where: { coachId: string; isActive?: boolean } = { coachId };

  if (typeof options?.isActive === "boolean") {
    where.isActive = options.isActive;
  }

  return prisma.coachSubscriptionPackage.findMany({
    where,
    orderBy: [
      { isActive: "desc" },
      { frequency: "asc" },
      { createdAt: "desc" },
    ],
  });
};

/**
 * Get a specific package by ID
 */
export const getCoachSubscriptionPackageById = async (
  packageId: string,
): Promise<CoachSubscriptionPackageDocument | null> => {
  return prisma.coachSubscriptionPackage.findUnique({
    where: { id: packageId },
  });
};

/**
 * Get package with coach info
 */
export const getCoachSubscriptionPackageWithCoach = async (
  packageId: string,
): Promise<CoachSubscriptionPackageDocument | null> => {
  // NOTE: CoachSubscriptionPackage.coachId is a plain String FK (no Prisma
  // relation defined), so the old .populate("coachId", ...) is done as a
  // second lookup and attached in code to preserve the return shape.
  const pkg = await prisma.coachSubscriptionPackage.findUnique({
    where: { id: packageId },
  });
  if (!pkg) return null;

  const coach = await prisma.coach.findUnique({
    where: { id: pkg.coachId },
    select: { id: true, bio: true, sports: true, rating: true, reviewCount: true },
  });

  return { ...pkg, coachId: coach ?? pkg.coachId } as unknown as CoachSubscriptionPackageDocument;
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

  const updateData: Record<string, unknown> = {};

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

  // findByIdAndUpdate returned null when the doc was missing; mirror that by
  // guarding against Prisma's throw-on-missing update.
  const existing = await prisma.coachSubscriptionPackage.findUnique({
    where: { id: packageId },
  });
  if (!existing) return null;

  return prisma.coachSubscriptionPackage.update({
    where: { id: packageId },
    data: updateData,
  });
};

/**
 * Delete a subscription package
 */
export const deleteCoachSubscriptionPackage = async (
  packageId: string,
): Promise<boolean> => {
  const result = await prisma.coachSubscriptionPackage.deleteMany({
    where: { id: packageId },
  });
  return result.count > 0;
};

/**
 * Get packages by frequency
 */
export const getCoachPackagesByFrequency = async (
  coachId: string,
  frequency: SubscriptionFrequency,
): Promise<CoachSubscriptionPackageDocument | null> => {
  return prisma.coachSubscriptionPackage.findFirst({
    where: {
      coachId,
      frequency,
      isActive: true,
    },
  });
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
  const packages = await prisma.coachSubscriptionPackage.findMany({
    where: {
      coachId,
      isActive: true,
    },
  });

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
  return prisma.coachSubscriptionPackage.count({
    where: {
      coachId,
      isActive: true,
    },
  });
};

/**
 * Validate coach owns this package
 */
export const validateCoachOwnsPackage = async (
  coachId: string,
  packageId: string,
): Promise<boolean> => {
  const result = await prisma.coachSubscriptionPackage.findFirst({
    where: {
      id: packageId,
      coachId,
    },
    select: { id: true },
  });
  return !!result;
};

export type { CoachSubscriptionPackageDocument };
