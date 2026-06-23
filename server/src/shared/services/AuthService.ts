import crypto from "crypto";
import mongoose from "mongoose";
import { Booking } from "../../client/models/Booking";
import { User, UserDocument } from "../../client/models/User";
import { Player } from "../../client/models/Player";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../../utils/email";
import { S3Service } from "./S3Service";

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "PLAYER" | "VENUE_LISTER" | "COACH";
  userType?: "Parent" | "Recreational" | "Coach" | "Academy" | "Admin";
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}

const LEGAL_POLICY_VERSION = "2026-04";

export interface LoginPayload {
  email: string;
  password: string;
}

export const registerUser = async (
  payload: RegisterPayload,
): Promise<UserDocument> => {
  const existingUser = await User.findOne({
    $or: [{ email: payload.email }, { phone: payload.phone }],
  });

  if (existingUser) {
    throw new Error("User with this email or phone already exists");
  }

  const user = new User({ ...payload });
  const now = new Date();
  user.legalConsents = {
    terms: {
      accepted: payload.acceptedTerms,
      acceptedAt: now,
      version: LEGAL_POLICY_VERSION,
    },
    privacy: {
      accepted: payload.acceptedPrivacy,
      acceptedAt: now,
      version: LEGAL_POLICY_VERSION,
    },
  };
  await user.save();

  // Send welcome email asynchronously (don't wait for it)
  sendWelcomeEmail({
    name: user.name,
    email: user.email,
    role: user.role,
  }).catch((error) => {
    console.error("Failed to send welcome email:", error);
  });

  return user;
};

export const loginUser = async (
  payload: LoginPayload,
): Promise<UserDocument> => {
  const user = await User.findOne({ email: payload.email }).select("+password");

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await user.comparePassword(payload.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  return user;
};

export const getUserById = async (id: string): Promise<UserDocument | null> => {
  return User.findById(id);
};

export const requestPasswordReset = async (email: string): Promise<string> => {
  const user = await User.findOne({ email }).select(
    "+resetPasswordToken +resetPasswordExpires",
  );

  if (!user) {
    // Return the same message as success — never reveal whether the email exists
    return "If this email is registered, you will receive a reset link shortly.";
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

  await user.save();

  // Send password reset email asynchronously
  sendPasswordResetEmail({
    name: user.name,
    email: user.email,
    resetToken,
  }).catch((error) => {
    console.error("Failed to send password reset email:", error);
  });

  return "If this email is registered, you will receive a reset link shortly.";
};

export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires +password");

  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  user.password = newPassword;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;

  await user.save();
};

export interface GoogleLoginPayload {
  googleId: string;
  email: string;
  name: string;
  photoUrl?: string;
  role?: "PLAYER" | "VENUE_LISTER" | "COACH";
  userType?: "Parent" | "Recreational" | "Coach" | "Academy" | "Admin";
  action?: "login" | "register";
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
}

export const googleLogin = async (
  payload: GoogleLoginPayload,
): Promise<UserDocument> => {
  let user = await User.findOne({ googleId: payload.googleId });

  if (!user) {
    // Check if user exists with email
    user = await User.findOne({ email: payload.email });

    if (user) {
      // Link Google account to existing user
      user.googleId = payload.googleId;
      if (payload.photoUrl) {
        user.photoUrl = payload.photoUrl;
      }
      await user.save();
    } else {
      if (payload.action === "login") {
        throw new Error(
          "Account not found. Please sign up on the Register page.",
        );
      }

      if (!payload.acceptedTerms || !payload.acceptedPrivacy) {
        throw new Error(
          "You must accept Terms of Service and Privacy Policy to register.",
        );
      }

      const now = new Date();

      // Create new user
      // Generate unique phone from Google ID to avoid phone field collision
      const uniquePhoneId = `goog_${payload.googleId.slice(0, 15)}_${Date.now()}`;

      user = new User({
        name: payload.name,
        email: payload.email,
        googleId: payload.googleId,
        photoUrl: payload.photoUrl,
        phone: uniquePhoneId, // Unique ID instead of fake phone number
        role: payload.role || "PLAYER",
        userType: payload.userType || "Recreational",
        legalConsents: {
          terms: {
            accepted: true,
            acceptedAt: now,
            version: LEGAL_POLICY_VERSION,
          },
          privacy: {
            accepted: true,
            acceptedAt: now,
            version: LEGAL_POLICY_VERSION,
          },
        },
      });
      await user.save();

      // Send welcome email for new Google users
      sendWelcomeEmail({
        name: user.name,
        email: user.email,
        role: user.role,
      }).catch((error) => {
        console.error("Failed to send welcome email:", error);
      });
    }
  }

  return user;
};

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
  payload: GraduateDependentPayload,
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
      role: "PLAYER",
      userType: "Recreational",
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
      { session },
    );

    console.log(`Transferred ${result.modifiedCount} bookings to new user`);

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
      console.error("Failed to send welcome email:", error);
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
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Health" | "Social" | "Competitive";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
}

function calculateAge(dob: Date): number {
  const ageDifMs = Date.now() - dob.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export const addDependent = async (
  userId: string,
  payload: AddDependentPayload,
): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
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
    personalityTags: payload.personalityTags,
    primaryObjective: payload.primaryObjective,
    weeklyTimeCommitment: payload.weeklyTimeCommitment,
    budgetTier: payload.budgetTier,
  });

  await newDependent.save();
  return newDependent;
};

