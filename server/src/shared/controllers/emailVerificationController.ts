import { Request, Response } from "express";
import { sendVerificationCode, verifyCode } from "../services/EmailVerificationService";
import { Venue } from "../../client/models/Venue";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

/**
 * Send verification code to email
 * POST /api/venues/onboarding/send-verification
 * Body: { email, name }
 */
export const sendVerificationCodeHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, name } = req.body;

    if (!email || !name) {
      throw new AppError("Email and name are required", 400);
    }

    const result = await sendVerificationCode(email, name);

    if (!result.success) {
      throw new AppError(result.message, 429);
    }

    res.status(200).json(result);
  }
);

/**
 * Verify email code
 * POST /api/venues/onboarding/verify-email
 * Body: { email, code, venueId }
 */
export const verifyEmailHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, code, venueId } = req.body;

    if (!email || !code || !venueId) {
      throw new AppError("Email, code, and venueId are required", 400);
    }

    // Verify the code
    const result = await verifyCode(email, code);

    if (!result.success) {
      throw new AppError(result.message, 400);
    }

    // Mark venue email as verified
    const venue = await Venue.findById(venueId);

    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    if (venue.ownerEmail !== email) {
      throw new AppError("Email does not match venue owner email", 400);
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
  }
);
