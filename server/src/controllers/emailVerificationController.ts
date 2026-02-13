import { Request, Response } from "express";
import {
  sendVerificationCode,
  verifyCode,
} from "../services/EmailVerificationService";
import { Venue } from "../models/Venue";

/**
 * Send verification code to email
 * POST /api/venues/onboarding/send-verification
 * Body: { email, name }
 */
export const sendVerificationCodeHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      res.status(400).json({
        success: false,
        message: "Email and name are required",
      });
      return;
    }

    const result = await sendVerificationCode(email, name);

    if (!result.success) {
      res.status(429).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send verification code",
    });
  }
};

/**
 * Verify email code
 * POST /api/venues/onboarding/verify-email
 * Body: { email, code, venueId }
 */
export const verifyEmailHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, code, venueId } = req.body;

    if (!email || !code || !venueId) {
      res.status(400).json({
        success: false,
        message: "Email, code, and venueId are required",
      });
      return;
    }

    // Verify the code
    const result = verifyCode(email, code);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    // Mark venue email as verified
    const venue = await Venue.findById(venueId);

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    if (venue.ownerEmail !== email) {
      res.status(400).json({
        success: false,
        message: "Email does not match venue owner email",
      });
      return;
    }

    venue.emailVerified = true;
    await venue.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        venueId: venue._id,
        emailVerified: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to verify email",
    });
  }
};
