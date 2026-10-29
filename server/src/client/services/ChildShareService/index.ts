import crypto from "crypto";
import {
  CHILD_HISTORY_LIMITS,
  CHILD_SHARE_LIFETIME_DAYS,
  CHILD_SHARE_PURGE_AFTER_EXPIRY_DAYS,
  CHILD_SHARE_SECTIONS,
  type ChildSharePublicView,
  type ChildShareListItem,
  type ChildShareSection,
} from "@powermysport/shared-types";
import mongoose from "mongoose";
import { AppError } from "../../../utils/AppError";
import { CHILD_SHARING_CONSENT_VERSION } from "../../../shared/services/AuthService/shared";
import { sendContactRequestEmail } from "../../../utils/email";
import { ChildShare, type ChildShareDocument } from "../../models/ChildShare";
import { ContactRequest } from "../../models/ContactRequest";
import { User } from "../../models/User";
import { ChildVideo } from "../../models/ChildVideo";
import { Player } from "../../models/Player";
import { s3Service } from "../../../shared/services/S3Service";
import { assertOwnedChild, ChildHistoryService } from "../ChildHistoryService";
import { plainText } from "../ChildHistoryService/text";
import { cvFileName, renderCvPdf } from "./cv";
import { serializeChildForShare } from "./serialize";

/**
 * Links a parent makes so one person, usually a university coach, can read a trimmed copy of
 * their child's profile without an account.
 *
 * The token in the link is 32 random bytes. Only its hash is stored, so a copy of the database
 * cannot open anyone's profile, and the link cannot be shown again after it is created. Whether
 * a link works is decided from the stored document on every request, never from a cache, so
 * stopping a link takes effect at once and does not depend on Redis.
 *
 * Everything a link reveals is chosen when it is made: the sections and the clips. A clip added
 * later is not shared by an older link. What the response may contain is decided in `serialize`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAYBACK_SECONDS = 600;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** One address: no spaces, quotes, commas or brackets, so it cannot name a second recipient. */
const EMAIL_SHAPE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const siteUrl = (): string =>
  (process.env.FRONTEND_URL?.trim() || "https://powermysport.com").replace(/\/+$/, "");

type Status = ChildShareListItem["status"];

const statusOf = (share: Pick<ChildShareDocument, "revokedAt" | "expiresAt">, now: Date): Status =>
  share.revokedAt ? "revoked" : share.expiresAt.getTime() <= now.getTime() ? "expired" : "active";

const present = (share: ChildShareDocument, now: Date): ChildShareListItem => ({
  id: String(share._id),
  recipientLabel: share.recipientLabel,
  sections: share.sections,
  videoCount: share.videoIds.length,
  createdAt: share.createdAt.toISOString(),
  expiresAt: share.expiresAt.toISOString(),
  ...(share.revokedAt ? { revokedAt: share.revokedAt.toISOString() } : {}),
  status: statusOf(share, now),
  openCount: share.openCount,
  ...(share.lastOpenedAt ? { lastOpenedAt: share.lastOpenedAt.toISOString() } : {}),
});

export interface ShareChoice {
  sections: ChildShareSection[];
  videoIds?: string[] | undefined;
}

/** Order and de-duplicate the sections, and decide which clips go with the link. */
const resolveChoice = async (
  childId: string,
  choice: ShareChoice
): Promise<{ sections: ChildShareSection[]; videoIds: mongoose.Types.ObjectId[] }> => {
  const picked = new Set(choice.sections);
  const sections = CHILD_SHARE_SECTIONS.filter((section) => picked.has(section));
  if (sections.length === 0) throw new AppError("Choose at least one section to share.", 400);

  if (!sections.includes("videos")) return { sections, videoIds: [] };

  // Only this child's finished clips can be shared. Asking for one that is not theirs is refused
  // rather than quietly dropped, so a mistake is noticed.
  const ready = await ChildVideo.find({ childId, status: "ready" }).select("_id").lean();
  const readyIds = new Set(ready.map((video) => String(video._id)));
  const wanted = choice.videoIds ?? [...readyIds];
  if (wanted.some((id) => !readyIds.has(String(id)))) {
    throw new AppError("One of those videos is not available to share.", 400);
  }
  const unique = [...new Set(wanted.map(String))];
  // Videos ticked with nothing to show is a section with no content, so it is left out.
  if (unique.length === 0) {
    return { sections: sections.filter((section) => section !== "videos"), videoIds: [] };
  }
  return { sections, videoIds: unique.map((id) => new mongoose.Types.ObjectId(id)) };
};

