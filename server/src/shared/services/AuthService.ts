import crypto from "crypto";
import mongoose from "mongoose";
import { Booking } from "../../client/models/Booking";
import { Player } from "../../client/models/Player";
import { User, UserDocument } from "../../client/models/User";
import { Expert } from "../../client/models/ExpertProfile";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
} from "../../utils/email";
import { normalizeAddressInput } from "../utils/address";
import { S3Service } from "./S3Service";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  name?: string;
  photoUrl?: string;
}

/**
 * Verify a Google ID token ("credential" from Google Identity Services) on the
 * server. This is the ONLY trustworthy source of the user's Google identity —
 * never trust googleId/email sent directly by the client, as those can be
 * forged to impersonate any account.
 */
export const verifyGoogleCredential = async (
  credential: unknown,
): Promise<VerifiedGoogleIdentity> => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google login is not configured on the server.");
  }
  if (!credential || typeof credential !== "string") {
    throw new Error("Missing Google credential.");
  }

  let ticket;
  try {
    ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new Error("Invalid Google credential.");
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google credential.");
  }
  if (payload.email_verified === false) {
    throw new Error("Google account email is not verified.");
  }

  const identity: VerifiedGoogleIdentity = {
    googleId: payload.sub,
    email: payload.email,
  };
  if (payload.name) {
    identity.name = payload.name;
  }
  if (payload.picture) {
    identity.photoUrl = payload.picture;
  }
  return identity;
};

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "Player" | "VenueLister" | "Coach" | "EXPERT";
  userType?: "Parent" | "Player" | "Coach" | "Academy" | "Admin";
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

  // For self-registered experts create a blank profile pending admin review.
  if (payload.role === "EXPERT") {
    await Expert.create({
      userId: user._id,
      bio: "",
      sports: [],
      expertise: [],
      sessionFee: 0,
      sessionMode: "ONLINE",
      isActive: false,
      verificationStatus: "UNVERIFIED",
    });
  }

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
  return User.findById(id).select("+password");
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

  // Security confirmation that the password was changed (fire-and-forget).
  if (user.email) {
    sendPasswordChangedEmail({ name: user.name, email: user.email }).catch(
      (error) => console.error("Failed to send password-changed email:", error),
    );
  }
};

/**
 * Change password for an already-authenticated user. Requires the current
 * password to be re-entered — this is the app's only re-authentication step
 * (no 2FA exists), so it's the sole guard against a hijacked/left-open
 * session silently locking the real owner out.
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.password) {
    throw new Error(
      "This account signed in with Google and has no password to change",
    );
  }

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    throw new Error("Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  if (user.email) {
    sendPasswordChangedEmail({ name: user.name, email: user.email }).catch(
      (error) => console.error("Failed to send password-changed email:", error),
    );
  }
};

/**
 * Deletes (soft) an account. A hard delete would orphan or corrupt
 * historical Booking/Payment/Player/Review documents that reference this
 * user, and financial records need to survive for tax/dispute purposes —
 * so instead this deactivates the account (isActive=false, already
 * enforced by authMiddleware on every request, so the user is immediately
 * locked out) and anonymizes personally-identifying fields on the User
 * document itself. Player/Booking/Payment history is intentionally left
 * untouched.
 */
export const deleteAccount = async (
  userId: string,
  currentPassword: string,
): Promise<void> => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new Error("User not found");
  }

  if (user.password) {
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new Error("Password is incorrect");
    }
  }

  const anonymizedTag = `deleted-${user._id.toString()}`;
  user.name = "Deleted User";
  user.email = `${anonymizedTag}@deleted.powermysport.com`;
  user.phone = anonymizedTag;
  delete user.password;
  delete user.googleId;
  delete user.photoUrl;
  delete user.photoS3Key;
  user.addresses = [];
  delete user.shippingAddress;
  user.refundMethods = [];
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  user.pushSubscriptions = [];
  user.isActive = false;
  user.deactivatedAt = new Date();

  await user.save();
};

