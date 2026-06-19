import { Request, Response } from "express";
import { ShopWaitlist } from "../models/ShopWaitlist";

export const joinWaitlist = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
      return;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
      return;
    }

    const existingEntry = await ShopWaitlist.findOne({ email: email.toLowerCase() });

    if (existingEntry) {
      res.status(400).json({
        success: false,
        message: "Email is already on the waitlist",
      });
      return;
    }

    await ShopWaitlist.create({ email: email.toLowerCase() });

    res.status(201).json({
      success: true,
      message: "Successfully joined the waitlist",
    });
  } catch (error) {
    console.error("Waitlist error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
