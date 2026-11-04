import {
  CHILD_HISTORY_LIMITS,
  type ChildVideoContentType,
  type ChildVideoView,
} from "@powermysport/shared-types";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError";
import { log as __rootLog } from "../../utils/logger";
import { s3Service } from "../../shared/services/S3Service";
import { CHILD_VIDEO_CONSENT_VERSION } from "../../shared/services/AuthService/shared";
import { ChildShare } from "../models/ChildShare";
import { ChildVideo } from "../models/ChildVideo";
import { Player } from "../models/Player";
import { User } from "../models/User";
import { assertOwnedChild } from "./ChildHistoryService";
import { plainText } from "./ChildHistoryService/text";
import { hasCurrentVideoConsent, presentVideo } from "./ChildHistoryService/videos";
import { removeChildVideos } from "./ChildVideoCleanup";

const log = __rootLog.child("childVideo");

/**
 * A parent's clips of their child, from their phone to private storage and back to a viewer.
 *
 * The file never passes through the API server. The server decides whether an upload may start
 * (consent, how many clips, how much today, what type and size), hands the browser one signed
 * link per part with the exact size of that part baked into the signature, and then checks the
 * stored object's real size before the clip counts. The size limit is therefore enforced by
 * storage and by a final check, not by what the browser says. The length limit is the browser's
 * word only, because the server has no way to read it, so it is advisory.
 *
 * No conversion: a clip is played as uploaded. A clip a browser cannot play is the parent's to
 * fix, and the screen checks it plays before uploading.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAYBACK_SECONDS = 600;
const PART_BYTES = CHILD_HISTORY_LIMITS.videoPartBytes;

const EXTENSION: Record<ChildVideoContentType, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export interface StartUploadInput {
  contentType: ChildVideoContentType;
  sizeBytes: number;
  durationSeconds?: number | undefined;
  title?: string | undefined;
}

export interface UploadPlan {
  videoId: string;
  partBytes: number;
  parts: Array<{ partNumber: number; url: string; sizeBytes: number }>;
}

const partCount = (sizeBytes: number): number => Math.ceil(sizeBytes / PART_BYTES);

/** The sizes of each part: every part is full size except the last. */
const partSizes = (sizeBytes: number): number[] => {
  const count = partCount(sizeBytes);
  return Array.from({ length: count }, (_, index) =>
    index < count - 1 ? PART_BYTES : sizeBytes - PART_BYTES * (count - 1)
  );
};

const ownedVideo = async (userId: string, childId: string, videoId: string) => {
  await assertOwnedChild(userId, childId);
  if (!mongoose.isValidObjectId(videoId)) throw new AppError("That video was not found.", 404);
  const video = await ChildVideo.findOne({ _id: videoId, childId, userId });
  if (!video) throw new AppError("That video was not found.", 404);
  return video;
};

