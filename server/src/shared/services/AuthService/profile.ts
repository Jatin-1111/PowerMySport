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
    /** What the client sends. `sports` is the old name and is still accepted. */
    sportsFocus?: string[];
    sports?: string[];
    yearsPlaying?: number;
    personalityTags?: string[];
    primaryObjective?: "Recreational" | "Fitness" | "Compete";
    weeklyTimeCommitment?: number;
    budgetTier?: "Budget" | "Moderate" | "Premium";
    location?: string;
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

  // The adult's own sport details live on the user. (They were saved to a SELF row in
  // `players`, and the client sends `sportsFocus` while this read `sports`, so a save
  // from the "My sports" card changed nothing.)
  const incoming = payload.playerProfile;
  if (incoming) {
    const sports = incoming.sportsFocus ?? incoming.sports;
    const profile: Record<string, unknown> = {
      ...((user as any).athleteProfile?.toObject?.() ?? (user as any).athleteProfile ?? {}),
    };
    if (Array.isArray(sports)) profile.sportsFocus = sports;
    if (incoming.yearsPlaying !== undefined) profile.yearsPlaying = incoming.yearsPlaying;
    if (incoming.personalityTags) profile.personalityTags = incoming.personalityTags;
    if (incoming.primaryObjective) profile.primaryObjective = incoming.primaryObjective;
    if (incoming.weeklyTimeCommitment !== undefined)
      profile.weeklyTimeCommitment = incoming.weeklyTimeCommitment;
    if (incoming.budgetTier) profile.budgetTier = incoming.budgetTier;
    if (incoming.location !== undefined) profile.location = incoming.location;
    if (Object.keys(profile).length > 0) (user as any).athleteProfile = profile;
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
