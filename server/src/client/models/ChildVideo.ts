import { CHILD_VIDEO_STATUSES } from "@powermysport/shared-types";
import type { ChildVideoStatus } from "@powermysport/shared-types";
import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * A clip of a child that a parent uploaded from their phone.
 *
 * The file lives in private storage under `storageKey` and is played as uploaded, with no
 * conversion, so only formats browsers play are accepted. It is never public: a coach reaches it
 * only through a short-lived link issued for a share the parent created.
 *
 * A row is created when the upload starts and stays `uploading` until the browser reports every
 * part sent and the server has checked the real object size. An upload that is never finished is
 * removed, with its object, by a sweep after a day.
 */
export interface ChildVideoDocument extends Document {
  childId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ChildVideoStatus;
  title?: string;
  /** Object key in the documents bucket, under `child-videos/`. */
  storageKey: string;
  contentType: string;
  /** What the browser said it would send; checked against the real object when the upload completes. */
  declaredBytes: number;
  /** The real size, read from storage once the upload completes. */
  sizeBytes?: number;
  durationSeconds?: number;
  /** Set while a multipart upload is open, so an abandoned one can be aborted. */
  uploadId?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const childVideoSchema = new Schema<ChildVideoDocument>(
  {
    childId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: [...CHILD_VIDEO_STATUSES], required: true, default: "uploading" },
    title: { type: String, trim: true, maxlength: 120 },
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    declaredBytes: { type: Number, required: true, min: 1 },
    sizeBytes: { type: Number, min: 1 },
    durationSeconds: { type: Number, min: 0 },
    uploadId: { type: String },
    failureReason: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

// One child's clips, newest first, and the count that enforces the per-child cap.
childVideoSchema.index({ childId: 1, createdAt: -1 }, { name: "childId_1_createdAt_-1" });
// The sweep for uploads nobody finished.
childVideoSchema.index({ status: 1, createdAt: 1 }, { name: "status_1_createdAt_1" });
// Deleting an account removes the clips and their files.
childVideoSchema.index({ userId: 1 }, { name: "userId_1" });

export const ChildVideo = mongoose.model<ChildVideoDocument>("ChildVideo", childVideoSchema);
