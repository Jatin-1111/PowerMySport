import mongoose from "mongoose";
import { Booking } from "../../../client/models/Booking";
import { Player } from "../../../client/models/Player";
import { User, UserDocument } from "../../../client/models/User";
import { sendWelcomeEmail } from "../../../utils/email";
import { log } from "./shared";

export interface GraduateDependentPayload {
  parentId: string;
  dependentId: string;
  email: string;
  password: string;
  phone: string;
}

/**
 * Graduate a dependent (child) to an independent user account
 * This function uses a transaction to ensure data integrity
 * ALL bookings where the dependent is the participant are transferred to the new user
 */
export const graduateDependent = async (
  payload: GraduateDependentPayload
): Promise<UserDocument> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the parent user
    const parent = await User.findById(payload.parentId).session(session);
    if (!parent) {
      throw new Error("Parent user not found");
    }

    const dependent = await Player.findOne({
      _id: payload.dependentId,
      userId: payload.parentId,
      type: "DEPENDENT",
    }).session(session);

    if (!dependent) {
      throw new Error("Dependent not found");
    }

    // Check if dependent is at least 18 years old
    if (dependent.age && dependent.age < 18) {
      throw new Error("Dependent must be at least 18 years old to graduate");
    }

    // Check if email or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email: payload.email }, { phone: payload.phone }],
    }).session(session);
    if (existingUser) {
      throw new Error("User with this email or phone already exists");
    }

    // Create new independent user account
    const newUser = new User({
      name: dependent.name,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
      role: "Player",
    });
    await newUser.save({ session });

    // Transfer all bookings where this dependent was the participant
    const dependentObjectId = dependent._id;
    const result = await Booking.updateMany(
      { participantId: dependentObjectId },
      {
        $set: {
          userId: newUser._id,
        },
        $unset: {
          participantId: "",
        },
      },
      { session }
    );

    log.info(`Transferred ${result.modifiedCount} bookings to new user`);

    // Remove the dependent from Player collection
    await Player.deleteOne({ _id: dependent._id }).session(session);

    // Commit the transaction
    await session.commitTransaction();

    // Send welcome email to the new adult user
    sendWelcomeEmail({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    }).catch((error) => {
      log.error("Failed to send welcome email:", error);
    });

    return newUser;
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export interface AddDependentPayload {
  name: string;
  age?: number;
  dob?: string | Date;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sportsFocus?: string[];
  sports?: string[];
  skillLevel?: string;
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
  heightCm?: number;
  weightKg?: number;
  medicalConditions?: string[];
  // Wizard physical
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";
  // Wizard personality
  teamIndividual?: number;
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  // Wizard comfort
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  // Wizard practical
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "career" | "professional";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  experienceLevel?: "beginner" | "intermediate" | "competitive";
  trainingType?: "self" | "club" | "academy" | "private";
  consideringSports?: string[];
  // Build-the-profile: current standing / track record
  currentStandingTier?: number;
  bestResultTier?: number;
  achievementsNote?: string;
  // Build-the-profile: training setup
  academyName?: string;
  sessionsPerWeek?: number;
  trainingMonths?: number;
  wizardCity?: string;
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: string | Date;
  /** The sport the parent committed to on the results page — a decision, not a score. */
  chosenSport?: string;
  chosenSportAt?: string | Date;
}

