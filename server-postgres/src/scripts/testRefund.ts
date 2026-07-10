// @ts-nocheck
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";
import { BookingPaymentTransaction } from "../client/models/BookingPayment";
import { Wallet } from "../client/models/Wallet";
import { initiateRefund } from "../client/services/RefundService";
import { Booking } from "../client/models/Booking";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to DB.");

    // Create a dummy user
    const user = await User.create({
      name: "Refund Test User",
      email: `refund-test-${Date.now()}@example.com`,
      phone: `99${Math.floor(Math.random() * 100000000)}`,
      password: "password123",
      role: "Player",
    });
    console.log("Created user:", user._id);

    // Create a dummy booking
    const booking = await Booking.create({
      userId: user._id,
      organizerId: user._id,
      venueId: new mongoose.Types.ObjectId(), // Dummy ID
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 1000,
      status: "CONFIRMED",
      sport: "Badminton",
      participantName: "Test Player",
    });
    console.log("Created booking:", booking._id);

    // Test 1: STORE_CREDIT
    const transaction1 = await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId: user._id,
      merchantOrderId: `ORDER-${Date.now()}-1`,
      amount: 1000,
      status: "COMPLETED",
    });

    console.log("\nTesting STORE_CREDIT refund...");
    const result1 = await initiateRefund({
      bookingPaymentTransactionId: transaction1._id.toString(),
      amount: 500,
      refundMethod: "STORE_CREDIT",
    });
    console.log("STORE_CREDIT Result:", result1);

    const userWallet = await Wallet.findOne({ userId: user._id });
    console.log("User wallet balance:", userWallet?.balance);

    // Test 2: BANK_TRANSFER
    const transaction2 = await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId: user._id,
      merchantOrderId: `ORDER-${Date.now()}-2`,
      amount: 1000,
      status: "COMPLETED",
    });

    console.log("\nTesting BANK_TRANSFER refund...");
    const result2 = await initiateRefund({
      bookingPaymentTransactionId: transaction2._id.toString(),
      amount: 1000,
      refundMethod: "BANK_TRANSFER",
      bankDetails: {
        accountHolderName: "Test Name",
        accountNumber: "1234567890",
        ifscCode: "HDFC0000001",
      },
    });
    console.log("BANK_TRANSFER Result:", result2);

    // Test 3: ORIGINAL_CARD (PhonePe)
    // This might fail if PhonePe API is not configured or in sandbox, but we can catch it
    const transaction3 = await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId: user._id,
      merchantOrderId: `ORDER-${Date.now()}-3`,
      amount: 1000,
      status: "COMPLETED",
    });

    console.log("\nTesting ORIGINAL_CARD refund...");
    try {
      const result3 = await initiateRefund({
        bookingPaymentTransactionId: transaction3._id.toString(),
        amount: 1000,
        refundMethod: "ORIGINAL_CARD",
      });
      console.log("ORIGINAL_CARD Result:", result3);
    } catch (err: any) {
      console.log(
        "ORIGINAL_CARD threw an expected error (likely PhonePe auth/config):",
        err.message,
      );
    }

    // Cleanup
    await User.findByIdAndDelete(user._id);
    await Booking.findByIdAndDelete(booking._id);
    await BookingPaymentTransaction.deleteMany({
      _id: { $in: [transaction1._id, transaction2._id, transaction3._id] },
    });
    console.log("\nCleanup successful.");

    process.exit(0);
  } catch (err) {
    console.error("Test script failed:", err);
    process.exit(1);
  }
};

run();
