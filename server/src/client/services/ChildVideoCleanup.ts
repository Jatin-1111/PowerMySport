import { ChildVideo } from "../models/ChildVideo";
import { s3Service } from "../../shared/services/S3Service";

/**
 * Removes a child's clips, or every clip an account owns: open uploads are stopped, the files are
 * deleted, then the rows.
 *
 * The rows go last on purpose. If storage refuses, the rows stay and still say where the files
 * are, so a later sweep can finish the job; deleting the rows first would leave files nobody can
 * find. Used when a child is deleted and when an account is deleted, so both go through one path.
 */
export const removeChildVideos = async (
  filter: { childId: string } | { userId: string }
): Promise<number> => {
  const videos = await ChildVideo.find(filter).select("storageKey uploadId status").lean();
  if (videos.length === 0) return 0;

  // An upload still open holds its parts in storage and is billed for them until it is stopped.
  for (const video of videos) {
    if (video.status === "uploading" && video.uploadId) {
      await s3Service
        .abortChildVideoUpload(video.storageKey, video.uploadId)
        .catch(() => undefined);
    }
  }

  await s3Service.deleteFiles(
    videos.map((video) => video.storageKey),
    "childVideos"
  );
  const result = await ChildVideo.deleteMany(filter);
  return result.deletedCount;
};