function calculateAge(dob: Date): number {
  const ageDifMs = Date.now() - dob.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export const addDependent = async (userId: string, payload: AddDependentPayload): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "Player") {
    throw new Error("Only Parent profiles can add dependents. Please upgrade your profile first.");
  }

  let age = payload.age;
  let parsedDob: Date | undefined;

  if (payload.dob) {
    parsedDob = new Date(payload.dob);
    if (!isNaN(parsedDob.getTime())) {
      age = calculateAge(parsedDob);
    }
  }

  const newDependent = new Player({
    userId: user._id,
    type: "DEPENDENT",
    name: payload.name,
    age: age,
    dob: parsedDob,
    gender: payload.gender,
    relation: payload.relation,
    sportsFocus: payload.sportsFocus || payload.sports || [],
    skillLevel: payload.skillLevel || "",
    yearsPlaying: payload.yearsPlaying,
    personalityTags: payload.personalityTags,
    primaryObjective: payload.primaryObjective,
    weeklyTimeCommitment: payload.weeklyTimeCommitment,
    budgetTier: payload.budgetTier,
    location: payload.location,
    heightCm: payload.heightCm,
    weightKg: payload.weightKg,
    medicalConditions: payload.medicalConditions || [],
    // Wizard physical
    build: payload.build,
    heightCategory: payload.heightCategory,
    energyType: payload.energyType,
    motorType: payload.motorType,
    visualTracking: payload.visualTracking,
    eyesight: payload.eyesight,
    agility: payload.agility,
    // Wizard personality
    teamIndividual: payload.teamIndividual,
    competitiveResponse: payload.competitiveResponse,
    focusStyle: payload.focusStyle,
    decisionStyle: payload.decisionStyle,
    pressureResponse: payload.pressureResponse,
    repetitionTolerance: payload.repetitionTolerance,
    // Wizard comfort
    contactComfort: payload.contactComfort,
    environment: payload.environment,
    waterComfort: payload.waterComfort,
    // Wizard practical
    budgetRange: payload.budgetRange,
    ambition: payload.ambition,
    weeklyHoursCategory: payload.weeklyHoursCategory,
    experienceLevel: payload.experienceLevel,
    trainingType: payload.trainingType,
    consideringSports: payload.consideringSports,
    // Build-the-profile: current standing / track record
    currentStandingTier: payload.currentStandingTier,
    bestResultTier: payload.bestResultTier,
    achievementsNote: payload.achievementsNote,
    // Build-the-profile: training setup
    academyName: payload.academyName,
    sessionsPerWeek: payload.sessionsPerWeek,
    trainingMonths: payload.trainingMonths,
    // Wizard results
    sportMatches: payload.sportMatches,
    wizardCompletedAt: payload.wizardCompletedAt ? new Date(payload.wizardCompletedAt) : undefined,
    // Carried over when a guest picked a sport before registering
    chosenSport: payload.chosenSport,
    chosenSportAt: payload.chosenSportAt ? new Date(payload.chosenSportAt) : undefined,
  });

  await newDependent.save();
  return newDependent;
};

