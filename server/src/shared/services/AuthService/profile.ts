import { Player } from "../../../client/models/Player";
import { User, UserDocument } from "../../../client/models/User";
import { S3Service } from "../S3Service";

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  dob?: string | Date;
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
  payload: UpdateProfilePayload
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
  if (payload.parentProfile && user.role === "Parent") {
    const p = payload.parentProfile;
    const parentDoc = user as any;
    if (p.bio !== undefined) parentDoc.bio = p.bio;
    if (p.sportInterests !== undefined) parentDoc.sportInterests = p.sportInterests;
    if (p.involvementYears !== undefined) parentDoc.involvementYears = p.involvementYears;
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
      if (payload.playerProfile.sports) selfPlayer.sportsFocus = payload.playerProfile.sports;
    }

    if (payload.playerProfile.yearsPlaying !== undefined)
      selfPlayer.yearsPlaying = payload.playerProfile.yearsPlaying;
    if (payload.playerProfile.personalityTags)
      selfPlayer.personalityTags = payload.playerProfile.personalityTags;
    if (payload.playerProfile.primaryObjective)
      selfPlayer.primaryObjective = payload.playerProfile.primaryObjective;
    if (payload.playerProfile.weeklyTimeCommitment !== undefined)
      selfPlayer.weeklyTimeCommitment = payload.playerProfile.weeklyTimeCommitment;
    if (payload.playerProfile.budgetTier) selfPlayer.budgetTier = payload.playerProfile.budgetTier;
    if (payload.playerProfile.location !== undefined)
      selfPlayer.location = payload.playerProfile.location;

    if (payload.playerProfile.pathwayState) {
      if (!selfPlayer.pathwayState) selfPlayer.pathwayState = {};
      Object.assign(selfPlayer.pathwayState, payload.playerProfile.pathwayState);
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

  return user;
};

/**
 * Get presigned URL for profile picture upload
 */
export const getProfilePictureUploadUrl = async (
  userId: string,
  fileName: string,
  contentType: string
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
  const result = await s3Service.generateProfilePictureUploadUrl(fileName, contentType, userId);

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
  photoS3Key: string
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
