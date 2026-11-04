import mongoose, { Schema, Document, Model } from "mongoose";

export type FriendConnectionStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "BLOCKED";

export interface IFriendConnection extends Document {
  requesterId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  status: FriendConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const friendConnectionSchema = new Schema<IFriendConnection>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED", "BLOCKED"],
      default: "PENDING",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
friendConnectionSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
friendConnectionSchema.index({ recipientId: 1, status: 1 });
friendConnectionSchema.index({ requesterId: 1, status: 1 });
// getFriends filters {requesterId|recipientId, status:"ACCEPTED"} via $or
// and sorts {updatedAt:-1} — the two-field indexes above still leave the
// $or's merged result needing an in-memory sort, but adding updatedAt lets
// each branch's own index scan come out pre-sorted, cutting how much of
// that merge-sort work is left. (getPendingRequests' equivalent {createdAt}
// sort is a much smaller per-user result set — PENDING requests, not the
// full friend list — so left as-is rather than adding a second pair of
// indexes for it.) Production has autoIndex off, so this also needs
// migration 35.
friendConnectionSchema.index({ recipientId: 1, status: 1, updatedAt: -1 });
friendConnectionSchema.index({ requesterId: 1, status: 1, updatedAt: -1 });

// Prevent self-friendship
friendConnectionSchema.pre("save", function () {
  if (this.requesterId.equals(this.recipientId)) {
    throw new Error("Cannot send friend request to yourself");
  }
});

const FriendConnection: Model<IFriendConnection> = mongoose.model<IFriendConnection>(
  "FriendConnection",
  friendConnectionSchema
);

export default FriendConnection;