export const updateDependent = async (
  userId: string,
  dependentId: string,
  payload: Partial<AddDependentPayload>
): Promise<any> => {
  const dependent = await Player.findOne({
    _id: dependentId,
    userId,
    type: "DEPENDENT",
  });
  if (!dependent) {
    throw new Error("Dependent not found");
  }

  if (payload.name) dependent.name = payload.name;

  if (payload.dob) {
    const parsedDob = new Date(payload.dob);
    if (!isNaN(parsedDob.getTime())) {
      dependent.dob = parsedDob;
      dependent.age = calculateAge(parsedDob);
    }
  } else if (payload.age !== undefined) {
    dependent.age = payload.age;
  }

  if (payload.gender) dependent.gender = payload.gender;
  if (payload.relation) dependent.relation = payload.relation;
  if (payload.sportsFocus) dependent.sportsFocus = payload.sportsFocus;
  if (payload.sports) dependent.sportsFocus = payload.sports;
  if (payload.skillLevel) dependent.skillLevel = payload.skillLevel;
  if (payload.yearsPlaying !== undefined) dependent.yearsPlaying = payload.yearsPlaying;
  if (payload.personalityTags) dependent.personalityTags = payload.personalityTags;
  if (payload.primaryObjective) dependent.primaryObjective = payload.primaryObjective;
  if (payload.weeklyTimeCommitment !== undefined)
    dependent.weeklyTimeCommitment = payload.weeklyTimeCommitment;
  if (payload.budgetTier) dependent.budgetTier = payload.budgetTier;
  if (payload.location !== undefined) dependent.location = payload.location;
  if (payload.heightCm !== undefined) (dependent as any).heightCm = payload.heightCm;
  if (payload.weightKg !== undefined) (dependent as any).weightKg = payload.weightKg;
  if (payload.medicalConditions !== undefined)
    (dependent as any).medicalConditions = payload.medicalConditions;
  // Wizard physical
  if (payload.build !== undefined) (dependent as any).build = payload.build;
  if (payload.heightCategory !== undefined)
    (dependent as any).heightCategory = payload.heightCategory;
  if (payload.energyType !== undefined) (dependent as any).energyType = payload.energyType;
  if (payload.motorType !== undefined) (dependent as any).motorType = payload.motorType;
  if (payload.visualTracking !== undefined)
    (dependent as any).visualTracking = payload.visualTracking;
  // Wizard personality
  if (payload.teamIndividual !== undefined)
    (dependent as any).teamIndividual = payload.teamIndividual;
  if (payload.competitiveResponse !== undefined)
    (dependent as any).competitiveResponse = payload.competitiveResponse;
  if (payload.focusStyle !== undefined) (dependent as any).focusStyle = payload.focusStyle;
  if (payload.decisionStyle !== undefined) (dependent as any).decisionStyle = payload.decisionStyle;
  if (payload.pressureResponse !== undefined)
    (dependent as any).pressureResponse = payload.pressureResponse;
  if (payload.repetitionTolerance !== undefined)
    (dependent as any).repetitionTolerance = payload.repetitionTolerance;
  // Wizard comfort
  if (payload.contactComfort !== undefined)
    (dependent as any).contactComfort = payload.contactComfort;
  if (payload.environment !== undefined) (dependent as any).environment = payload.environment;
  if (payload.waterComfort !== undefined) (dependent as any).waterComfort = payload.waterComfort;
  // Wizard practical
  if (payload.budgetRange !== undefined) (dependent as any).budgetRange = payload.budgetRange;
  if (payload.ambition !== undefined) (dependent as any).ambition = payload.ambition;
  if (payload.weeklyHoursCategory !== undefined)
    (dependent as any).weeklyHoursCategory = payload.weeklyHoursCategory;
  if (payload.experienceLevel !== undefined)
    (dependent as any).experienceLevel = payload.experienceLevel;
  if (payload.trainingType !== undefined) (dependent as any).trainingType = payload.trainingType;
  if (payload.consideringSports !== undefined)
    (dependent as any).consideringSports = payload.consideringSports;
  // Build-the-profile: current standing / track record
  if (payload.currentStandingTier !== undefined)
    (dependent as any).currentStandingTier = payload.currentStandingTier;
  if (payload.bestResultTier !== undefined)
    (dependent as any).bestResultTier = payload.bestResultTier;
  if (payload.achievementsNote !== undefined)
    (dependent as any).achievementsNote = payload.achievementsNote;
  // Build-the-profile: training setup
  if (payload.academyName !== undefined) (dependent as any).academyName = payload.academyName;
  if (payload.sessionsPerWeek !== undefined)
    (dependent as any).sessionsPerWeek = payload.sessionsPerWeek;
  if (payload.trainingMonths !== undefined)
    (dependent as any).trainingMonths = payload.trainingMonths;
  if (payload.wizardCity !== undefined) (dependent as any).wizardCity = payload.wizardCity;
  if (payload.sportMatches !== undefined) (dependent as any).sportMatches = payload.sportMatches;
  if (payload.wizardCompletedAt !== undefined) {
    const d = new Date(payload.wizardCompletedAt);
    if (!isNaN(d.getTime())) (dependent as any).wizardCompletedAt = d;
  }
  if (payload.chosenSport !== undefined) (dependent as any).chosenSport = payload.chosenSport;
  if (payload.chosenSportAt !== undefined) {
    const d = new Date(payload.chosenSportAt);
    if (!isNaN(d.getTime())) (dependent as any).chosenSportAt = d;
  }

  await dependent.save();
  return dependent;
};

export const deleteDependent = async (userId: string, dependentId: string): Promise<void> => {
  const dependent = await Player.findOne({
    _id: dependentId,
    userId,
    type: "DEPENDENT",
  });
  if (!dependent) {
    throw new Error("Dependent not found");
  }

  const bookingCount = await Booking.countDocuments({
    participantId: dependentId,
  });

  if (bookingCount > 0) {
    throw new Error(
      `Cannot delete dependent with ${bookingCount} active booking(s). Please cancel or complete these bookings first.`
    );
  }

  await Player.deleteOne({ _id: dependentId });
};

export const getPlayersByUserId = async (userId: string): Promise<any[]> => {
  return Player.find({ userId }).sort({ type: -1, name: 1 });
};
