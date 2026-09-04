import { Request, Response } from "express";
import { generateToken, revokeToken, TOKEN_MAX_AGE_MS } from "../../utils/jwt";
import {
  addAddress,
  addDependent,
  changePassword,
  confirmProfilePictureUpload,
  requestAccountDeletion,
  deleteAddress,
  deleteDependent,
  getPlayersByUserId,
  getProfilePictureUploadUrl,
  getUserAddresses,
  getUserById,
  googleLogin,
  verifyGoogleCredential,
  graduateDependent,
  loginUser,
  registerUser,
  linkGoogleAccount,
  requestPasswordReset,
  resetPassword,
  setDefaultAddress,
  updateAddress,
  updateDependent,
  updateProfile,
} from "../services/AuthService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Without this the cookie is a *session* cookie: it dies when the browser
  // closes, while the token it carries stays valid for 7 days and is also held
  // in localStorage. That left returning users routinely holding a valid session
  // and no cookie, so the cookie could not be treated as the session of record
  // and server-side auth gating had to stay disabled. Derived from the token's
  // own lifetime so the two cannot drift apart.
  maxAge: TOKEN_MAX_AGE_MS,
  // Only set domain in production to allow cross-subdomain auth (e.g. .powermysport.com)
  // In development, omit it so localhost handles it gracefully across ports
  ...(authCookieDomain && process.env.NODE_ENV === "production"
    ? { domain: authCookieDomain }
    : {}),
};

export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // role always arrives already defaulted here — registerSchema (applied by
  // the validateRequest middleware ahead of this handler) guarantees it's
  // present and valid before req.body reaches this point.
  const user = await registerUser({ ...req.body });

  const token = generateToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  res.cookie("token", token, authCookieOptions);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { user, deletionCancelled } = await loginUser(req.body);

  const token = generateToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  res.cookie("token", token, authCookieOptions);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      deletionCancelled,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.token || req.headers.authorization?.slice(7).trim();
  if (token) {
    await revokeToken(token);
  }

  res.clearCookie("token", authCookieOptions);
  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  const user = await getUserById(req.user.id);

  if (!user) {
    res.clearCookie("token", authCookieOptions);
    throw new AppError("Session expired. Please login again.", 401);
  }

  // Refresh profile photo URL if S3 key exists
  if (user.photoS3Key) {
    await user.refreshPhotoUrl();
  }

  const allPlayers = await getPlayersByUserId(user._id.toString());
  const dependents = allPlayers
    .filter((p: any) => p.type === "DEPENDENT")
    .map((p: any) => ({
      _id: p._id,
      name: p.name,
      dob: p.dob || null,
      age: p.age,
      gender: p.gender,
      relation: p.relation,
      sportsFocus: p.sportsFocus || [],
      skillLevel: p.skillLevel,
      yearsPlaying: p.yearsPlaying,
      personalityTags: p.personalityTags,
      primaryObjective: p.primaryObjective,
      weeklyTimeCommitment: p.weeklyTimeCommitment,
      budgetTier: p.budgetTier,
      location: p.location,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      medicalConditions: p.medicalConditions || [],
      // Wizard physical
      build: p.build,
      heightCategory: p.heightCategory,
      energyType: p.energyType,
      motorType: p.motorType,
      visualTracking: p.visualTracking,
      eyesight: p.eyesight,
      agility: p.agility,
      // Wizard personality
      teamIndividual: p.teamIndividual,
      competitiveResponse: p.competitiveResponse,
      focusStyle: p.focusStyle,
      decisionStyle: p.decisionStyle,
      pressureResponse: p.pressureResponse,
      repetitionTolerance: p.repetitionTolerance,
      // Wizard comfort
      contactComfort: p.contactComfort,
      environment: p.environment,
      waterComfort: p.waterComfort,
      // Wizard practical
      consideringSports: p.consideringSports || [],
      budgetRange: p.budgetRange,
      ambition: p.ambition,
      weeklyHoursCategory: p.weeklyHoursCategory,
      experienceLevel: p.experienceLevel,
      trainingType: p.trainingType,
      // Results
      sportMatches: p.sportMatches || [],
      wizardCompletedAt: p.wizardCompletedAt,
    }));

  const selfPlayer = allPlayers.find((p: any) => p.type === "SELF");
  const playerProfile = selfPlayer
    ? {
        sportsFocus: selfPlayer.sportsFocus || [],
        yearsPlaying: selfPlayer.yearsPlaying,
        personalityTags: selfPlayer.personalityTags,
        primaryObjective: selfPlayer.primaryObjective,
        weeklyTimeCommitment: selfPlayer.weeklyTimeCommitment,
        budgetTier: selfPlayer.budgetTier,
        location: selfPlayer.location,
      }
    : undefined;

  const parentProfile =
    user.role === "Parent"
      ? {
          bio: (user as any).bio ?? undefined,
          sportInterests: (user as any).sportInterests ?? [],
          involvementYears: (user as any).involvementYears ?? undefined,
        }
      : undefined;

  res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      dob: user.dob,
      photoUrl: user.photoUrl,
      photoS3Key: user.photoS3Key,
      playerProfile,
      parentProfile,
      dependents,
      shippingAddress: user.shippingAddress,
      hasPassword: !!user.password,
    },
  });
});

