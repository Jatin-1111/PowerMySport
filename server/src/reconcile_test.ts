import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { ExpertSession } from "./client/models/ExpertBooking";
import { getPhonePeOrderStatus } from "./shared/services/PhonePeService";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || "");
  const session = await ExpertSession.findById("6a497448aebab278637882bf");
  if (!session) {
    console.log("Session not found");
    process.exit(1);
  }
  console.log("merchantOrderId:", session.merchantOrderId);
  console.log("paymentStatus:", session.paymentStatus);
  try {
    const status = await getPhonePeOrderStatus(session.merchantOrderId);
    console.log("PhonePe status:", JSON.stringify(status, null, 2));
  } catch (e: any) {
    console.error("PhonePe error:", e.message);
  }
  process.exit(0);
};
run();
