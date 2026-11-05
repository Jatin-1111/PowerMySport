import { randomUUID } from "node:crypto";
import { CHILD_HISTORY_LIMITS, type ChildPhotoContentType } from "@powermysport/shared-types";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError";
import { log as __rootLog } from "../../utils/logger";
import { s3Service } from "../../shared/services/S3Service";
import { ChildEvent } from "../models/ChildEvent";
import { ChildShare } from "../models/ChildShare";
import { assertOwnedChild } from "./ChildHistoryService";

const log = __rootLog.child("childPhoto");

/**
 * A photo of the certificate or result sheet behind an entry, from the parent's phone to private
 * storage and back to the parent.
 *
 * Same shape as the clips: the file never passes through the API server. The server decides
 * whether an upload may start (ownership, type, size, one photo per entry, a per-child ceiling),
 * hands the phone one signed link with the exact length and type baked into the signature, and
 * checks the stored object's real size and type before the photo counts. What the phone says is
 * advisory; storage and the final check enforce the limits.
 *
 * A photo is private to the parent. Nothing here puts it in a shared link: that is a separate,
 * explicit step in the share flow.
 */

const VIEW_SECONDS = 600;
const UPLOAD_SECONDS = 600;

const EXTENSION: Record<ChildPhotoContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface StartPhotoInput {
  contentType: ChildPhotoContentType;
  sizeBytes: number;
}

const ownedEvent = async (userId: string, childId: string, eventId: string) => {
  await assertOwnedChild(userId, childId);
  if (!mongoose.isValidObjectId(eventId)) throw new AppError("That entry was not found.", 404);
  const event = await ChildEvent.findOne({ _id: eventId, childId, userId });
  if (!event) throw new AppError("That entry was not found.", 404);
  return event;
};

const dropObject = async (key: string): Promise<void> => {
  try {
    await s3Service.deleteFiles([key], "childVideos");
  } catch (error) {
    log.warn(`could not remove photo object: ${(error as Error).message}`);
    throw new AppError("Could not remove the photo just now. Please try again.", 502);
  }
};

export const ChildEventPhotoService = {
  /** Opens an upload: returns one signed link, good for exactly the declared size and type. */
  async startUpload(userId: string, childId: string, eventId: string, input: StartPhotoInput) {
    const event = await ownedEvent(userId, childId, eventId);

    if (event.photo?.status === "ready") {
      throw new AppError("This entry already has a photo. Remove it first to add another.", 409);
    }
    if (input.sizeBytes > CHILD_HISTORY_LIMITS.photoMaxBytes) {
      throw new AppError(
        `That photo is larger than ${CHILD_HISTORY_LIMITS.photoMaxBytes / (1024 * 1024)} MB.`,
        400
      );
    }
    if (!event.photo) {
      const held = await ChildEvent.countDocuments({ childId, "photo.key": { $exists: true } });
      if (held >= CHILD_HISTORY_LIMITS.photosPerChild) {
        throw new AppError(
          `A child can have up to ${CHILD_HISTORY_LIMITS.photosPerChild} photos. Remove one before adding another.`,
          400
        );
      }
    } else {
      // An earlier attempt that never finished: its object is removed before a new one starts.
      await dropObject(event.photo.key);
    }

    const key = `child-photos/${childId}/${eventId}-${randomUUID()}.${EXTENSION[input.contentType]}`;
    const url = await s3Service.generateChildPhotoUploadUrl(
      key,
      input.contentType,
      input.sizeBytes,
      UPLOAD_SECONDS
    );

    // Not while a finished photo is there, even if two requests race.
    const saved = await ChildEvent.findOneAndUpdate(
      { _id: eventId, childId, userId, "photo.status": { $ne: "ready" } },
      {
        $set: {
          photo: {
            status: "uploading",
            key,
            contentType: input.contentType,
            declaredBytes: input.sizeBytes,
            startedAt: new Date(),
          },
        },
      },
      { new: true }
    );
    if (!saved) {
      await s3Service.deleteFiles([key], "childVideos").catch(() => undefined);
      throw new AppError("This entry already has a photo. Remove it first to add another.", 409);
    }

    return {
      upload: {
        url,
        method: "PUT" as const,
        headers: { "Content-Type": input.contentType },
        expiresInSeconds: UPLOAD_SECONDS,
      },
    };
  },

  /** Checks what was stored against what was agreed, then the photo counts. Safe to call twice. */
  async completeUpload(userId: string, childId: string, eventId: string) {
    const event = await ownedEvent(userId, childId, eventId);
    if (event.photo?.status === "ready") return { hasPhoto: true as const };
    if (!event.photo) throw new AppError("There is no photo upload to finish.", 409);

    const { key, contentType, declaredBytes } = event.photo;
    let stored: { sizeBytes: number; contentType: string } | null;
    try {
      stored = await s3Service.headChildPhoto(key);
    } catch (error) {
      log.warn(`could not check photo upload: ${(error as Error).message}`);
      throw new AppError("The upload could not be checked. Try again.", 502);
    }
    if (!stored) {
      throw new AppError("The photo did not arrive. Try the upload again.", 400);
    }
    if (stored.sizeBytes !== declaredBytes || stored.contentType !== contentType) {
      // What arrived is not what was agreed. It is removed rather than trusted.
      await s3Service.deleteFiles([key], "childVideos").catch(() => undefined);
      await ChildEvent.updateOne({ _id: eventId }, { $unset: { photo: "" } });
      throw new AppError("The photo that arrived was not the one expected. Try again.", 400);
    }

    await ChildEvent.updateOne(
      { _id: eventId, "photo.status": "uploading" },
      { $set: { "photo.status": "ready", "photo.sizeBytes": stored.sizeBytes } }
    );
    return { hasPhoto: true as const };
  },

  /** A link that shows the photo for ten minutes. Only the parent's own, finished photo. */
  async viewUrl(userId: string, childId: string, eventId: string) {
    const event = await ownedEvent(userId, childId, eventId);
    if (event.photo?.status !== "ready") throw new AppError("This entry has no photo.", 404);
    const url = await s3Service.generateChildPhotoViewUrl(
      event.photo.key,
      event.photo.contentType,
      VIEW_SECONDS
    );
    return { url, expiresInSeconds: VIEW_SECONDS };
  },

  /** Removes the photo, finished or not, from storage and from the entry. */
  async remove(userId: string, childId: string, eventId: string): Promise<void> {
    const event = await ownedEvent(userId, childId, eventId);
    if (!event.photo) return;
    await dropObject(event.photo.key);
    await ChildEvent.updateOne({ _id: eventId }, { $unset: { photo: "" } });
    // A link that listed this photo stops showing it, even before the check at view time.
    await ChildShare.updateMany({ childId }, { $pull: { photoEventIds: event._id } });
  },
};