export const getAuthBridge = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  const user = await getUserById(req.user.id);

  if (!user) {
    res.clearCookie("token", authCookieOptions);
    throw new AppError("Session expired. Please login again.", 401);
  }

  res.status(200).json({
    success: true,
    message: "Session valid",
    data: {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
  });
});

export const updateProfileHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { name, email, phone, dob, parentProfile, playerProfile, shippingAddress } = req.body;

    const updatedUser = await updateProfile(req.user.id, {
      name,
      email,
      phone,
      dob,
      parentProfile,
      playerProfile,
      shippingAddress,
    });

    const updatedParentProfile =
      updatedUser.role === "Parent"
        ? {
            bio: (updatedUser as any).bio ?? undefined,
            sportInterests: (updatedUser as any).sportInterests ?? [],
            involvementYears: (updatedUser as any).involvementYears ?? undefined,
          }
        : undefined;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        dob: updatedUser.dob,
        photoUrl: updatedUser.photoUrl,
        photoS3Key: updatedUser.photoS3Key,
        shippingAddress: updatedUser.shippingAddress,
        parentProfile: updatedParentProfile,
      },
    });
  }
);

export const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  await requestPasswordReset(email);

  res.status(200).json({
    success: true,
    message: "Password reset instructions sent to your email",
  });
});

export const resetPasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  }
);

export const changePasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new AppError("Current password and new password are required", 400);
    }
    if (newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters", 400);
    }

    await changePassword(req.user.id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  }
);

export const deleteAccountHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { password } = req.body;
    await requestAccountDeletion(req.user.id, password || "");

    const token = req.cookies?.token || req.headers.authorization?.slice(7).trim();
    if (token) {
      await revokeToken(token);
    }
    res.clearCookie("token", authCookieOptions);

    res.status(200).json({
      success: true,
      message:
        "Your account has been deactivated and is scheduled for permanent deletion in 30 days. Log back in before then to cancel.",
    });
  }
);

export const googleAuth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { credential, role, action, acceptedTerms, acceptedPrivacy } = req.body;

  // Verify the Google ID token server-side. Identity (googleId/email/name) is
  // derived ONLY from the verified token — never from client-supplied fields.
  const identity = await verifyGoogleCredential(credential);

  const { user, deletionCancelled } = await googleLogin({
    googleId: identity.googleId,
    email: identity.email,
    name: identity.name || identity.email.split("@")[0] || "User",
    ...(identity.photoUrl ? { photoUrl: identity.photoUrl } : {}),
    role,
    action,
    acceptedTerms,
    acceptedPrivacy,
  });

  const token = generateToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  res.cookie("token", token, authCookieOptions);

  res.status(200).json({
    success: true,
    message: "Google login successful",
    data: {
      token,
      deletionCancelled,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photoUrl: user.photoUrl,
      },
    },
  });
});

export const graduateDependentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { dependentId, email, password, phone } = req.body;

    // Validate required fields
    if (!dependentId) {
      throw new AppError("Dependent ID is required", 400);
    }

    if (!email || !email.trim()) {
      throw new AppError("Email is required", 400);
    }

    if (!password || password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    if (!phone || !phone.trim()) {
      throw new AppError("Phone number is required", 400);
    }

    const newUser = await graduateDependent({
      parentId: req.user.id,
      dependentId,
      email: email.trim(),
      password,
      phone: phone.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Dependent graduated to independent user successfully",
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
        },
      },
    });
  }
);