export interface GoogleLoginPayload {
  googleId: string;
  email: string;
  name: string;
  photoUrl?: string;
  role?: "Player" | "VenueLister" | "Coach";
  userType?: "Parent" | "Player" | "Coach" | "Academy" | "Admin";
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
        role: payload.role || "Player",
        userType: payload.userType || "Player",
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
      role: "Player",
      userType: "Player",
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
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
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

  if (user.role === "Player" && user.userType !== "Parent") {
    throw new Error(
      "Only Parent profiles can add dependents. Please upgrade your profile first.",
    );
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
  if (payload.yearsPlaying !== undefined)
    dependent.yearsPlaying = payload.yearsPlaying;
  if (payload.personalityTags)
    dependent.personalityTags = payload.personalityTags;
  if (payload.primaryObjective)
    dependent.primaryObjective = payload.primaryObjective;
  if (payload.weeklyTimeCommitment !== undefined)
    dependent.weeklyTimeCommitment = payload.weeklyTimeCommitment;
  if (payload.budgetTier) dependent.budgetTier = payload.budgetTier;
  if (payload.location !== undefined) dependent.location = payload.location;

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
  userType?:
    "Parent" | "Player" | "Coach" | "Academy" | "VenueLister" | "Admin";
  parentProfile?: {
    bio?: string;
    sportInterests?: string[];
    involvementYears?: number;
  };
  playerProfile?: {
    sports?: string[];
    yearsPlaying?: number;
    personalityTags?: string[];
    primaryObjective?: "Recreational" | "Fitness" | "Compete";
    weeklyTimeCommitment?: number;
    budgetTier?: "Budget" | "Moderate" | "Premium";
    location?: string;
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

  // Update parent-specific fields
  if (payload.parentProfile && user.userType === "Parent") {
    const p = payload.parentProfile;
    const parentDoc = user as any;
    if (p.bio !== undefined) parentDoc.bio = p.bio;
    if (p.sportInterests !== undefined) parentDoc.sportInterests = p.sportInterests;
    if (p.involvementYears !== undefined) parentDoc.involvementYears = p.involvementYears;
  }

  let userTypeToUpdate: any = undefined;
  if (payload.userType && payload.userType !== user.userType) {
    userTypeToUpdate = payload.userType;
  }

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

    if (payload.playerProfile.yearsPlaying !== undefined)
      selfPlayer.yearsPlaying = payload.playerProfile.yearsPlaying;
    if (payload.playerProfile.personalityTags)
      selfPlayer.personalityTags = payload.playerProfile.personalityTags;
    if (payload.playerProfile.primaryObjective)
      selfPlayer.primaryObjective = payload.playerProfile.primaryObjective;
    if (payload.playerProfile.weeklyTimeCommitment !== undefined)
      selfPlayer.weeklyTimeCommitment =
        payload.playerProfile.weeklyTimeCommitment;
    if (payload.playerProfile.budgetTier)
      selfPlayer.budgetTier = payload.playerProfile.budgetTier;
    if (payload.playerProfile.location !== undefined)
      selfPlayer.location = payload.playerProfile.location;

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
      ...(payload.shippingAddress.addressLine2 !== undefined
        ? { addressLine2: payload.shippingAddress.addressLine2 }
        : {}),
      city: payload.shippingAddress.city,
      state: payload.shippingAddress.state,
      postalCode: payload.shippingAddress.postalCode,
      country: payload.shippingAddress.country || "IN",
    };
  }

  await user.save();

  if (userTypeToUpdate) {
    await mongoose.connection
      .collection("users")
      .updateOne({ _id: user._id }, { $set: { userType: userTypeToUpdate } });
    const updatedUser = await User.findById(userId);
    if (!updatedUser) throw new Error("Failed to refetch updated user");
    return updatedUser;
  }

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

/**
 * Add a new address for the user
 */
export const addAddress = async (
  userId: string,
  addressData: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  },
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.addresses) {
    user.addresses = [];
  }

  // Canonicalize on write (Tier 0) so the stored value is consistent even if
  // the request bypassed the UI dropdown.
  const data = normalizeAddressInput(addressData);

  const newAddress: any = {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    addressLine1: data.addressLine1,
    ...(data.addressLine2 !== undefined
      ? { addressLine2: data.addressLine2 }
      : {}),
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country || "IN",
    isDefault: user.addresses.length === 0, // First address is default
  };

  user.addresses.push(newAddress);

  // Set default address ID if this is the first address
  if (user.addresses && user.addresses.length === 1 && user.addresses[0]!._id) {
    user.defaultAddressId = user.addresses[0]!._id as any;
  }

  await user.save();
  return user;
};

