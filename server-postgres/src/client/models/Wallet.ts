import mongoose, { Document, Schema } from "mongoose";

export type WalletTransactionType = "CREDIT" | "DEBIT";
export type WalletTransactionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface WalletTransaction {
  id: string; // Unique transaction ID (e.g. for idempotency or external reference)
  type: WalletTransactionType;
  amount: number;
  status: WalletTransactionStatus;
  reason: string;
  referenceId?: string; // e.g. bookingPaymentTransactionId or TopUp order ID
  createdAt: Date;
}

export interface WalletDocument extends Document {
  userId: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<WalletTransaction>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      required: true,
      default: "COMPLETED",
    },
    reason: { type: String, required: true },
    referenceId: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const walletSchema = new Schema<WalletDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One wallet per user
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0, // Balance cannot be negative
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
    },
    transactions: [walletTransactionSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc: any, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Wallet = mongoose.model<WalletDocument>("Wallet", walletSchema);
