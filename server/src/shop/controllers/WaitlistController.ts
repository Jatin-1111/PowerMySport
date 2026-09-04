import { Request, Response } from "express";
import { ShopWaitlist } from "../models/ShopWaitlist";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const joinWaitlist = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    throw new AppError("A valid email address is required", 400);
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const existingEntry = await ShopWaitlist.findOne({
    email: email.toLowerCase(),
  });

  if (existingEntry) {
    throw new AppError("Email is already on the waitlist", 400);
  }

  await ShopWaitlist.create({ email: email.toLowerCase() });

  res.status(201).json({
    success: true,
    message: "Successfully joined the waitlist",
  });
});
