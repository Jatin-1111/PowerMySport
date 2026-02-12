import { Request, Response } from "express";
import {
  addDependent,
  confirmProfilePictureUpload,
  deleteDependent,
  getProfilePictureUploadUrl,
  getUserById,
  googleLogin,
  graduateDependent,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updateDependent,
  updateProfile,
} from "../services/AuthService";
import { generateToken } from "../utils/jwt";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await registerUser({
      ...req.body,
      role: req.body.role || "PLAYER",
    });

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

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
          venueListerProfile: user.venueListerProfile,
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
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

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
          venueListerProfile: user.venueListerProfile,
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
  res.clearCookie("token");
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
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Refresh profile photo URL if S3 key exists
    if (user.photoS3Key) {
      await user.refreshPhotoUrl();
      await user.save();
    }

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
        venueListerProfile: user.venueListerProfile,
        dependents: user.dependents,
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

    const { name, email, phone, dob } = req.body;

    const updatedUser = await updateProfile(req.user.id, {
      name,
      email,
      phone,
      dob,
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
        dob: updatedUser.dob,
        venueListerProfile: updatedUser.venueListerProfile,
        dependents: updatedUser.dependents,
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
    const { googleId, email, name, photoUrl, role } = req.body;

    const user = await googleLogin({
      googleId,
      email,
      name,
      photoUrl,
      role,
    });

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

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
          photoUrl: user.photoUrl,
          venueListerProfile: user.venueListerProfile,
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

    if (!password || password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
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
