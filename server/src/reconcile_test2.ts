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
  
  console.log("Before: paymentStatus =", session.paymentStatus);
  try {
    const updated = await reconcileExpertSession({
      sessionId: session._id.toString(),
      userId: session.userId.toString()
    });
    console.log("After: paymentStatus =", updated.paymentStatus);
  } catch (e: any) {
    console.error("Reconcile error:", e.message);
  }
  process.exit(0);
};
run();
