import { ChildEvent } from "../models/ChildEvent";
import { s3Service } from "../../shared/services/S3Service";

/**
 * Removes the photos attached to a child's entries: one entry, one child, or every entry an
 * account owns. The files are deleted from storage first and the caller deletes the rows after, so
 * if storage refuses, the rows still say where the files are and the delete can be retried;
 * deleting the rows first would leave files nobody can find.
 *
 * Used by deleting an entry, deleting a child and deleting an account, so all three go through one
 * path. A photo still `uploading` is included: its key is stored from the moment the upload starts.
 */
export const removeEventPhotos = async (
  filter:
    { _id: string; childId: string; userId: string } | { childId: string } | { userId: string }
): Promise<number> => {
  const events = await ChildEvent.find({ ...filter, "photo.key": { $exists: true } })
    .select("photo.key")
    .lean();
  const keys = events
    .map((event) => event.photo?.key)
    .filter((key): key is string => typeof key === "string");
  if (keys.length === 0) return 0;

  // DeleteObjects takes up to 1000 keys; one child holds far fewer, an account is chunked.
  for (let i = 0; i < keys.length; i += 500) {
    await s3Service.deleteFiles(keys.slice(i, i + 500), "childVideos");
  }
  return keys.length;
};
