import mongoose, { Schema, Document, Model } from "mongoose";

export type FriendConnectionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "BLOCKED";

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
  },
);

// Compound indexes for efficient queries
friendConnectionSchema.index(
  { requesterId: 1, recipientId: 1 },
  { unique: true },
);
friendConnectionSchema.index({ recipientId: 1, status: 1 });
friendConnectionSchema.index({ requesterId: 1, status: 1 });

// Prevent self-friendship
friendConnectionSchema.pre("save", function () {
  if (this.requesterId.equals(this.recipientId)) {
    throw new Error("Cannot send friend request to yourself");
  }
});

const FriendConnection: Model<IFriendConnection> =
  mongoose.model<IFriendConnection>("FriendConnection", friendConnectionSchema);

export default FriendConnection;
