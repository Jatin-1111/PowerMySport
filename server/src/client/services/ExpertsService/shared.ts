import crypto from "crypto";
import mongoose from "mongoose";
import { Expert } from "../../models/ExpertProfile";
import { IPayoutMethod } from "../../models/Coach";
import { Player, PlayerDocument } from "../../models/Player";
import { NotificationService } from "../NotificationService";
import { decryptValue } from "../../../shared/utils/encryption";
import { s3Service } from "../../../shared/services/S3Service";
import { log as __rootLog } from "../../../utils/logger";
import { resolveChildAge } from "../../../utils/childAge";

export const log = __rootLog.child("experts");

export const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

export const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Enforces the literal checksum-style "Z" in the 14th character — stricter
// (and more correct) than the looser GSTIN regex historically used server-side
// for Academy's onboarding, matching what the client already validates.
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const decryptPayoutMethod = (m: IPayoutMethod): IPayoutMethod => {
  // exactOptionalPropertyTypes forbids assigning `string | undefined` to an
  // optional `string` field — only overwrite when there's an actual value.
  const out: IPayoutMethod = { ...m };
  if (out.accountNumber) out.accountNumber = decryptValue(out.accountNumber);
  if (out.ifscCode) out.ifscCode = decryptValue(out.ifscCode);
  if (out.upiId) out.upiId = decryptValue(out.upiId);
  return out;
};

export const generateTemporaryPassword = (): string =>
  crypto
    .randomBytes(9)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10) + "A1";

// ── Serialization ────────────────────────────────────────────────────────────

const expertUserName = (expert: any): { name?: string; email?: string } => {
  const u = expert?.userId;
  if (u && typeof u === "object") return { name: u.name, email: u.email };
  return {};
};

const ownerUserId = (expert: any): string | undefined => {
  const u = expert?.userId;
  if (u && typeof u === "object") return (u._id ?? u.id)?.toString();
  return u?.toString();
};

/**
 * A serialized expert with a photo URL that still loads. The stored URL is a
 * 7-day pre-signed link, so it is re-signed from its key on read; see
 * `S3Service.refreshOwnedImageUrl` for what it will and will not touch.
 */
export const withFreshPhoto = async <T extends { photoUrl?: string | undefined }>(
  serialized: T,
  expert: any
): Promise<T> => {
  const photoUrl = await s3Service.refreshOwnedImageUrl(serialized.photoUrl, ownerUserId(expert));
  return photoUrl === serialized.photoUrl ? serialized : ({ ...serialized, photoUrl } as T);
};

/**
 * The unauthenticated discovery view (GET /experts, GET /experts/:id, and the
 * assistant's search_experts tool). An explicit allow-list: a field added to the
 * Expert model or to `serializeExpert` stays private until it is named here.
 *
 * Deliberately absent: email, verificationStatus and createdAt (internal),
 * everything `serializeExpertFull` adds, and userId/phone, which are never
 * serialized by any expert view.
 */
export const serializeExpertPublic = (expert: any) => {
  const { name } = expertUserName(expert);
  return {
    id: expert._id?.toString(),
    _id: expert._id?.toString(),
    name,
    bio: expert.bio,
    sports: expert.sports || [],
    expertise: expert.expertise || [],
    achievements: expert.achievements,
    sessionFee: expert.sessionFee,
    sessionMode: expert.sessionMode,
    sessionDurationMinutes: expert.sessionDurationMinutes || 60,
    timezone: expert.timezone || "Asia/Kolkata",
    hasAvailability: (expert.weeklyAvailability || []).length > 0,
    city: expert.city,
    languages: expert.languages || [],
    photoUrl: expert.photoUrl,
    isActive: expert.isActive,
    rating: expert.rating || 0,
    reviewCount: expert.reviewCount || 0,
  };
};

/**
 * Base for the authenticated views (`serializeExpertFull`, and the expert block
 * on a session). Includes the expert's email, so it must NOT be returned from a
 * public route; use `serializeExpertPublic` there.
 */
