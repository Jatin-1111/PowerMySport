import type {
  ChildAmbition,
  ChildBudgetRange,
  ChildExperienceLevel,
  ChildGender,
  ChildTrainingType,
  ChildWeeklyHours,
} from "@powermysport/shared-types";
import mongoose from "mongoose";
import { Booking } from "../../../client/models/Booking";
import { Player, QuizAnswers } from "../../../client/models/Player";
import { User, UserDocument } from "../../../client/models/User";
import { resolveChildAge } from "../../../utils/childAge";
import { MAX_DEPENDENTS_PER_PARENT } from "../../../middleware/schemas";
import { AppError } from "../../../utils/AppError";
import { sendWelcomeEmail } from "../../../utils/email";
import { CHILD_RECORDS } from "./childRecords";
import { log, PARENTAL_CONSENT_VERSION } from "./shared";

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
    }).session(session);

    if (!dependent) {
      throw new Error("Dependent not found");
    }

    // Check if dependent is at least 18 years old
    const currentAge = resolveChildAge(dependent);
    if (currentAge !== null && currentAge < 18) {
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

/** True when the parent has agreed to the current version of the Parental Consent policy. */
export const hasCurrentParentalConsent = (user: UserDocument): boolean => {
  const consent = user.legalConsents?.parentalConsent;
  return consent?.accepted === true && consent.version === PARENTAL_CONSENT_VERSION;
};

/** Records the parent's agreement to the current policy version. */
const recordParentalConsent = async (userId: string | mongoose.Types.ObjectId): Promise<void> => {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "legalConsents.parentalConsent": {
          accepted: true,
          acceptedAt: new Date(),
          version: PARENTAL_CONSENT_VERSION,
        },
      },
    }
  );
};

export interface AddDependentPayload {
  name: string;
  /** The parent ticked the consent box on this request. */
  parentalConsent?: boolean;
  age?: number;
  dob?: string | Date;
  gender?: ChildGender;
  relation?: string;
  sportsFocus?: string[];
  sports?: string[];
  yearsPlaying?: number;
  personalityTags?: string[];
  location?: string;
  /** The quiz answers; merged over any earlier set, and null clears them. */
  quiz?: QuizAnswers | null;
  // Wizard practical
  budgetRange?: ChildBudgetRange;
  ambition?: ChildAmbition;
  weeklyHoursCategory?: ChildWeeklyHours;
  experienceLevel?: ChildExperienceLevel;
  trainingType?: ChildTrainingType;
  consideringSports?: string[];
  // Build-the-profile: current standing / track record
  currentStandingTier?: number;
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: string | Date;
  /** The sport the parent committed to on the results page — a decision, not a score. */
  chosenSport?: string;
  chosenSportAt?: string | Date;
}

export const addDependent = async (userId: string, payload: AddDependentPayload): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "Player") {
    throw new Error("Only Parent profiles can add dependents. Please upgrade your profile first.");
  }

  // A child's details are only taken once the parent has agreed to the Parental
  // Consent policy. 428 tells the client to show the consent box and retry.
  if (!hasCurrentParentalConsent(user)) {
    if (payload.parentalConsent !== true) {
      throw new AppError("Please accept the Parental Consent policy to add a child.", 428);
    }
    await recordParentalConsent(user._id);
  }

  const existing = await Player.countDocuments({ userId: user._id });
  if (existing >= MAX_DEPENDENTS_PER_PARENT) {
    throw new AppError(
      `You can add up to ${MAX_DEPENDENTS_PER_PARENT} child profiles. Remove one to add another.`,
      400
    );
  }

  // The age is worked out from the date of birth when it is read, so it is only
  // stored for a profile that has no date of birth to work it out from.
  let parsedDob: Date | undefined;
  if (payload.dob) {
    const candidate = new Date(payload.dob);
    if (!isNaN(candidate.getTime())) parsedDob = candidate;
  }
  const age = parsedDob ? undefined : payload.age;

  const newDependent = new Player({
    userId: user._id,
    type: "DEPENDENT",
    name: payload.name,
    age: age,
    dob: parsedDob,
    gender: payload.gender,
    relation: payload.relation,
    sportsFocus: payload.sportsFocus || payload.sports || [],
    yearsPlaying: payload.yearsPlaying,
    personalityTags: payload.personalityTags,
    location: payload.location,
    quiz: payload.quiz ?? undefined,
    // Wizard practical
    budgetRange: payload.budgetRange,
    ambition: payload.ambition,
    weeklyHoursCategory: payload.weeklyHoursCategory,
    experienceLevel: payload.experienceLevel,
    trainingType: payload.trainingType,
    consideringSports: payload.consideringSports,
    // Build-the-profile: current standing / track record
    currentStandingTier: payload.currentStandingTier,
    // Build-the-profile: training setup
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
  });
  if (!dependent) {
    throw new Error("Dependent not found");
  }

  // The edit form shows the consent box to a parent who has not agreed yet.
  if (payload.parentalConsent === true) await recordParentalConsent(userId);

  if (payload.name) dependent.name = payload.name;

  if (payload.dob) {
    const parsedDob = new Date(payload.dob);
    if (!isNaN(parsedDob.getTime())) {
      dependent.dob = parsedDob;
      dependent.set("age", undefined);
    }
  } else if (payload.age !== undefined && !dependent.dob) {
    dependent.age = payload.age;
  }

  // An empty string or null clears the field; the enums would reject "" as a value.
  const assign = (field: keyof AddDependentPayload, value: unknown) => {
    if (value === undefined) return;
    dependent.set(field, value === "" || value === null ? undefined : value);
  };
  assign("gender", payload.gender);
  assign("relation", payload.relation);
  if (payload.sportsFocus) dependent.sportsFocus = payload.sportsFocus;
  if (payload.sports) dependent.sportsFocus = payload.sports;
  if (payload.yearsPlaying !== undefined) dependent.yearsPlaying = payload.yearsPlaying;
  if (payload.personalityTags) dependent.personalityTags = payload.personalityTags;
  if (payload.location !== undefined) dependent.location = payload.location;
  // The quiz answers travel together. Answers sent are merged over the stored set,
  // so a flow that only knows height and weight does not wipe the rest; null clears.
  if (payload.quiz !== undefined) {
    const existing = (
      dependent.quiz as unknown as { toObject?: () => object } | undefined
    )?.toObject?.();
    dependent.set("quiz", payload.quiz === null ? undefined : { ...existing, ...payload.quiz });
  }
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
  // Build-the-profile: training setup
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
  });
  if (!dependent) {
    throw new Error("Dependent not found");
  }

  // What happens to everything that names this child is decided in one place, the
  // registry. Protections first, so a refusal leaves the child exactly as it was.
  const context = { userId, child: dependent };
  for (const rule of CHILD_RECORDS) {
    if (rule.action === "protect" && rule.check) await rule.check(context);
  }
  for (const rule of CHILD_RECORDS) {
    if (rule.action === "protect" && rule.settle) await rule.settle(context);
  }

  await Player.deleteOne({ _id: dependentId });

  // Each removal is tried on its own so one failure leaves the rest cleaned: the
  // profile is already gone, so the caller should not be told the deletion failed.
  for (const rule of CHILD_RECORDS) {
    if (rule.action !== "remove") continue;
    try {
      await rule.run(context);
    } catch (error) {
      log.error(`Failed to remove ${rule.model} for deleted dependent:`, error);
    }
  }
};

export const getPlayersByUserId = async (userId: string): Promise<any[]> => {
  return Player.find({ userId }).sort({ type: -1, name: 1 });
};