export const updateDependent = async (
  userId: string,
  dependentId: string,
  payload: Partial<AddDependentPayload>,
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
  if (payload.personalityTags)
    dependent.personalityTags = payload.personalityTags;
  if (payload.primaryObjective)
    dependent.primaryObjective = payload.primaryObjective;
  if (payload.weeklyTimeCommitment !== undefined)
    dependent.weeklyTimeCommitment = payload.weeklyTimeCommitment;
  if (payload.budgetTier) dependent.budgetTier = payload.budgetTier;

  await dependent.save();
  return dependent;
};

export const deleteDependent = async (
  userId: string,
  dependentId: string,
): Promise<void> => {
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
      `Cannot delete dependent with ${bookingCount} active booking(s). Please cancel or complete these bookings first.`,
    );
  }

  await Player.deleteOne({ _id: dependentId });
};

export const getPlayersByUserId = async (userId: string): Promise<any[]> => {
  return Player.find({ userId }).sort({ type: -1, name: 1 });
};

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  dob?: string | Date;
  playerProfile?: {
    sports?: string[];
    personalityTags?: string[];
    primaryObjective?: "Recreational" | "Health" | "Social" | "Competitive";
    weeklyTimeCommitment?: number;
    budgetTier?: "Budget" | "Moderate" | "Premium";
    pathwayState?: {
      satisfiedPrerequisites?: string[];
      currentGpa?: string;
      targetDivision?: string;
      graduationYear?: number;
    };
  };
  shippingAddress?: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export const updateProfile = async (
  userId: string,
  payload: UpdateProfilePayload,
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Check if new email/phone already exists (from other users)
  if (payload.email && payload.email !== user.email) {
    const existingEmailUser = await User.findOne({ email: payload.email });
    if (existingEmailUser) {
      throw new Error("Email already in use");
    }
  }

  if (payload.phone && payload.phone !== user.phone) {
    const existingPhoneUser = await User.findOne({ phone: payload.phone });
    if (existingPhoneUser) {
      throw new Error("Phone number already in use");
    }
  }

  // Update user fields
  if (payload.name) user.name = payload.name;
  if (payload.email) user.email = payload.email;
  if (payload.phone) user.phone = payload.phone;
  if (payload.dob) user.dob = new Date(payload.dob);

  // Update player profile if provided
  if (payload.playerProfile && Array.isArray(payload.playerProfile.sports)) {
    let selfPlayer = await Player.findOne({ userId, type: "SELF" });
    if (!selfPlayer) {
      selfPlayer = new Player({
        userId: user._id,
        type: "SELF",
        name: user.name,
        sportsFocus: payload.playerProfile.sports,
      });
    } else {
      if (payload.playerProfile.sports)
        selfPlayer.sportsFocus = payload.playerProfile.sports;
    }

    if (payload.playerProfile.personalityTags)
      selfPlayer.personalityTags = payload.playerProfile.personalityTags;
    if (payload.playerProfile.primaryObjective)
      selfPlayer.primaryObjective = payload.playerProfile.primaryObjective;
    if (payload.playerProfile.weeklyTimeCommitment !== undefined)
      selfPlayer.weeklyTimeCommitment =
        payload.playerProfile.weeklyTimeCommitment;
    if (payload.playerProfile.budgetTier)
      selfPlayer.budgetTier = payload.playerProfile.budgetTier;

    if (payload.playerProfile.pathwayState) {
      if (!selfPlayer.pathwayState) selfPlayer.pathwayState = {};
      Object.assign(
        selfPlayer.pathwayState,
        payload.playerProfile.pathwayState,
      );
    }

    await selfPlayer.save();
  }

  if (payload.shippingAddress) {
    user.shippingAddress = {
      fullName: payload.shippingAddress.fullName,
      email: payload.shippingAddress.email,
      phone: payload.shippingAddress.phone,
      addressLine1: payload.shippingAddress.addressLine1,
      ...(payload.shippingAddress.addressLine2 !== undefined ? { addressLine2: payload.shippingAddress.addressLine2 } : {}),
      city: payload.shippingAddress.city,
      state: payload.shippingAddress.state,
      postalCode: payload.shippingAddress.postalCode,
      country: payload.shippingAddress.country || "IN",
    };
  }

  await user.save();
  return user;
};

/**
 * Get presigned URL for profile picture upload
 */
export const getProfilePictureUploadUrl = async (
  userId: string,
  fileName: string,
  contentType: string,
): Promise<{
  uploadUrl: string;
  downloadUrl: string;
  key: string;
}> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const s3Service = new S3Service();
  const result = await s3Service.generateProfilePictureUploadUrl(
    fileName,
    contentType,
    userId,
  );

  return {
    uploadUrl: result.uploadUrl,
    downloadUrl: result.downloadUrl,
    key: result.key,
  };
};

/**
 * Confirm profile picture upload and save to user
 */
export const confirmProfilePictureUpload = async (
  userId: string,
  photoUrl: string,
  photoS3Key: string,
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.photoUrl = photoUrl;
  user.photoS3Key = photoS3Key;
  await user.save();

  return user;
};