export const serializeExpert = (expert: any) => {
  const { name, email } = expertUserName(expert);
  return {
    id: expert._id?.toString(),
    _id: expert._id?.toString(),
    name,
    email,
    bio: expert.bio,
    sports: expert.sports || [],
    expertise: expert.expertise || [],
    achievements: expert.achievements,
    sessionFee: expert.sessionFee,
    sessionMode: expert.sessionMode,
    sessionDurationMinutes: expert.sessionDurationMinutes || 60,
    timezone: expert.timezone || "Asia/Kolkata",
    hasAvailability: (expert.weeklyAvailability || []).length > 0,
    city: expert.city,
    languages: expert.languages || [],
    photoUrl: expert.photoUrl,
    isActive: expert.isActive,
    verificationStatus: expert.verificationStatus || "UNVERIFIED",
    rating: expert.rating || 0,
    reviewCount: expert.reviewCount || 0,
    createdAt: expert.createdAt,
  };
};

/**
 * Owner/admin view — includes editable availability + photoKey, plus
 * tax/payout fields. Never merged into the public `serializeExpert`.
 *
 * `expert` here is almost always a `.lean()` result (plain object, not a
 * live Mongoose document), which bypasses the schema-level `get: decryptValue`
 * getters entirely — so panNumber/payoutMethods are decrypted explicitly
 * here rather than relying on those getters to have already run.
 */
export const serializeExpertFull = (expert: any) => ({
  ...serializeExpert(expert),
  photoKey: expert.photoKey,
  weeklyAvailability: expert.weeklyAvailability || [],
  blackoutDates: expert.blackoutDates || [],
  inPersonAddress: expert.inPersonAddress,
  rejectionReason: expert.rejectionReason,
  panNumber: expert.panNumber ? decryptValue(expert.panNumber) : expert.panNumber,
  gstNumber: expert.gstNumber,
  payoutMethods: (expert.payoutMethods || []).map(decryptPayoutMethod),
});

/**
 * Condenses a Player (child) doc into the briefing an expert needs before a
 * session — the wizard-built profile signals, not the full raw document.
 */
/** The quiz answers of a Player, or an empty set when the quiz was never taken. */
const quiz = (player: PlayerDocument | any): Record<string, any> => player?.quiz ?? {};

/**
 * What an expert sees of a child, in two tiers (the briefing on lists, the full profile for
 * a paid session). Each tier names the stored fields it deliberately leaves out, with the
 * reason, and a test requires every field of the model to be shown or listed here, so a
 * field added to the model is never shown to experts by accident or forgotten by omission.
 * Quiz answers are checked one by one as `quiz.<name>`.
 */
export const EXPERT_BRIEFING_WITHHOLDS: Record<string, string> = {
  userId: "the owner's id",
  createdAt: "internal bookkeeping",
  updatedAt: "internal bookkeeping",
  dob: "the briefing shows an age, not a date of birth",
  relation: "not needed to prepare for a session",
  yearsPlaying: "in the full profile, which needs a paid session",
  personalityTags: "in the full profile, which needs a paid session",
  location: "in the full profile, which needs a paid session",
  weeklyHoursCategory: "in the full profile, which needs a paid session",
  experienceLevel: "in the full profile, which needs a paid session",
  trainingType: "in the full profile, which needs a paid session",
  consideringSports: "the parent's shortlist is theirs, not the expert's",
  currentStandingTier: "in the full profile, which needs a paid session",
  chosenSport: "a decision the parent has not shared with this expert",
  chosenSportAt: "a decision the parent has not shared with this expert",
  "quiz.heightCm": "physical measures are in the full profile only",
  "quiz.weightKg": "physical measures are in the full profile only",
  "quiz.visualTracking": "in the full profile, which needs a paid session",
  "quiz.eyesight": "physical measures are in the full profile only",
  "quiz.agility": "physical measures are in the full profile only",
  "quiz.decisionStyle": "in the full profile, which needs a paid session",
  "quiz.repetitionTolerance": "in the full profile, which needs a paid session",
  "quiz.waterComfort": "in the full profile, which needs a paid session",
};

