import mongoose, { Document, Schema } from "mongoose";

export interface ShopWaitlistDocument extends Document {
  email: string;
  status: "PENDING" | "NOTIFIED";
  createdAt: Date;
  updatedAt: Date;
}

const shopWaitlistSchema = new Schema<ShopWaitlistDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "NOTIFIED"],
      default: "PENDING",
      index: true,
    },
  },
  { timestamps: true },
);

export const ShopWaitlist = mongoose.model<ShopWaitlistDocument>(
  "ShopWaitlist",
  shopWaitlistSchema,
);