export const ChildVideoService = {
  /** Records the parent's agreement to the video notice. Asked once, and again if the wording changes. */
  async recordConsent(userId: string): Promise<void> {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "legalConsents.childVideo": {
            accepted: true,
            acceptedAt: new Date(),
            version: CHILD_VIDEO_CONSENT_VERSION,
          },
        },
      }
    );
  },

  hasConsent: hasCurrentVideoConsent,

  async startUpload(
    userId: string,
    childId: string,
    input: StartUploadInput,
    now: Date = new Date()
  ): Promise<UploadPlan> {
    await assertOwnedChild(userId, childId);

    // 428 tells the screen to show the notice and ask again, the way adding a child does.
    if (!(await hasCurrentVideoConsent(userId))) {
      throw new AppError("Please read and accept the video notice before adding a video.", 428);
    }

    const { videoMaxBytes, videoMaxSeconds, videosPerChild, videoBytesPerDay } =
      CHILD_HISTORY_LIMITS;
    if (input.sizeBytes > videoMaxBytes) {
      throw new AppError(
        `That video is larger than ${Math.round(videoMaxBytes / (1024 * 1024))} MB. Choose a shorter clip.`,
        400
      );
    }
    if (typeof input.durationSeconds === "number" && input.durationSeconds > videoMaxSeconds) {
      throw new AppError(
        `That video is longer than ${videoMaxSeconds / 60} minutes. Choose a shorter clip.`,
        400
      );
    }

    // An upload nobody finished counts for a day, then the sweep removes it.
    const since = new Date(now.getTime() - DAY_MS);
    const held = await ChildVideo.countDocuments({
      childId,
      $or: [{ status: "ready" }, { status: "uploading", createdAt: { $gt: since } }],
    });
    if (held >= videosPerChild) {
      throw new AppError(
        `A child can have up to ${videosPerChild} videos. Remove one before adding another.`,
        400
      );
    }

    const today = await ChildVideo.aggregate<{ total: number }>([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gt: since } } },
      { $group: { _id: null, total: { $sum: "$declaredBytes" } } },
    ]);
    if ((today[0]?.total ?? 0) + input.sizeBytes > videoBytesPerDay) {
      throw new AppError(
        "That is the most video that can be added in a day. Try again tomorrow.",
        429
      );
    }

    const _id = new mongoose.Types.ObjectId();
    const storageKey = `child-videos/${childId}/${_id}.${EXTENSION[input.contentType]}`;
    const uploadId = await s3Service.createChildVideoUpload(storageKey, input.contentType);

    try {
      const title = plainText(input.title, 120);
      await ChildVideo.create({
        _id,
        childId,
        userId,
        status: "uploading",
        storageKey,
        contentType: input.contentType,
        declaredBytes: input.sizeBytes,
        uploadId,
        ...(title ? { title } : {}),
        ...(typeof input.durationSeconds === "number"
          ? { durationSeconds: input.durationSeconds }
          : {}),
      });

      const sizes = partSizes(input.sizeBytes);
      const parts = await Promise.all(
        sizes.map(async (sizeBytes, index) => ({
          partNumber: index + 1,
          sizeBytes,
          url: await s3Service.presignChildVideoPart(storageKey, uploadId, index + 1, sizeBytes),
        }))
      );
      return { videoId: String(_id), partBytes: PART_BYTES, parts };
    } catch (error) {
      // Nothing half-made is left behind: no open upload in storage and no row pointing at it.
      await s3Service.abortChildVideoUpload(storageKey, uploadId).catch(() => undefined);
      await ChildVideo.deleteOne({ _id });
      throw error;
    }
  },

  /** Closes the upload and checks what was stored. Safe to call twice: a finished clip is returned as is. */
  async completeUpload(
    userId: string,
    childId: string,
    videoId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<ChildVideoView> {
    const video = await ownedVideo(userId, childId, videoId);
    if (video.status === "ready") return presentVideo(video);
    if (video.status !== "uploading" || !video.uploadId) {
      throw new AppError("That upload cannot be finished. Start it again.", 409);
    }

    const expected = partCount(video.declaredBytes);
    const numbers = new Set(parts.map((part) => part.partNumber));
    const complete =
      parts.length === expected &&
      numbers.size === expected &&
      parts.every((part) => part.partNumber >= 1 && part.partNumber <= expected && part.etag);
    if (!complete) {
      throw new AppError("Some parts of the video did not arrive. Try the upload again.", 400);
    }

    try {
      await s3Service.completeChildVideoUpload(video.storageKey, video.uploadId, parts);
    } catch (error) {
      log.warn(`could not complete video ${videoId}: ${(error as Error).message}`);
      throw new AppError("The upload could not be finished. Try again.", 502);
    }

    const stored = await s3Service.headChildVideo(video.storageKey);
    if (!stored || stored.sizeBytes !== video.declaredBytes) {
      // What arrived is not what was agreed. It is removed rather than trusted.
      await s3Service.deleteFiles([video.storageKey], "childVideos").catch(() => undefined);
      await ChildVideo.updateOne(
        { _id: video._id },
        { $set: { status: "failed", failureReason: "size_mismatch" }, $unset: { uploadId: "" } }
      );
      throw new AppError("The video that arrived was not the size expected. Try again.", 400);
    }

    const ready = await ChildVideo.findOneAndUpdate(
      { _id: video._id, status: "uploading" },
      { $set: { status: "ready", sizeBytes: stored.sizeBytes }, $unset: { uploadId: "" } },
      { new: true }
    );
    return presentVideo(ready ?? video);
  },

  /** Removes a clip, or cancels one still uploading, along with its file and any share that listed it. */
  async deleteVideo(userId: string, childId: string, videoId: string): Promise<void> {
    const video = await ownedVideo(userId, childId, videoId);
    if (video.status === "uploading" && video.uploadId) {
      await s3Service.abortChildVideoUpload(video.storageKey, video.uploadId);
    }
    await s3Service.deleteFiles([video.storageKey], "childVideos");
    await ChildVideo.deleteOne({ _id: video._id });
    await ChildShare.updateMany({ childId }, { $pull: { videoIds: video._id } });
  },

  /** A link that plays a clip for ten minutes. Only for the parent's own, finished clip. */
  async playbackUrl(userId: string, childId: string, videoId: string) {
    const video = await ownedVideo(userId, childId, videoId);
    if (video.status !== "ready") throw new AppError("That video is not ready yet.", 409);
    const url = await s3Service.generateChildVideoPlaybackUrl(
      video.storageKey,
      video.contentType,
      PLAYBACK_SECONDS
    );
    return { url, expiresInSeconds: PLAYBACK_SECONDS };
  },

  /**
   * Housekeeping, run with the other scheduled cleanups.
   *  - An upload still open after a day was abandoned: its parts and row are removed.
   *  - A failed clip is cleared a day after it failed.
   *  - A clip whose child no longer exists is removed with its file, which catches any
   *    deletion that stopped half way.
   */
  async sweep(
    now: Date = new Date()
  ): Promise<{ abandoned: number; failed: number; orphaned: number }> {
    const cutoff = new Date(now.getTime() - DAY_MS);
    let abandoned = 0;
    let failed = 0;
    let orphaned = 0;

    const stale = await ChildVideo.find({
      status: { $in: ["uploading", "failed"] },
      createdAt: { $lt: cutoff },
    });
    for (const video of stale) {
      try {
        if (video.status === "uploading" && video.uploadId) {
          await s3Service.abortChildVideoUpload(video.storageKey, video.uploadId);
        }
        await s3Service.deleteFiles([video.storageKey], "childVideos");
        await ChildVideo.deleteOne({ _id: video._id });
        if (video.status === "uploading") abandoned += 1;
        else failed += 1;
      } catch (error) {
        log.warn(`sweep could not remove video ${video._id}: ${(error as Error).message}`);
      }
    }

    const childIds = (await ChildVideo.distinct("childId")) as mongoose.Types.ObjectId[];
    if (childIds.length > 0) {
      const alive = new Set(
        (
          await Player.find({ _id: { $in: childIds } })
            .select("_id")
            .lean()
        ).map((p) => String(p._id))
      );
      for (const childId of childIds.filter((id) => !alive.has(String(id)))) {
        try {
          orphaned += await removeChildVideos({ childId: String(childId) });
        } catch (error) {
          log.warn(
            `sweep could not remove videos of deleted child ${childId}: ${(error as Error).message}`
          );
        }
      }
    }

    return { abandoned, failed, orphaned };
  },
};