export const EXPERT_FULL_PROFILE_WITHHOLDS: Record<string, string> = {
  userId: "the owner's id",
  createdAt: "internal bookkeeping",
  updatedAt: "internal bookkeeping",
  consideringSports: "the parent's shortlist is theirs, not the expert's",
  chosenSport: "a decision the parent has not shared with this expert",
  chosenSportAt: "a decision the parent has not shared with this expert",
};

export const summarizePlayerForExpert = (player: PlayerDocument | any) => ({
  _id: player._id?.toString(),
  name: player.name,
  age: resolveChildAge(player),
  gender: player.gender,
  sportsFocus: player.sportsFocus,
  topSportMatch: player.sportMatches?.[0],
  energyType: quiz(player).energyType,
  motorType: quiz(player).motorType,
  teamIndividual: quiz(player).teamIndividual,
  competitiveResponse: quiz(player).competitiveResponse,
  focusStyle: quiz(player).focusStyle,
  pressureResponse: quiz(player).pressureResponse,
  contactComfort: quiz(player).contactComfort,
  environment: quiz(player).environment,
  ambition: player.ambition,
  budgetRange: player.budgetRange,
  wizardCompletedAt: player.wizardCompletedAt,
});

/**
 * Full child profile + AI roadmap narrative for the expert's dedicated
 * booking-detail page — everything summarizePlayerForExpert leaves out,
 * minus financial/academic-pathway fields that aren't relevant to a
 * sport-session expert.
 */
export const serializeFullPlayerForExpert = (player: PlayerDocument | any) => ({
  name: player.name,
  age: resolveChildAge(player),
  dob: player.dob,
  gender: player.gender,
  relation: player.relation,
  sportsFocus: player.sportsFocus || [],
  yearsPlaying: player.yearsPlaying,
  personalityTags: player.personalityTags || [],
  location: player.location,
  heightCm: quiz(player).heightCm,
  weightKg: quiz(player).weightKg,
  energyType: quiz(player).energyType,
  motorType: quiz(player).motorType,
  visualTracking: quiz(player).visualTracking,
  teamIndividual: quiz(player).teamIndividual,
  competitiveResponse: quiz(player).competitiveResponse,
  focusStyle: quiz(player).focusStyle,
  decisionStyle: quiz(player).decisionStyle,
  pressureResponse: quiz(player).pressureResponse,
  repetitionTolerance: quiz(player).repetitionTolerance,
  contactComfort: quiz(player).contactComfort,
  environment: quiz(player).environment,
  waterComfort: quiz(player).waterComfort,
  budgetRange: player.budgetRange,
  ambition: player.ambition,
  eyesight: quiz(player).eyesight,
  agility: quiz(player).agility,
  weeklyHoursCategory: player.weeklyHoursCategory,
  experienceLevel: player.experienceLevel,
  trainingType: player.trainingType,
  currentStandingTier: player.currentStandingTier,
  sportMatches: player.sportMatches || [],
  wizardCompletedAt: player.wizardCompletedAt,
});

/** Batch-fetches the players referenced by a set of sessions, keyed by playerId string. */
export const fetchPlayerSummariesByIds = async (
  sessions: Array<{ playerId?: mongoose.Types.ObjectId | string }>
): Promise<Map<string, ReturnType<typeof summarizePlayerForExpert>>> => {
  const playerIds = [
    ...new Set(
      sessions.map((s) => s.playerId?.toString()).filter((id): id is string => Boolean(id))
    ),
  ];
  if (playerIds.length === 0) return new Map();
  const players = await Player.find({ _id: { $in: playerIds } }).lean();
  return new Map(
    players.map((p) => [(p._id as mongoose.Types.ObjectId).toString(), summarizePlayerForExpert(p)])
  );
};

/**
 * Who a session was about, for display: the child's current briefing, or, once the parent
 * has deleted the profile, the name and age kept on the session. `removed` lets a screen
 * say the profile is gone instead of showing a name with nothing behind it.
 */