export const getMyPlayersHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const players = await getPlayersByUserId(req.user.id);

    res.status(200).json({
      success: true,
      message: "Players fetched successfully",
      data: players,
    });
  }
);

export const addDependentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const dependent = await addDependent(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Dependent added successfully",
      data: dependent,
    });
  }
);

export const updateDependentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { dependentId } = req.params;
    if (!dependentId || typeof dependentId !== "string") {
      throw new AppError("Invalid dependent ID", 400);
    }
    const dependent = await updateDependent(req.user.id, dependentId, req.body);

    res.status(200).json({
      success: true,
      message: "Dependent updated successfully",
      data: dependent,
    });
  }
);

export const deleteDependentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { dependentId } = req.params;
    if (!dependentId || typeof dependentId !== "string") {
      throw new AppError("Invalid dependent ID", 400);
    }
    await deleteDependent(req.user.id, dependentId);

    res.status(200).json({
      success: true,
      message: "Dependent deleted successfully",
    });
  }
);

/**
 * Get presigned URL for profile picture upload
 */
export const getProfilePictureUploadUrlHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      throw new AppError("fileName and contentType are required", 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      throw new AppError(`Invalid content type. Allowed: ${allowedTypes.join(", ")}`, 400);
    }

    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const result = await getProfilePictureUploadUrl(req.user.id, fileName, contentType);

    res.status(200).json({
      success: true,
      message: "Presigned URL generated successfully",
      data: result,
    });
  }
);

/**
 * Confirm profile picture upload
 */
export const confirmProfilePictureUploadHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { photoUrl, photoS3Key } = req.body;

    if (!photoUrl || !photoS3Key) {
      throw new AppError("photoUrl and photoS3Key are required", 400);
    }

    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const user = await confirmProfilePictureUpload(req.user.id, photoUrl, photoS3Key);

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        photoUrl: user.photoUrl,
        photoS3Key: user.photoS3Key,
      },
    });
  }
);

/**
 * Add a new address for the user
 */
export const addAddressHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { fullName, email, phone, addressLine1, addressLine2, city, state, postalCode, country } =
      req.body;

    if (!fullName || !email || !phone || !addressLine1 || !city || !state || !postalCode) {
      throw new AppError("All required fields must be provided", 400);
    }

    const user = await addAddress(req.user.id, {
      fullName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country: country || "IN",
    });

    res.status(200).json({
      success: true,
      message: "Address added successfully",
      data: {
        addresses: user.addresses,
        defaultAddressId: user.defaultAddressId,
      },
    });
  }
);

/**
 * Get all addresses for the user
 */
export const getAddressesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const addresses = await getUserAddresses(req.user.id);

    res.status(200).json({
      success: true,
      data: addresses,
    });
  }
);

/**
 * Update an existing address
 */
export const updateAddressHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { addressId } = req.params;
    if (!addressId || typeof addressId !== "string") {
      throw new AppError("Invalid address ID", 400);
    }
    const { fullName, email, phone, addressLine1, addressLine2, city, state, postalCode, country } =
      req.body;

    const user = await updateAddress(req.user.id, addressId, {
      fullName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    });

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: {
        addresses: user.addresses,
        defaultAddressId: user.defaultAddressId,
      },
    });
  }
);

/**
 * Delete an address
 */
export const deleteAddressHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { addressId } = req.params;
    if (!addressId || typeof addressId !== "string") {
      throw new AppError("Invalid address ID", 400);
    }

    const user = await deleteAddress(req.user.id, addressId);

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: {
        addresses: user.addresses,
        defaultAddressId: user.defaultAddressId,
      },
    });
  }
);

/**
 * Set default address
 */
export const setDefaultAddressHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { addressId } = req.params;
    if (!addressId || typeof addressId !== "string") {
      throw new AppError("Invalid address ID", 400);
    }

    const user = await setDefaultAddress(req.user.id, addressId);

    res.status(200).json({
      success: true,
      message: "Default address set successfully",
      data: {
        addresses: user.addresses,
        defaultAddressId: user.defaultAddressId,
      },
    });
  }
);

export const linkGoogleHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { credential } = req.body;
    if (!credential) {
      throw new AppError("Credential is required", 400);
    }

    const user = await linkGoogleAccount(req.user.id, credential);

    res.status(200).json({
      success: true,
      message: "Google account linked successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          googleId: user.googleId,
          photoUrl: user.photoUrl,
        },
      },
    });
  }
);
