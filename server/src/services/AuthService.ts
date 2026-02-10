import crypto from "crypto";
import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { User, UserDocument } from "../models/User";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../utils/email";

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "PLAYER" | "VENUE_LISTER" | "COACH";
}

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

  const user = new User(payload);
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
    throw new Error("No user found with this email");
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

  return resetToken;
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

    // Find the specific dependent
    const dependent = parent.dependents.find(
      (d) => d._id?.toString() === payload.dependentId,
    );
    if (!dependent || !dependent._id) {
      throw new Error("Dependent not found");
    }

    // Check if dependent is at least 18 years old
    const ageInMs = Date.now() - dependent.dob.getTime();
    const age = Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365.25));
    if (age < 18) {
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
    });
    await newUser.save({ session });

    // Transfer all bookings where this dependent was the participant
    // Use the dependent's ID directly (now guaranteed to exist)
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

    // Remove the dependent from parent's dependents array
    parent.dependents = parent.dependents.filter(
      (d) => d._id?.toString() !== payload.dependentId,
    );
    await parent.save({ session });

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
  dob: Date;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sports?: string[];
}

export const addDependent = async (
  userId: string,
  payload: AddDependentPayload,
): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Add new dependent to array
  const newDependent: any = {
    name: payload.name,
    dob: new Date(payload.dob),
    relation: payload.relation || "CHILD",
    sports: payload.sports || [],
  };

  if (payload.gender) {
    newDependent.gender = payload.gender;
  }

  user.dependents.push(newDependent);

  await user.save();

  // Return the newly added dependent (last item in array)
  return user.dependents[user.dependents.length - 1];
};

export const updateDependent = async (
  userId: string,
  dependentId: string,
  payload: Partial<AddDependentPayload>,
): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const dependent = user.dependents.find(
    (d) => d._id?.toString() === dependentId,
  );
  if (!dependent) {
    throw new Error("Dependent not found");
  }

  // Update dependent fields
  if (payload.name) dependent.name = payload.name;
  if (payload.dob) dependent.dob = new Date(payload.dob);
  if (payload.gender) dependent.gender = payload.gender;
  if (payload.relation) dependent.relation = payload.relation;
  if (payload.sports) dependent.sports = payload.sports;

  await user.save();
  return dependent;
};

export const deleteDependent = async (
  userId: string,
  dependentId: string,
): Promise<void> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Check if any bookings exist for this dependent as participant
  const BookingModel = require("../models/Booking").Booking;
  const bookingCount = await BookingModel.countDocuments({
    participantId: dependentId,
  });

  if (bookingCount > 0) {
    throw new Error(
      `Cannot delete dependent with ${bookingCount} active booking(s). Please cancel or complete these bookings first.`,
    );
  }

  // Remove dependent from array
  user.dependents = user.dependents.filter(
    (d) => d._id?.toString() !== dependentId,
  );
  await user.save();
};

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  dob?: string | Date;
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

  await user.save();
  return user;
};