export const playerForSession = (
  session: { playerId?: unknown; playerSnapshot?: { name?: string; age?: number } | null },
  summaries: Map<string, ReturnType<typeof summarizePlayerForExpert>>
) => {
  if (session.playerId) return summaries.get(String(session.playerId));
  const snapshot = session.playerSnapshot;
  return snapshot?.name ? { name: snapshot.name, age: snapshot.age, removed: true } : undefined;
};

export const serializeSession = (
  session: any,
  extra: {
    expert?: any;
    clientName?: string;
    expertTimezone?: string;
    expertInPersonAddress?: string;
    player?: any;
  } = {}
) => ({
  id: session._id?.toString(),
  _id: session._id?.toString(),
  expertId: session.expertId?.toString(),
  userId: session.userId?.toString(),
  amount: session.amount,
  status: session.status,
  paymentStatus: session.paymentStatus,
  scheduledAt: session.scheduledAt,
  durationMinutes: session.durationMinutes,
  // Canonical display timezone (the expert's) so client + expert see the same time.
  expertTimezone: extra.expertTimezone || extra.expert?.timezone || "Asia/Kolkata",
  mode: session.mode,
  meetingLink: session.meetingLink,
  // Only surfaced for IN_PERSON sessions, and only to someone who has an
  // actual booking — the public expert listing never exposes this address.
  ...(session.mode === "IN_PERSON" && extra.expertInPersonAddress
    ? { inPersonAddress: extra.expertInPersonAddress }
    : {}),
  clientNote: session.clientNote,
  cancelledAt: session.cancelledAt,
  cancelledBy: session.cancelledBy,
  cancelReason: session.cancelReason,
  refundStatus: session.refundStatus,
  cancellationNoticeHours: session.cancellationNoticeHours,
  expertAcceptance: session.expertAcceptance || "PENDING",
  expertRespondedAt: session.expertRespondedAt,
  completedAt: session.completedAt,
  momNotes: session.momNotes,
  momAddedAt: session.momAddedAt,
  payoutStatus: session.payoutStatus || "PENDING",
  payoutPaidAt: session.payoutPaidAt,
  reviewed: session.reviewed,
  rating: session.rating,
  review: session.review,
  reviewAnonymous: session.reviewAnonymous,
  reviewHidden: session.reviewHidden,
  reviewedAt: session.reviewedAt,
  createdAt: session.createdAt,
  ...(extra.expert ? { expert: extra.expert } : {}),
  ...(extra.clientName ? { clientName: extra.clientName } : {}),
  ...(extra.player ? { player: extra.player } : {}),
});

// ── Notification helpers (best-effort; never throw) ──────────────────────────

export const notify = (
  userId: mongoose.Types.ObjectId | string,
  type: any,
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  email = false
) => {
  NotificationService.send(
    { userId: userId.toString(), type, title, message, data },
    { sendEmail: email }
  ).catch((err) => log.error("[experts] notification failed:", err));
};

export const expertUserIdOf = async (expertId: mongoose.Types.ObjectId): Promise<string | null> => {
  const e = await Expert.findById(expertId).select("userId").lean();
  return e ? (e.userId as mongoose.Types.ObjectId).toString() : null;
};

const hasErrorLabel = (error: unknown, label: string): boolean => {
  if (!error || typeof error !== "object") return false;
  const e = error as { hasErrorLabel?: (value: string) => boolean };
  return typeof e.hasErrorLabel === "function" ? e.hasErrorLabel(label) : false;
};

export const isRetryableTransactionError = (error: unknown): boolean =>
  hasErrorLabel(error, "TransientTransactionError") ||
  hasErrorLabel(error, "UnknownTransactionCommitResult");

// ── Webhook reconciliation (idempotent; runs from the Outbox worker) ──────────

export const asRec = (v: unknown): Record<string, any> =>
  v && typeof v === "object" ? (v as Record<string, any>) : {};

export const pickString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (typeof v === "string" && v) return v;
  return undefined;
};
