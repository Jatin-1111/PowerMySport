import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * One phone that can be sent push notifications through Expo.
 *
 * A token identifies a device, not a person: the same phone keeps its token when a different
 * account signs in, so registering a token that already exists moves it to the current account
 * rather than leaving the previous owner receiving someone else's alerts.
 *
 * `lastSeenAt` is bumped every time the app registers, which it does on each launch. A phone that
 * has not registered for 120 days is dropped by the TTL index (migration 72), so abandoned devices
 * do not accumulate and are not sent to.
 *
 * Indexes here are pinned against migration 72, because the deployed server has autoIndex off.
 */

export type DevicePlatform = "android" | "ios";

export interface IDevicePushToken extends Document {
  userId: Types.ObjectId;
  /** `ExponentPushToken[...]` or `ExpoPushToken[...]`. */
  token: string;
  platform: DevicePlatform;
  deviceName?: string;
  appVersion?: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Days a device may go without opening the app before it stops receiving push. */
export const DEVICE_TOKEN_TTL_DAYS = 120;

const devicePushTokenSchema = new Schema<IDevicePushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
    deviceName: { type: String, trim: true, maxlength: 80 },
    appVersion: { type: String, trim: true, maxlength: 20 },
    lastSeenAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * DEVICE_TOKEN_TTL_DAYS },
  },
  { timestamps: true }
);

export const DevicePushToken = mongoose.model<IDevicePushToken>(
  "DevicePushToken",
  devicePushTokenSchema
);
