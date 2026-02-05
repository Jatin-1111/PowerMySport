import crypto from "crypto";
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
      user = new User({
        name: payload.name,
        email: payload.email,
        googleId: payload.googleId,
        photoUrl: payload.photoUrl,
        phone: `google_${payload.googleId}`, // Placeholder, can be updated later
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
