import type { ChildVideoView } from "@powermysport/shared-types";
import { CHILD_VIDEO_CONSENT_VERSION } from "../../../shared/services/AuthService/shared";
import { ChildVideo, type ChildVideoDocument } from "../../models/ChildVideo";
import { User } from "../../models/User";

/** True when the parent has agreed to the current wording of the video notice. */
export const hasCurrentVideoConsent = async (userId: string): Promise<boolean> => {
  const user = await User.findById(userId).select("legalConsents.childVideo").lean();
  const consent = user?.legalConsents?.childVideo;
  return consent?.accepted === true && consent.version === CHILD_VIDEO_CONSENT_VERSION;
};

/**
 * How a clip is listed on a child's page.
 *
 * Kept apart from the upload service so the history page can list clips without importing the
 * code that talks to storage, and the upload service can import the history page's ownership
 * check without the two importing each other.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const presentVideo = (video: {
  _id: { toString(): string };
  title?: string | null | undefined;
  status: ChildVideoDocument["status"];
  sizeBytes?: number | null | undefined;
  durationSeconds?: number | null | undefined;
  createdAt: Date;
}): ChildVideoView => ({
  id: String(video._id),
  ...(video.title ? { title: video.title } : {}),
  status: video.status,
  ...(video.sizeBytes ? { sizeBytes: video.sizeBytes } : {}),
  ...(typeof video.durationSeconds === "number" ? { durationSeconds: video.durationSeconds } : {}),
  createdAt: video.createdAt.toISOString(),
});

/** Finished clips, and uploads still plausibly in progress. An upload older than a day was abandoned. */
export const listVideosFor = async (
  childId: string,
  now: Date = new Date()
): Promise<ChildVideoView[]> => {
  const since = new Date(now.getTime() - DAY_MS);
  const rows = await ChildVideo.find({
    childId,
    $or: [{ status: "ready" }, { status: "uploading", createdAt: { $gt: since } }],
  })
    .sort({ createdAt: -1 })
    .lean();
  return rows.map(presentVideo);
};
