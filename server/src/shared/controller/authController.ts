import { Request, Response } from "express";
import { generateToken, revokeToken } from "../../utils/jwt";
import {
  addAddress,
  addDependent,
  confirmProfilePictureUpload,
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
  requestPasswordReset,
  resetPassword,
  setDefaultAddress,
  updateAddress,
  updateDependent,
  updateProfile,
} from "../services/AuthService";

const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Only set domain in production to allow cross-subdomain auth (e.g. .powermysport.com)
  // In development, omit it so localhost handles it gracefully across ports
  ...(authCookieDomain && process.env.NODE_ENV === "production"
    ? { domain: authCookieDomain }
    : {}),
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await registerUser({
      ...req.body,
      role: req.body.role || "PLAYER",
      userType: req.body.userType || "Recreational",
    });

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
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
          userType: user.userType,
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Registration failed",
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await loginUser(req.body);

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
    });

    res.cookie("token", token, authCookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: user.userType,
        },
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Login failed",
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token =
    req.cookies?.token || req.headers.authorization?.slice(7).trim();
  if (token) {
    await revokeToken(token);
  }

  res.clearCookie("token", authCookieOptions);
  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};

export const getProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const user = await getUserById(req.user.id);

    if (!user) {
      res.clearCookie("token", authCookieOptions);
      res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
      return;
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
        sports: p.sportsFocus || [],
        skillLevel: p.skillLevel,
        yearsPlaying: p.yearsPlaying,
        personalityTags: p.personalityTags,
        primaryObjective: p.primaryObjective,
        weeklyTimeCommitment: p.weeklyTimeCommitment,
        budgetTier: p.budgetTier,
        location: p.location,
      }));

    const selfPlayer = allPlayers.find((p: any) => p.type === "SELF");
    const playerProfile = selfPlayer
      ? {
          sports: selfPlayer.sportsFocus || [],
          yearsPlaying: selfPlayer.yearsPlaying,
          personalityTags: selfPlayer.personalityTags,
          primaryObjective: selfPlayer.primaryObjective,
          weeklyTimeCommitment: selfPlayer.weeklyTimeCommitment,
          budgetTier: selfPlayer.budgetTier,
          location: selfPlayer.location,
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
        userType: user.userType,
        dob: user.dob,
        photoUrl: user.photoUrl,
        photoS3Key: user.photoS3Key,
        playerProfile,
        dependents,
        shippingAddress: user.shippingAddress,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch profile",
    });
  }
};

export const getAuthBridge = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const user = await getUserById(req.user.id);

    if (!user) {
      res.clearCookie("token", authCookieOptions);
      res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Session valid",
      data: {
        id: user._id,
        role: user.role,
        userType: user.userType,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to validate session",
    });
  }
};

export const updateProfileHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { name, email, phone, dob, playerProfile, shippingAddress } =
      req.body;

    const updatedUser = await updateProfile(req.user.id, {
      name,
      email,
      phone,
      dob,
      playerProfile,
      shippingAddress,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        userType: updatedUser.userType,
        dob: updatedUser.dob,
        photoUrl: updatedUser.photoUrl,
        photoS3Key: updatedUser.photoS3Key,
        shippingAddress: updatedUser.shippingAddress,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update profile",
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;
    await requestPasswordReset(email);

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent to your email",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Request failed",
    });
  }
};

export const resetPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Password reset failed",
    });
  }
};

export const googleAuth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { credential, role, userType, action, acceptedTerms, acceptedPrivacy } =
      req.body;

    // Verify the Google ID token server-side. Identity (googleId/email/name) is
    // derived ONLY from the verified token — never from client-supplied fields.
    const identity = await verifyGoogleCredential(credential);

    const user = await googleLogin({
      googleId: identity.googleId,
      email: identity.email,
      name: identity.name || identity.email.split("@")[0] || "User",
      ...(identity.photoUrl ? { photoUrl: identity.photoUrl } : {}),
      role,
      userType,
      action,
      acceptedTerms,
      acceptedPrivacy,
    });

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
    });

    res.cookie("token", token, authCookieOptions);

    res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: user.userType,
          photoUrl: user.photoUrl,
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Google login failed",
    });
  }
};

export const graduateDependentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { dependentId, email, password, phone } = req.body;

    // Validate required fields
    if (!dependentId) {
      res.status(400).json({
        success: false,
        message: "Dependent ID is required",
      });
      return;
    }

    if (!email || !email.trim()) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      });
      return;
    }

    if (!password || password.length < 8) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
      return;
    }

    if (!phone || !phone.trim()) {
      res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
      return;
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
          userType: newUser.userType,
        },
      },
    });
  } catch (error) {
    console.error("Graduate dependent error:", error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Graduation failed",
    });
  }
};

export const getMyPlayersHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const players = await getPlayersByUserId(req.user.id);

    res.status(200).json({
      success: true,
      message: "Players fetched successfully",
      data: players,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch players",
    });
  }
};

export const addDependentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const dependent = await addDependent(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Dependent added successfully",
      data: dependent,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to add dependent",
    });
  }
};

export const updateDependentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { dependentId } = req.params;
    if (!dependentId || typeof dependentId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid dependent ID",
      });
      return;
    }
    const dependent = await updateDependent(req.user.id, dependentId, req.body);

    res.status(200).json({
      success: true,
      message: "Dependent updated successfully",
      data: dependent,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update dependent",
    });
  }
};

export const deleteDependentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { dependentId } = req.params;
    if (!dependentId || typeof dependentId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid dependent ID",
      });
      return;
    }
    await deleteDependent(req.user.id, dependentId);

    res.status(200).json({
      success: true,
      message: "Dependent deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete dependent",
    });
  }
};

/**
 * Get presigned URL for profile picture upload
 */
export const getProfilePictureUploadUrlHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      res.status(400).json({
        success: false,
        message: "fileName and contentType are required",
      });
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      res.status(400).json({
        success: false,
        message: `Invalid content type. Allowed: ${allowedTypes.join(", ")}`,
      });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const result = await getProfilePictureUploadUrl(
      req.user.id,
      fileName,
      contentType,
    );

    res.status(200).json({
      success: true,
      message: "Presigned URL generated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Profile picture upload URL error:", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate upload URL",
    });
  }
};

/**
 * Confirm profile picture upload
 */
export const confirmProfilePictureUploadHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { photoUrl, photoS3Key } = req.body;

    if (!photoUrl || !photoS3Key) {
      res.status(400).json({
        success: false,
        message: "photoUrl and photoS3Key are required",
      });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const user = await confirmProfilePictureUpload(
      req.user.id,
      photoUrl,
      photoS3Key,
    );

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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to confirm profile picture upload",
    });
  }
};

/**
 * Add a new address for the user
 */
export const addAddressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const {
      fullName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode
    ) {
      res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to add address",
    });
  }
};

/**
 * Get all addresses for the user
 */
export const getAddressesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const addresses = await getUserAddresses(req.user.id);

    res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch addresses",
    });
  }
};

/**
 * Update an existing address
 */
export const updateAddressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { addressId } = req.params;
    if (!addressId || typeof addressId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
    }
    const {
      fullName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = req.body;

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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update address",
    });
  }
};

/**
 * Delete an address
 */
export const deleteAddressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { addressId } = req.params;
    if (!addressId || typeof addressId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete address",
    });
  }
};

/**
 * Set default address
 */
export const setDefaultAddressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { addressId } = req.params;
    if (!addressId || typeof addressId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to set default address",
    });
  }
};
