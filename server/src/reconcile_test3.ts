import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { ExpertSession } from "./client/models/ExpertBooking";
import { reconcileExpertSession } from "./client/services/ExpertsService";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || "");
  const session = await ExpertSession.findById("6a497448aebab278637882bf");
  if (!session) {
    console.log("Session not found");
    process.exit(1);
  }
  
  if (session.paymentStatus === "FAILED" && session.status === "PENDING_PAYMENT") {
    session.status = "CANCELLED";
    session.cancelledBy = "SYSTEM";
    session.cancelReason = "Payment failed";
    session.cancelledAt = new Date();
    session.set("holdExpiresAt", undefined);
    await session.save();
    console.log("Fixed stuck session status to CANCELLED");
  } else {
    console.log("Already updated or not stuck.");
  }
  process.exit(0);
};
run();