/**
 * Update an existing address
 */
export const updateAddress = async (
  userId: string,
  addressId: string,
  addressData: {
    fullName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  },
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user || !user.addresses) {
    throw new Error("User or address not found");
  }

  const address = user.addresses.find(
    (addr) => addr._id?.toString() === addressId,
  );
  if (!address) {
    throw new Error("Address not found");
  }

  // Canonicalize provided fields on write (Tier 0).
  const data = normalizeAddressInput(addressData);

  // Update address fields
  if (data.fullName) address.fullName = data.fullName;
  if (data.email) address.email = data.email;
  if (data.phone) address.phone = data.phone;
  if (data.addressLine1) address.addressLine1 = data.addressLine1;
  if (data.addressLine2 !== undefined) address.addressLine2 = data.addressLine2;
  if (data.city) address.city = data.city;
  if (data.state) address.state = data.state;
  if (data.postalCode) address.postalCode = data.postalCode;
  if (data.country) address.country = data.country;

  address.updatedAt = new Date();

  await user.save();
  return user;
};

/**
 * Delete an address
 */
export const deleteAddress = async (
  userId: string,
  addressId: string,
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user || !user.addresses) {
    throw new Error("User or address not found");
  }

  const addressIndex = user.addresses.findIndex(
    (addr) => addr._id?.toString() === addressId,
  );
  if (addressIndex === -1) {
    throw new Error("Address not found");
  }

  user.addresses.splice(addressIndex, 1);

  // If deleted address was default, set new default
  if (
    user.defaultAddressId?.toString() === addressId &&
    user.addresses &&
    user.addresses.length > 0
  ) {
    user.defaultAddressId = user.addresses[0]!._id as any;
    user.addresses[0]!.isDefault = true;
  } else if (user.addresses && user.addresses.length === 0) {
    user.defaultAddressId = undefined as any;
  }

  // Clear isDefault flag if no default is set
  user.addresses.forEach((addr) => {
    if (!user.defaultAddressId) {
      addr.isDefault = false;
    }
  });

  await user.save();
  return user;
};

/**
 * Set default address for user
 */
export const setDefaultAddress = async (
  userId: string,
  addressId: string,
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user || !user.addresses) {
    throw new Error("User or address not found");
  }

  const address = user.addresses.find(
    (addr) => addr._id?.toString() === addressId,
  );
  if (!address) {
    throw new Error("Address not found");
  }

  // Clear previous default
  user.addresses.forEach((addr) => {
    addr.isDefault = false;
  });

  // Set new default
  address.isDefault = true;
  user.defaultAddressId = address._id as any;

  await user.save();
  return user;
};

/**
 * Get all addresses for a user
 */
export const getUserAddresses = async (
  userId: string,
): Promise<UserDocument["addresses"]> => {
  const user = await User.findById(userId).select("addresses defaultAddressId");
  if (!user) {
    throw new Error("User not found");
  }

  return user.addresses || [];
};

/**
 * Link a Google account to an existing user
 */
export const linkGoogleAccount = async (
  userId: string,
  credential: string,
): Promise<UserDocument> => {
  const identity = await verifyGoogleCredential(credential);

  const existingGoogleUser = await User.findOne({ googleId: identity.googleId });
  if (existingGoogleUser && existingGoogleUser._id.toString() !== userId) {
    throw new Error("This Google account is already linked to another user.");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.googleId = identity.googleId;
  if (!user.photoUrl && identity.photoUrl) {
    user.photoUrl = identity.photoUrl;
  }

  await user.save();
  return user;
};
