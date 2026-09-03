import crypto from "crypto";
import mongoose from "mongoose";
import { Expert } from "../../models/ExpertProfile";
import { IPayoutMethod } from "../../models/Coach";
import { Player, PlayerDocument } from "../../models/Player";
import { NotificationService } from "../NotificationService";
import { decryptValue } from "../../../shared/utils/encryption";
import { log as __rootLog } from "../../../utils/logger";

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
const summarizePlayerForExpert = (player: PlayerDocument | any) => ({
  _id: player._id?.toString(),
  name: player.name,
  age: player.age,
  gender: player.gender,
  sportsFocus: player.sportsFocus,
  topSportMatch: player.sportMatches?.[0],
  energyType: player.energyType,
  motorType: player.motorType,
  teamIndividual: player.teamIndividual,
  competitiveResponse: player.competitiveResponse,
  focusStyle: player.focusStyle,
  pressureResponse: player.pressureResponse,
  contactComfort: player.contactComfort,
  environment: player.environment,
  ambition: player.ambition,
  budgetRange: player.budgetRange,
  wizardCompletedAt: player.wizardCompletedAt,
});

/**
 * Full child profile + AI roadmap narrative for the expert's dedicated
 * booking-detail page — everything summarizePlayerForExpert leaves out,
 * minus financial/academic-pathway fields that aren't relevant to a
 * sport-session expert (paymentHistory, pathwayState, costBreakdown).
 */
export const serializeFullPlayerForExpert = (player: PlayerDocument | any) => ({
  name: player.name,
  age: player.age,
  dob: player.dob,
  gender: player.gender,
  relation: player.relation,
  sportsFocus: player.sportsFocus || [],
  skillLevel: player.skillLevel,
  yearsPlaying: player.yearsPlaying,
  personalityTags: player.personalityTags || [],
  primaryObjective: player.primaryObjective,
  weeklyTimeCommitment: player.weeklyTimeCommitment,
  budgetTier: player.budgetTier,
  location: player.location,
  heightCm: player.heightCm,
  weightKg: player.weightKg,
  medicalConditions: player.medicalConditions || [],
  build: player.build,
  heightCategory: player.heightCategory,
  energyType: player.energyType,
  motorType: player.motorType,
  visualTracking: player.visualTracking,
  teamIndividual: player.teamIndividual,
  competitiveResponse: player.competitiveResponse,
  focusStyle: player.focusStyle,
  decisionStyle: player.decisionStyle,
  pressureResponse: player.pressureResponse,
  repetitionTolerance: player.repetitionTolerance,
  contactComfort: player.contactComfort,
  environment: player.environment,
  waterComfort: player.waterComfort,
  budgetRange: player.budgetRange,
  ambition: player.ambition,
  eyesight: player.eyesight,
  agility: player.agility,
  weeklyHoursCategory: player.weeklyHoursCategory,
  experienceLevel: player.experienceLevel,
  trainingType: player.trainingType,
  currentStandingTier: player.currentStandingTier,
  bestResultTier: player.bestResultTier,
  achievementsNote: player.achievementsNote,
  academyName: player.academyName,
  sessionsPerWeek: player.sessionsPerWeek,
  trainingMonths: player.trainingMonths,
  wizardCity: player.wizardCity,
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