const publicViewOf = async (
  userId: string,
  childId: string,
  selection: {
    sections: ChildShareSection[];
    videoIds: Array<{ toString(): string }>;
    sharedAt: Date;
    expiresAt: Date;
  }
): Promise<ChildSharePublicView> => {
  const [view, player] = await Promise.all([
    ChildHistoryService.get(userId, childId),
    Player.findById(childId).select("location").lean(),
  ]);
  return serializeChildForShare(
    view,
    { ...selection, videoIds: selection.videoIds.map(String) },
    player?.location ?? null
  );
};

/** What the parent sees in step 2 of the share dialog: exactly what the coach would see. */
export const ChildShareService = {
  async preview(
    userId: string,
    childId: string,
    choice: ShareChoice,
    now: Date = new Date()
  ): Promise<ChildSharePublicView> {
    await assertOwnedChild(userId, childId);
    const { sections, videoIds } = await resolveChoice(childId, choice);
    return publicViewOf(userId, childId, {
      sections,
      videoIds,
      sharedAt: now,
      expiresAt: new Date(now.getTime() + CHILD_SHARE_LIFETIME_DAYS * DAY_MS),
    });
  },

  async create(
    userId: string,
    childId: string,
    input: ShareChoice & { recipientLabel: string; consent: boolean },
    now: Date = new Date()
  ): Promise<{ share: ChildShareListItem; url: string }> {
    await assertOwnedChild(userId, childId);

    // The route's schema already refuses anything but `true`; this is the same rule for a caller
    // that reaches the service another way.
    if (input.consent !== true) {
      throw new AppError("Please confirm you are this child's parent or guardian to share.", 428);
    }
    const recipientLabel = plainText(input.recipientLabel, CHILD_HISTORY_LIMITS.shareLabelChars);
    if (!recipientLabel) throw new AppError("Say who this link is for.", 400);

    const live = await ChildShare.countDocuments({
      childId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
    });
    if (live >= CHILD_HISTORY_LIMITS.activeSharesPerChild) {
      throw new AppError(
        `A child can have up to ${CHILD_HISTORY_LIMITS.activeSharesPerChild} links at once. Stop one before making another.`,
        400
      );
    }

    const { sections, videoIds } = await resolveChoice(childId, input);
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + CHILD_SHARE_LIFETIME_DAYS * DAY_MS);

    const created = await ChildShare.create({
      childId,
      userId,
      recipientLabel,
      tokenHash: hashToken(token),
      sections,
      videoIds,
      expiresAt,
      purgeAt: new Date(expiresAt.getTime() + CHILD_SHARE_PURGE_AFTER_EXPIRY_DAYS * DAY_MS),
      consentVersion: CHILD_SHARING_CONSENT_VERSION,
      consentAt: now,
    });

    // The only time the link exists in readable form. It is not stored and cannot be shown again.
    return { share: present(created, now), url: `${siteUrl()}/share/${token}` };
  },

  async list(
    userId: string,
    childId: string,
    now: Date = new Date()
  ): Promise<ChildShareListItem[]> {
    await assertOwnedChild(userId, childId);
    const shares = await ChildShare.find({ childId, userId }).sort({ createdAt: -1 });
    return shares.map((share) => present(share, now));
  },

  /** Stops a link. It answers "no longer active" from this moment. */
  async revoke(
    userId: string,
    childId: string,
    shareId: string,
    now: Date = new Date()
  ): Promise<ChildShareListItem> {
    await assertOwnedChild(userId, childId);
    if (!mongoose.isValidObjectId(shareId)) throw new AppError("That link was not found.", 404);
    const share = await ChildShare.findOne({ _id: shareId, childId, userId });
    if (!share) throw new AppError("That link was not found.", 404);
    if (!share.revokedAt) {
      share.revokedAt = now;
      await share.save();
    }
    return present(share, now);
  },

  /**
   * Finds the live link behind a token, or says why there is none. An unknown token is a 404 for
   * every kind of wrong (too short, never issued, purged); a link that existed and is over is a
   * 410, so the person holding it is told to ask for a new one.
   */
  async resolve(token: string, now: Date = new Date()): Promise<ChildShareDocument> {
    if (!TOKEN_PATTERN.test(token)) throw new AppError("This link was not found.", 404);
    const share = await ChildShare.findOne({ tokenHash: hashToken(token) });
    if (!share) throw new AppError("This link was not found.", 404);
    if (statusOf(share, now) !== "active") {
      throw new AppError("This link is no longer active. Ask the family for a new one.", 410);
    }
    return share;
  },

  /**
   * The profile behind a live link. A child deleted after the link was made ends the link: that
   * is "no longer active", not "missing".
   */
  async viewFor(share: ChildShareDocument): Promise<ChildSharePublicView> {
    try {
      return await publicViewOf(String(share.userId), String(share.childId), {
        sections: share.sections,
        videoIds: share.videoIds,
        sharedAt: share.createdAt,
        expiresAt: share.expiresAt,
      });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        throw new AppError("This link is no longer active. Ask the family for a new one.", 410);
      }
      throw error;
    }
  },

  /** What a coach sees when they open the link. Counts the open. */
  async openPublic(token: string, now: Date = new Date()): Promise<ChildSharePublicView> {
    const share = await ChildShareService.resolve(token, now);
    const view = await ChildShareService.viewFor(share);
    await ChildShare.updateOne(
      { _id: share._id },
      { $inc: { openCount: 1 }, $set: { lastOpenedAt: now } }
    );
    return view;
  },

  /**
   * The CV for a live link, as a PDF. Built from the same view the page shows, so the two cannot
   * differ. Downloading it is not counted as an open: the page was opened to find the button.
   */
  async cvPublic(token: string, now: Date = new Date()) {
    const share = await ChildShareService.resolve(token, now);
    const view = await ChildShareService.viewFor(share);
    return { pdf: await renderCvPdf(view), fileName: cvFileName(view) };
  },

  /** The parent's own copy, for a choice they have not made a link for yet. */
  async cvPreview(userId: string, childId: string, choice: ShareChoice, now: Date = new Date()) {
    const view = await ChildShareService.preview(userId, childId, choice, now);
    return { pdf: await renderCvPdf(view), fileName: cvFileName(view) };
  },

  /**
   * Someone holding a link asks to be put in touch. The family hears about it by email; the
   * sender never learns the family's address, and the family is told the sender is unchecked.
   *
   *  - A link takes at most ten requests in its life, counted in the database, so a flood is
   *    capped even when the rate limits (which fail open without Redis) are not holding.
   *  - The same address asking again within a day is answered as sent but not sent again, so one
   *    person pressing the button twice does not email the parent twice.
   *  - If the email cannot be sent the request is removed and the sender is told, because a
   *    request the family will never see must not look like one that went through.
   */
  async contact(
    token: string,
    input: { name: string; email: string; message?: string | undefined },
    now: Date = new Date()
  ): Promise<{ sent: true }> {
    const share = await ChildShareService.resolve(token, now);

    const name = plainText(input.name, CHILD_HISTORY_LIMITS.contactNameChars);
    const message = plainText(input.message, CHILD_HISTORY_LIMITS.contactMessageChars);
    const email = String(input.email ?? "")
      .trim()
      .toLowerCase();
    if (!name) throw new AppError("Add your name.", 400);
    if (!EMAIL_SHAPE.test(email) || email.length > 254) {
      throw new AppError("That email address does not look right.", 400);
    }

    const already = await ContactRequest.exists({
      shareId: share._id,
      email,
      createdAt: { $gt: new Date(now.getTime() - DAY_MS) },
    });
    if (already) return { sent: true };

    const taken = await ContactRequest.countDocuments({ shareId: share._id });
    if (taken >= CHILD_HISTORY_LIMITS.contactRequestsPerShare) {
      throw new AppError(
        "This link has taken all the requests it can. Ask the family to send you a new one.",
        429
      );
    }

    const [parent, child] = await Promise.all([
      User.findById(share.userId).select("name email").lean(),
      Player.findById(share.childId).select("name").lean(),
    ]);
    if (!parent?.email || !child) {
      throw new AppError("This link is no longer active. Ask the family for a new one.", 410);
    }

    const request = await ContactRequest.create({
      shareId: share._id,
      childId: share.childId,
      userId: share.userId,
      name,
      email,
      ...(message ? { message } : {}),
    });

    try {
      await sendContactRequestEmail({
        to: parent.email,
        parentName: parent.name ?? "there",
        childName: child.name,
        childId: String(share.childId),
        recipientLabel: share.recipientLabel,
        coachName: name,
        coachEmail: email,
        message,
      });
    } catch {
      await ContactRequest.deleteOne({ _id: request._id });
      throw new AppError("Your request could not be sent. Please try again.", 502);
    }
    return { sent: true };
  },

  /** A ten-minute link to play one clip the parent ticked for this link. */
  async playbackFor(token: string, videoId: string, now: Date = new Date()) {
    const share = await ChildShareService.resolve(token, now);
    const allowed =
      share.sections.includes("videos") && share.videoIds.some((id) => String(id) === videoId);
    if (!allowed || !mongoose.isValidObjectId(videoId)) {
      throw new AppError("That video was not found.", 404);
    }
    const video = await ChildVideo.findOne({
      _id: videoId,
      childId: share.childId,
      status: "ready",
    }).lean();
    if (!video) throw new AppError("That video was not found.", 404);

    const url = await s3Service.generateChildVideoPlaybackUrl(
      video.storageKey,
      video.contentType,
      PLAYBACK_SECONDS
    );
    return { url, expiresInSeconds: PLAYBACK_SECONDS };
  },
};
