import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../models/User";
import { Expert, ExpertDocument } from "../models/ExpertProfile";
import { IPayoutMethod } from "../models/Coach";
import { Player, PlayerDocument } from "../models/Player";
import {
  ExpertSession,
  ExpertSessionDocument,
  ExpertSessionCanceller,
} from "../models/ExpertBooking";
import { BookingSlotLock } from "../models/BookingSlotLock";
import {
  initiatePhonePePayment,
  getPhonePeOrderStatus,
  initiatePhonePeRefund,
} from "../../shared/services/PhonePeService";
import { NotificationService } from "./NotificationService";
import { recordExpertSessionEvent } from "./BookingEventService";
import type { BookingEventChannel } from "../models/BookingEvent";
import { PathwayExpertVerification } from "../../shared/models/PathwayExpertVerification";
import {
  computeOpenSlots,
  assertSlotBookable,
  OpenSlot,
} from "./ExpertAvailabilityService";
import { encryptValue, decryptValue } from "../../shared/utils/encryption";
import { isSupportedSport, SUPPORTED_SPORTS } from "../../shared/constants/supportedSports";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);
const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";
const toPaise = (rupees: number) => Math.round(rupees * 100);
const HOLD_MINUTES = 15;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
// Enforces the literal checksum-style "Z" in the 14th character — stricter
// (and more correct) than the looser GSTIN regex historically used server-side
// for Academy's onboarding, matching what the client already validates.
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
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

const serializeExpert = (expert: any) => {
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
const serializeExpertFull = (expert: any) => ({
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
const serializeFullPlayerForExpert = (player: PlayerDocument | any) => ({
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
const fetchPlayerSummariesByIds = async (
  sessions: Array<{ playerId?: mongoose.Types.ObjectId | string }>,
): Promise<Map<string, ReturnType<typeof summarizePlayerForExpert>>> => {
  const playerIds = [
    ...new Set(
      sessions
        .map((s) => s.playerId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (playerIds.length === 0) return new Map();
  const players = await Player.find({ _id: { $in: playerIds } }).lean();
  return new Map(
    players.map((p) => [(p._id as mongoose.Types.ObjectId).toString(), summarizePlayerForExpert(p)]),
  );
};

const serializeSession = (
  session: any,
  extra: {
    expert?: any;
    clientName?: string;
    expertTimezone?: string;
    expertInPersonAddress?: string;
    player?: any;
  } = {},
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
  expertTimezone:
    extra.expertTimezone || extra.expert?.timezone || "Asia/Kolkata",
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

const notify = (
  userId: mongoose.Types.ObjectId | string,
  type: any,
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  email = false,
) => {
  NotificationService.send(
    { userId: userId.toString(), type, title, message, data },
    { sendEmail: email },
  ).catch((err) => console.error("[experts] notification failed:", err));
};

const expertUserIdOf = async (
  expertId: mongoose.Types.ObjectId,
): Promise<string | null> => {
  const e = await Expert.findById(expertId).select("userId").lean();
  return e ? (e.userId as mongoose.Types.ObjectId).toString() : null;
};

// ── Admin: create / list ─────────────────────────────────────────────────────

export interface CreateExpertPayload {
  name: string;
  email: string;
  phone: string;
  bio?: string | undefined;
  sports?: string[] | undefined;
  expertise?: string[] | undefined;
  achievements?: string | undefined;
  sessionFee: number;
  sessionMode?: "ONLINE" | "IN_PERSON" | "BOTH" | undefined;
  sessionDurationMinutes?: number | undefined;
  timezone?: string | undefined;
  weeklyAvailability?:
    { dayOfWeek: number; start: string; end: string }[] | undefined;
  blackoutDates?: string[] | undefined;
  city?: string | undefined;
  languages?: string[] | undefined;
  photoUrl?: string | undefined;
  photoKey?: string | undefined;
  createdBy?: string | undefined;
}

export const createExpertByAdmin = async (payload: CreateExpertPayload) => {
  const email = payload.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error("A user with this email already exists");
  if (payload.sessionFee == null || payload.sessionFee < 0) {
    throw new Error("A valid session fee is required");
  }
  assertSupportedSports(payload.sports);

  const temporaryPassword = generateTemporaryPassword();
  const user = new User({
    name: payload.name.trim(),
    email,
    phone: payload.phone.trim(),
    role: "EXPERT",
    password: temporaryPassword,
    isActive: true,
  });
  await user.save();

  const expert = await Expert.create({
    userId: user._id,
    bio: payload.bio?.trim() || "",
    sports: payload.sports || [],
    expertise: payload.expertise || [],
    achievements: payload.achievements?.trim(),
    sessionFee: payload.sessionFee,
    sessionMode: payload.sessionMode || "ONLINE",
    ...(payload.sessionDurationMinutes
      ? { sessionDurationMinutes: payload.sessionDurationMinutes }
      : {}),
    ...(payload.timezone ? { timezone: payload.timezone } : {}),
    ...(Array.isArray(payload.weeklyAvailability)
      ? { weeklyAvailability: payload.weeklyAvailability }
      : {}),
    ...(Array.isArray(payload.blackoutDates)
      ? { blackoutDates: payload.blackoutDates }
      : {}),
    city: payload.city?.trim(),
    languages: payload.languages || [],
    photoUrl: payload.photoUrl,
    photoKey: payload.photoKey,
    isActive: true,
    verificationStatus: "APPROVED",
    ...(payload.createdBy ? { createdBy: toObjectId(payload.createdBy) } : {}),
  });

  return { user, expert, temporaryPassword };
};

export const listExpertsForAdmin = async (params: {
  page?: number | undefined;
  limit?: number | undefined;
  verificationStatus?: string | undefined;
}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const filter: Record<string, unknown> = {};
  if (params.verificationStatus) filter.verificationStatus = params.verificationStatus;
  const [experts, total] = await Promise.all([
    Expert.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Expert.countDocuments(filter),
  ]);
  // Always include pending count for the badge
  const pendingCount = await Expert.countDocuments({ verificationStatus: "PENDING" });
  return {
    data: experts.map(serializeExpertFull),
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
    pendingCount,
  };
};

// Fields an admin (or the expert) may edit on a profile.
// Note: `payoutMethods` is deliberately NOT here — it's gated separately via
// upsertExpertPayoutMethod (see payoutController.ts), which enforces its own
// upsert-by-id/append semantics and verificationStatus rules. Adding it to
// this whitelist would reopen a raw, ungated write path to the exact field
// that gate exists to protect.
const EDITABLE_FIELDS = [
  "bio",
  "sports",
  "expertise",
  "achievements",
  "sessionFee",
  "sessionMode",
  "sessionDurationMinutes",
  "timezone",
  "weeklyAvailability",
  "blackoutDates",
  "city",
  "languages",
  "photoUrl",
  "photoKey",
  "inPersonAddress",
  "panNumber",
  "gstNumber",
] as const;

// Experts are restricted to these sports for now — see supportedSports.ts.
const assertSupportedSports = (sports: unknown) => {
  if (!Array.isArray(sports)) return;
  const unsupported = sports.filter(
    (s) => typeof s === "string" && !isSupportedSport(s),
  );
  if (unsupported.length > 0) {
    const names = SUPPORTED_SPORTS.map((s) => s.name).join(", ");
    throw new Error(
      `Unsupported sport(s): ${unsupported.join(", ")}. Experts currently only cover: ${names}.`,
    );
  }
};

const sanitizeProfilePatch = (patch: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (patch[key] === undefined) continue;
    out[key] = patch[key];
  }
  if (out.sports != null) {
    assertSupportedSports(out.sports);
  }
  if (
    out.sessionFee != null &&
    (Number(out.sessionFee) < 0 || isNaN(Number(out.sessionFee)))
  ) {
    throw new Error("A valid session fee is required");
  }
  if (out.weeklyAvailability && Array.isArray(out.weeklyAvailability)) {
    for (const w of out.weeklyAvailability as any[]) {
      if (
        typeof w?.dayOfWeek !== "number" ||
        w.dayOfWeek < 0 ||
        w.dayOfWeek > 6 ||
        !/^\d{2}:\d{2}$/.test(String(w?.start)) ||
        !/^\d{2}:\d{2}$/.test(String(w?.end)) ||
        String(w.start) >= String(w.end)
      ) {
        throw new Error("Invalid availability window");
      }
    }
  }
  if (out.panNumber != null) {
    const pan = String(out.panNumber).trim().toUpperCase();
    if (!PAN_REGEX.test(pan)) {
      throw new Error("Invalid PAN number format (e.g. ABCDE1234F)");
    }
    // This patch is applied via findOneAndUpdate (see updateMyExpertProfile /
    // updateExpertByAdmin below), which does NOT run the model's pre("save")
    // hook — so encryption has to happen explicitly here, not rely on that hook.
    out.panNumber = encryptValue(pan);
  }
  if (out.gstNumber != null && String(out.gstNumber).trim() !== "") {
    const gst = String(out.gstNumber).trim().toUpperCase();
    if (!GST_REGEX.test(gst)) {
      throw new Error("Invalid GST number format");
    }
    out.gstNumber = gst;
  } else if (out.gstNumber != null) {
    out.gstNumber = "";
  }
  return out;
};

export const updateExpertByAdmin = async (
  expertId: string,
  patch: Record<string, unknown>,
) => {
  const update = sanitizeProfilePatch(patch);
  if (patch.isActive !== undefined) {
    const wantsActive = Boolean(patch.isActive);
    if (wantsActive) {
      // isActive:true is only meaningful alongside APPROVED — otherwise a
      // stray toggle here would make an un-vetted expert publicly bookable
      // with no independent status check anywhere in the booking path.
      const current = await Expert.findById(expertId).select(
        "verificationStatus",
      );
      if (!current) throw new Error("Expert not found");
      if (current.verificationStatus !== "APPROVED") {
        throw new Error(
          "Only an APPROVED expert can be activated — approve them first",
        );
      }
    }
    update.isActive = wantsActive;
  }
  const expert = await Expert.findByIdAndUpdate(expertId, update, { new: true })
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert not found");
  return serializeExpertFull(expert);
};

export const setExpertActive = async (expertId: string, isActive: boolean) => {
  if (isActive) {
    const current = await Expert.findById(expertId).select(
      "verificationStatus",
    );
    if (!current) throw new Error("Expert not found");
    if (current.verificationStatus !== "APPROVED") {
      throw new Error(
        "Only an APPROVED expert can be activated — approve them first",
      );
    }
  }
  const expert = await Expert.findByIdAndUpdate(
    expertId,
    { isActive },
    { new: true },
  )
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert not found");
  return serializeExpertFull(expert);
};

export const submitExpertForReview = async (userId: string) => {
  const current = await Expert.findOne({
    userId: toObjectId(userId),
    verificationStatus: { $in: ["UNVERIFIED", "REJECTED"] },
  });
  if (!current) {
    throw new Error("Expert profile not found or not eligible for review submission");
  }

  // Mirrors the onboarding wizard's own required-field gates — enforced here
  // too so the review queue can't be flooded with essentially blank profiles
  // via a direct API call that skips the wizard's client-side checks.
  const missing: string[] = [];
  if (!current.bio?.trim() || current.bio.trim().length < 20) missing.push("a bio (20+ characters)");
  if (!current.achievements?.trim()) missing.push("achievements");
  if (!current.sports || current.sports.length === 0) missing.push("at least one sport");
  if (!current.expertise || current.expertise.length === 0) missing.push("at least one expertise tag");
  if (!current.sessionFee || current.sessionFee <= 0) missing.push("a valid session fee");
  if (
    (current.sessionMode === "IN_PERSON" || current.sessionMode === "BOTH") &&
    !current.inPersonAddress?.trim()
  ) {
    missing.push("an in-person location");
  }
  if (!current.panNumber?.trim()) missing.push("a PAN number");
  if (!current.payoutMethods || current.payoutMethods.length === 0) {
    missing.push("a payout method (bank account or UPI)");
  }
  if (missing.length > 0) {
    throw new Error(`Complete your profile before submitting: ${missing.join(", ")}`);
  }

  const expert = await Expert.findByIdAndUpdate(
    current._id,
    { verificationStatus: "PENDING" },
    { new: true },
  )
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert profile not found or not eligible for review submission");
  return serializeExpertFull(expert);
};

export const approveExpert = async (expertId: string) => {
  const current = await Expert.findById(expertId).select("sports");
  if (!current) throw new Error("Expert not found");

  const expert = await Expert.findByIdAndUpdate(
    expertId,
    {
      verificationStatus: "APPROVED",
      isActive: true,
      // Snapshot what was actually reviewed — pathway-verification eligibility
      // checks against this, not the live (self-editable) `sports` array.
      approvedSports: current.sports || [],
      $unset: { rejectionReason: 1 },
    },
    { new: true },
  )
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert not found");
  return serializeExpertFull(expert);
};

export const rejectExpert = async (expertId: string, reason: string) => {
  const expert = await Expert.findByIdAndUpdate(
    expertId,
    { verificationStatus: "REJECTED", isActive: false, rejectionReason: reason.trim() },
    { new: true },
  )
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert not found");
  // A rejected expert's public "Verified by [name]" pathway credit should not
  // persist — otherwise a for-cause rejection still leaves their name/photo
  // attached to a live, indexable trust signal parents see.
  await PathwayExpertVerification.deleteMany({ expertId: expert._id });
  return serializeExpertFull(expert);
};

// ── Expert self-service profile ──────────────────────────────────────────────

export const getMyExpertProfile = async (userId: string) => {
  const expert = await Expert.findOne({ userId: toObjectId(userId) })
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert profile not found");
  return serializeExpertFull(expert);
};

export const updateMyExpertProfile = async (
  userId: string,
  patch: Record<string, unknown>,
) => {
  const update = sanitizeProfilePatch(patch);
  const expert = await Expert.findOneAndUpdate(
    { userId: toObjectId(userId) },
    update,
    { new: true },
  )
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert profile not found");
  return serializeExpertFull(expert);
};

// ── Public discovery ─────────────────────────────────────────────────────────

export const listActiveExperts = async (params: {
  sport?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(60, Math.max(1, params.limit || 30));
  const query: Record<string, unknown> = { isActive: true };
  if (params.sport) query.sports = params.sport;

  if (params.search && params.search.trim()) {
    const rx = new RegExp(escapeRegex(params.search.trim()), "i");
    const matchingUsers = await User.find({ role: "EXPERT", name: rx })
      .select("_id")
      .lean();
    query.$or = [
      { bio: rx },
      { city: rx },
      { sports: rx },
      { expertise: rx },
      { userId: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }

  const [experts, total] = await Promise.all([
    Expert.find(query)
      .populate("userId", "name email")
      .sort({ rating: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Expert.countDocuments(query),
  ]);

  return {
    data: experts.map(serializeExpert),
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
  };
};

export const getExpertById = async (expertId: string) => {
  const expert = await Expert.findById(expertId)
    .populate("userId", "name email")
    .lean();
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  return serializeExpert(expert);
};

export const getExpertOpenSlots = async (
  expertId: string,
  from?: string,
  to?: string,
): Promise<OpenSlot[]> => {
  const expert = await Expert.findById(expertId);
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  return computeOpenSlots(expert, from, to);
};

export const getExpertReviews = async (expertId: string) => {
  const sessions = await ExpertSession.find({
    expertId: toObjectId(expertId),
    reviewed: true,
    reviewHidden: { $ne: true },
  })
    .populate("userId", "name")
    .sort({ reviewedAt: -1 })
    .lean();
  return sessions.map((s) => {
    const u = s.userId as unknown as { name?: string } | null;
    return {
      rating: s.rating,
      review: s.review,
      reviewerName: s.reviewAnonymous ? "Anonymous" : u?.name || "A player",
      reviewedAt: s.reviewedAt,
    };
  });
};

// ── Session lifecycle ────────────────────────────────────────────────────────

const assertSessionOwner = (session: ExpertSessionDocument, userId: string) => {
  if (session.userId.toString() !== userId) {
    throw new Error("You are not authorized to modify this session");
  }
};

/**
 * A session's expert-side "keep operating" actions (accepting/rescheduling,
 * marking complete, sharing a meeting link, reading the child's profile) all
 * require the expert to still be an active, approved account — not just the
 * original owner of the session. Getting rejected after a booking already
 * exists should cut off further ability to act as their expert, not just
 * remove them from public discovery. Declining or cancelling stays allowed
 * regardless of status, since ending a session is the safe direction.
 */
const assertExpertOperational = (expert: {
  verificationStatus: string;
  isActive: boolean;
}) => {
  if (!expert.isActive || expert.verificationStatus !== "APPROVED") {
    throw new Error(
      "Your expert account is not currently active — contact support.",
    );
  }
};

/** Whether a session's scheduled end time has already passed (or it was never scheduled at all). */
const sessionHasEnded = (session: {
  scheduledAt?: Date | null;
  durationMinutes?: number;
}): boolean => {
  if (!session.scheduledAt) return false;
  const end =
    new Date(session.scheduledAt).getTime() +
    (session.durationMinutes || 60) * 60_000;
  return end < Date.now();
};

// ── Slot-locking (double-booking race prevention) ─────────────────────────────
// assertSlotBookable's conflict check and the subsequent write aren't atomic
// on their own — two concurrent requests for the identical expert+time could
// both read "no conflict" before either write commits. This mirrors the
// BookingSlotLock mechanism BookingService.ts already uses for venue/coach
// bookings: acquire a per-slot lock inside a transaction (which serializes
// concurrent transactions on the same lock document), re-validate, then
// mutate — all committed together, or none of it.

const MAX_SLOT_LOCK_RETRIES = 3;

const hasErrorLabel = (error: unknown, label: string): boolean => {
  if (!error || typeof error !== "object") return false;
  const e = error as { hasErrorLabel?: (value: string) => boolean };
  return typeof e.hasErrorLabel === "function" ? e.hasErrorLabel(label) : false;
};

const isRetryableTransactionError = (error: unknown): boolean =>
  hasErrorLabel(error, "TransientTransactionError") ||
  hasErrorLabel(error, "UnknownTransactionCommitResult");

/**
 * Reserve `scheduledAt` for `expert` and run `mutate` — both atomically. Retries
 * a bounded number of times on transient transaction errors (e.g. a write
 * conflict from a competing request racing for the same lock document).
 */
const withExpertSlotLock = async <T>(
  expert: ExpertDocument,
  scheduledAt: Date,
  excludeSessionId: string | undefined,
  mutate: (dbSession: mongoose.ClientSession) => Promise<T>,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_SLOT_LOCK_RETRIES; attempt += 1) {
    const dbSession = await mongoose.startSession();
    try {
      let result: T | undefined;
      await dbSession.withTransaction(async () => {
        await BookingSlotLock.findOneAndUpdate(
          {
            resourceType: "EXPERT_SLOT",
            resourceId: expert._id,
            dateKey: scheduledAt.toISOString(),
          },
          {
            $inc: { version: 1 },
            $set: { lastLockedAt: new Date() },
          },
          {
            upsert: true,
            new: true,
            session: dbSession,
            setDefaultsOnInsert: true,
          },
        );

        // Re-validate now that we hold the lock — no concurrent request for
        // this exact slot can commit ahead of us from this point on.
        await assertSlotBookable(expert, scheduledAt, excludeSessionId, dbSession);

        result = await mutate(dbSession);
      });
      return result as T;
    } catch (error) {
      lastError = error;
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_SLOT_LOCK_RETRIES
      ) {
        throw error;
      }
    } finally {
      await dbSession.endSession();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to reserve this slot after multiple attempts");
};

export const initiateExpertSession = async (params: {
  expertId: string;
  userId: string;
  scheduledAt: string;
  clientNote?: string;
  mode?: "ONLINE" | "IN_PERSON";
  userPhone?: string;
  playerId?: string;
}) => {
  const expert = await Expert.findById(params.expertId);
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  if (params.userId === (expert.userId as mongoose.Types.ObjectId).toString()) {
    throw new Error("You cannot book a session with yourself");
  }

  const scheduledAt = new Date(params.scheduledAt);

  // Only attach the player if it's actually one of this parent's own children —
  // silently drop it otherwise rather than failing the whole booking.
  let playerId: mongoose.Types.ObjectId | undefined;
  if (params.playerId) {
    const player = await Player.findOne({
      _id: params.playerId,
      userId: toObjectId(params.userId),
      type: "DEPENDENT",
    }).select("_id");
    if (player) playerId = player._id as mongoose.Types.ObjectId;
  }

  const merchantOrderId = `EXP_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const resolvedMode =
    expert.sessionMode === "BOTH"
      ? params.mode || "ONLINE"
      : expert.sessionMode === "IN_PERSON"
        ? "IN_PERSON"
        : "ONLINE";

  const session = await withExpertSlotLock(
    expert,
    scheduledAt,
    undefined,
    async (dbSession) => {
      const [doc] = await ExpertSession.create(
        [
          {
            expertId: expert._id,
            userId: toObjectId(params.userId),
            ...(playerId ? { playerId } : {}),
            amount: expert.sessionFee,
            status: "PENDING_PAYMENT",
            paymentStatus: "PENDING",
            merchantOrderId,
            scheduledAt,
            durationMinutes: expert.sessionDurationMinutes || 60,
            holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
            mode: resolvedMode,
            clientNote: params.clientNote?.trim(),
          },
        ],
        { session: dbSession },
      );
      return doc;
    },
  );

  await recordExpertSessionEvent(session, {
    type: "CREATED",
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    amountPaise: toPaise(expert.sessionFee),
    summary: `Expert session held for ${new Date(scheduledAt).toISOString()} (${resolvedMode})`,
    metadata: {
      merchantOrderId,
      mode: resolvedMode,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes: expert.sessionDurationMinutes || 60,
      holdExpiresAt: session.holdExpiresAt?.toISOString(),
      hasPlayer: Boolean(playerId),
      hasClientNote: Boolean(params.clientNote?.trim()),
    },
  });

  const payment = await initiatePhonePePayment({
    merchantOrderId,
    amount: toPaise(expert.sessionFee),
    redirectUrl: `${frontendUrl()}/experts/sessions/${session._id}`,
    ...(params.userPhone ? { userPhone: params.userPhone } : {}),
  });

  await recordExpertSessionEvent(session, {
    type: "PAYMENT_INITIATED",
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    amountPaise: toPaise(expert.sessionFee),
    summary: "PhonePe payment initiated for expert session",
    metadata: { merchantOrderId, method: "PHONEPE" },
  });

  return {
    sessionId: session._id.toString(),
    redirectUrl: payment.redirectUrl,
  };
};

/**
 * Idempotently transition a session to a paid+scheduled state and fire the
 * one-time confirmation notifications. Safe to call from both the client-driven
 * reconcile and the webhook path.
 */
const applyExpertPaymentSuccess = async (
  session: ExpertSessionDocument,
  /**
   * Which surface drove this. Both the webhook and the client-side reconcile
   * land here, and a log that can't tell them apart hides whether the gateway
   * callback is actually working.
   */
  source: { channel: BookingEventChannel; actorUserId?: string } = {
    channel: "WEBHOOK",
  },
): Promise<ExpertSessionDocument> => {
  const wasPaid = session.paymentStatus === "COMPLETED";
  const statusBefore = session.status;
  session.paymentStatus = "COMPLETED";
  if (!wasPaid) session.paidAt = new Date();
  session.set("holdExpiresAt", undefined);
  if (session.status === "PENDING_PAYMENT") {
    session.status = session.scheduledAt ? "SCHEDULED" : "PAID";
  }
  await session.save();

  // Only on the real transition — this function is deliberately idempotent and
  // is called repeatedly by reconcile/webhook, so logging unconditionally would
  // fill the timeline with duplicate confirmations.
  if (!wasPaid) {
    await recordExpertSessionEvent(session, {
      type: "PAYMENT_CONFIRMED",
      fromStatus: statusBefore,
      toStatus: session.status,
      actorType: "GATEWAY",
      ...(source.actorUserId ? { actorUserId: source.actorUserId } : {}),
      channel: source.channel,
      amountPaise: toPaise(session.amount),
      summary: "Expert session payment confirmed",
      metadata: {
        merchantOrderId: session.merchantOrderId,
        scheduledAt: session.scheduledAt
          ? new Date(session.scheduledAt).toISOString()
          : null,
      },
    });
  }

  if (!wasPaid) {
    const when = session.scheduledAt
      ? new Date(session.scheduledAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "a time you choose";
    // Client receipt.
    notify(
      session.userId,
      "PAYMENT_CONFIRMED",
      "Session booked",
      `Your payment of ₹${session.amount} is confirmed. Your session is set for ${when}.`,
      { sessionId: session._id.toString(), amount: session.amount },
      true,
    );
    // Expert alert.
    const expertUserId = await expertUserIdOf(session.expertId);
    if (expertUserId) {
      const hasContext = Boolean(session.playerId || session.clientNote);
      notify(
        expertUserId,
        "BOOKING_CONFIRMED",
        "New session booked",
        `A client booked a paid session with you for ${when}.` +
          (hasContext
            ? " Check your dashboard for their child's profile and note before the call."
            : ""),
        { sessionId: session._id.toString() },
        true,
      );
    }
  }
  return session;
};

export const reconcileExpertSession = async (params: {
  sessionId: string;
  userId: string;
}): Promise<ExpertSessionDocument> => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.paymentStatus === "COMPLETED") return session;

  const status = await getPhonePeOrderStatus(session.merchantOrderId);
  const state = (status.state || "").toUpperCase();
  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(state)) {
    return applyExpertPaymentSuccess(session, {
      channel: "CLIENT_WEB",
      actorUserId: params.userId,
    });
  } else if (["FAILED", "PAYMENT_ERROR", "PAYMENT_DECLINED"].includes(state)) {
    session.paymentStatus = "FAILED";
    if (session.status === "PENDING_PAYMENT") {
      session.status = "CANCELLED";
      session.cancelledBy = "SYSTEM";
      session.cancelReason = "Payment failed";
      session.cancelledAt = new Date();
      session.set("holdExpiresAt", undefined);
    }
    await session.save();
  }
  return session;
};

/** Reschedule a paid/scheduled session to another open slot. */
export const scheduleExpertSession = async (params: {
  sessionId: string;
  userId: string;
  scheduledAt: string;
  mode?: "ONLINE" | "IN_PERSON";
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("Only a paid session can be scheduled");
  }
  const expert = await Expert.findById(session.expertId);
  if (!expert) throw new Error("Expert not found");

  const when = new Date(params.scheduledAt);
  const previousSlot = session.scheduledAt
    ? new Date(session.scheduledAt).toISOString()
    : null;
  const previousStatus = session.status;
  const previousMode = session.mode;

  await withExpertSlotLock(
    expert,
    when,
    session._id.toString(),
    async (dbSession) => {
      session.scheduledAt = when;
      session.status = "SCHEDULED";
      if (params.mode) session.mode = params.mode;
      await session.save({ session: dbSession });
    },
  );

  await recordExpertSessionEvent(session, {
    type: "RESCHEDULED",
    fromStatus: previousStatus,
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    summary: previousSlot
      ? `Client moved the session from ${previousSlot} to ${when.toISOString()}`
      : `Client scheduled the session for ${when.toISOString()}`,
    metadata: {
      from: previousSlot,
      to: when.toISOString(),
      ...(params.mode && params.mode !== previousMode
        ? { modeChangedFrom: previousMode, modeChangedTo: params.mode }
        : {}),
    },
  });

  const expertUserId = (expert.userId as mongoose.Types.ObjectId).toString();
  notify(
    expertUserId,
    "BOOKING_STATUS_UPDATED",
    "Session scheduled",
    `A session was scheduled for ${when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`,
    { sessionId: session._id.toString() },
  );
  return session;
};

// Minimum length (after trimming) for an expert's minutes-of-meeting text —
// enough to stop a one-word close-out, not a rigid content requirement.
const MOM_MIN_LENGTH = 20;

const assertValidMom = (momNotes: unknown): string => {
  const trimmed = typeof momNotes === "string" ? momNotes.trim() : "";
  if (trimmed.length < MOM_MIN_LENGTH) {
    throw new Error(
      `Minutes of meeting must be at least ${MOM_MIN_LENGTH} characters — summarize what was covered and any next steps.`,
    );
  }
  return trimmed;
};

/**
 * Complete a session. Requires minutes of meeting (MOM) — a session cannot be
 * marked COMPLETED without them, so the parent always has notes to read.
 */
export const completeExpertSession = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
  momNotes: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await Expert.findById(session.expertId).select(
      "userId isActive verificationStatus",
    );
    if (!expert || expert.userId.toString() !== params.actorUserId) {
      throw new Error("Only the expert or an admin can complete this session");
    }
    assertExpertOperational(expert);
  }
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("Session cannot be completed from its current state");
  }
  if (
    !params.isAdmin &&
    (!session.scheduledAt || session.scheduledAt > new Date())
  ) {
    throw new Error(
      "You can only complete a session once it has started.",
    );
  }
  const momNotes = assertValidMom(params.momNotes);
  const now = new Date();
  const statusBeforeCompletion = session.status;
  session.status = "COMPLETED";
  session.completedAt = now;
  session.momNotes = momNotes;
  session.momAddedAt = now;
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "COMPLETED",
    fromStatus: statusBeforeCompletion,
    toStatus: "COMPLETED",
    actorType: params.isAdmin ? "ADMIN" : "PROVIDER",
    actorUserId: params.actorUserId,
    channel: params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB",
    amountPaise: toPaise(session.amount),
    summary: "Expert marked the session complete and filed minutes of meeting",
    metadata: {
      momLength: momNotes.length,
      scheduledAt: session.scheduledAt
        ? new Date(session.scheduledAt).toISOString()
        : null,
      // Completion starts the 24h payout clock, so this is the anchor event
      // for any later "why hasn't the expert been paid" question.
      payoutEligibleAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  notify(
    session.userId,
    "SESSION_MOM_ADDED",
    "Session notes are ready",
    "Your expert session is complete and your expert's notes (minutes of meeting) are ready to read. Leave a rating and feedback too.",
    { sessionId: session._id.toString() },
    true,
  );
  return session;
};

/**
 * Let the expert revise their MOM after completion — no lock, since notes
 * are commonly refined after the fact (e.g. fixing a typo, adding a detail).
 */
export const updateExpertSessionMom = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
  momNotes: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await Expert.findById(session.expertId).select(
      "userId isActive verificationStatus",
    );
    if (!expert || expert.userId.toString() !== params.actorUserId) {
      throw new Error("Only the expert or an admin can edit these notes");
    }
    assertExpertOperational(expert);
  }
  if (session.status !== "COMPLETED") {
    throw new Error("Notes can only be edited on a completed session");
  }
  const previousMomLength = session.momNotes?.length ?? 0;
  session.momNotes = assertValidMom(params.momNotes);
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "MOM_ADDED",
    toStatus: session.status,
    actorType: params.isAdmin ? "ADMIN" : "PROVIDER",
    actorUserId: params.actorUserId,
    channel: params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB",
    summary: "Minutes of meeting revised after completion",
    metadata: {
      revision: true,
      previousLength: previousMomLength,
      newLength: session.momNotes.length,
    },
  });

  return session;
};

export const setSessionMeetingLink = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
  meetingLink: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await Expert.findById(session.expertId).select(
      "userId isActive verificationStatus",
    );
    if (!expert || expert.userId.toString() !== params.actorUserId) {
      throw new Error("Only the expert or an admin can set the meeting link");
    }
    assertExpertOperational(expert);
  }
  const link = params.meetingLink.trim();
  if (link && !/^https?:\/\//i.test(link)) {
    throw new Error("Meeting link must be a valid URL");
  }
  const hadLink = Boolean(session.meetingLink);
  session.meetingLink = link;
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "MEETING_LINK_SET",
    toStatus: session.status,
    actorType: params.isAdmin ? "ADMIN" : "PROVIDER",
    actorUserId: params.actorUserId,
    channel: params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB",
    summary: link
      ? `Meeting link ${hadLink ? "updated" : "added"}`
      : "Meeting link cleared",
    // The URL itself is deliberately not stored — it is a live join link, and
    // an append-only log is the wrong place to keep one indefinitely.
    metadata: { replaced: hadLink, cleared: !link },
  });

  notify(
    session.userId,
    "BOOKING_STATUS_UPDATED",
    "Meeting link added",
    "Your expert added a meeting link for your upcoming session.",
    { sessionId: session._id.toString() },
    true,
  );
  return session;
};

/**
 * Expert (or admin) responds to a client's booked session:
 *  - ACCEPT: confirm the client's chosen time.
 *  - DECLINE: cancel the session (paid → manual refund required) + notify.
 *  - RESCHEDULE: move to another open slot within the expert's availability.
 */
export const respondToExpertSession = async (params: {
  sessionId: string;
  expertUserId: string;
  isAdmin?: boolean | undefined;
  action: "ACCEPT" | "DECLINE" | "RESCHEDULE";
  scheduledAt?: string | undefined;
  reason?: string | undefined;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  const expert = await Expert.findById(session.expertId);
  if (!expert) throw new Error("Expert not found");
  if (
    !params.isAdmin &&
    (expert.userId as mongoose.Types.ObjectId).toString() !==
      params.expertUserId
  ) {
    throw new Error("Only the expert or an admin can respond to this session");
  }
  // DECLINE is a wind-down action (like cancel) and stays available
  // regardless of status — but ACCEPT/RESCHEDULE mean continuing to operate
  // as an expert, which requires still being active + approved.
  if (!params.isAdmin && params.action !== "DECLINE") {
    assertExpertOperational(expert);
  }
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("This session can no longer be modified");
  }
  const tz = expert.timezone || "Asia/Kolkata";

  const statusBeforeResponse = session.status;
  const actorTypeForResponse = params.isAdmin ? "ADMIN" : "PROVIDER";
  const channelForResponse = params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB";

  if (params.action === "ACCEPT") {
    session.expertAcceptance = "ACCEPTED";
    session.expertRespondedAt = new Date();
    if (session.scheduledAt) session.status = "SCHEDULED";
    await session.save();

    await recordExpertSessionEvent(session, {
      type: "PROVIDER_CONFIRMED",
      fromStatus: statusBeforeResponse,
      toStatus: session.status,
      actorType: actorTypeForResponse,
      actorUserId: params.expertUserId,
      channel: channelForResponse,
      summary: "Expert accepted the client's chosen time",
      metadata: {
        // Time-to-accept is the expert SLA metric; derivable from CREATED.
        respondedAt: session.expertRespondedAt?.toISOString(),
      },
    });

    notify(
      session.userId,
      "BOOKING_CONFIRMED",
      "Session confirmed",
      "Your expert confirmed your session time.",
      { sessionId: session._id.toString() },
      true,
    );
    return session;
  }

  if (params.action === "DECLINE") {
    if (!params.isAdmin && sessionHasEnded(session)) {
      throw new Error(
        "This session already took place and can no longer be declined.",
      );
    }
    const declinedAt = new Date();
    session.status = "CANCELLED";
    session.cancelledAt = declinedAt;
    session.cancelledBy = "EXPERT";
    session.cancelReason =
      params.reason?.trim() || "The expert is unavailable at this time";
    session.expertAcceptance = "DECLINED";
    session.expertRespondedAt = declinedAt;
    if (session.paymentStatus === "COMPLETED") {
      session.refundStatus = "REQUIRED";
      if (session.scheduledAt) {
        session.cancellationNoticeHours = Math.round(
          (session.scheduledAt.getTime() - declinedAt.getTime()) /
            (60 * 60 * 1000),
        );
      }
    }
    await session.save();

    await recordExpertSessionEvent(session, {
      type: "PROVIDER_REJECTED",
      fromStatus: statusBeforeResponse,
      toStatus: "CANCELLED",
      actorType: actorTypeForResponse,
      actorUserId: params.expertUserId,
      channel: channelForResponse,
      amountPaise: toPaise(session.amount),
      summary:
        session.paymentStatus === "COMPLETED"
          ? "Expert declined a PAID session — manual refund required"
          : "Expert declined an unpaid session",
      metadata: {
        reason: session.cancelReason,
        refundStatus: session.refundStatus,
        cancellationNoticeHours: session.cancellationNoticeHours,
        wasPaid: session.paymentStatus === "COMPLETED",
      },
    });

    notify(
      session.userId,
      "BOOKING_CANCELLED",
      "Session declined",
      session.paymentStatus === "COMPLETED"
        ? "Your expert couldn't take this session. A refund will be processed manually by our team."
        : "Your expert couldn't take this session.",
      { sessionId: session._id.toString() },
      true,
    );
    return session;
  }

  // RESCHEDULE
  if (!params.scheduledAt)
    throw new Error("A new time is required to reschedule");
  const when = new Date(params.scheduledAt);
  const previousScheduledAt = session.scheduledAt
    ? new Date(session.scheduledAt).toISOString()
    : null;
  await withExpertSlotLock(
    expert,
    when,
    session._id.toString(),
    async (dbSession) => {
      session.scheduledAt = when;
      session.status = "SCHEDULED";
      session.expertAcceptance = "ACCEPTED";
      session.expertRespondedAt = new Date();
      await session.save({ session: dbSession });
    },
  );

  await recordExpertSessionEvent(session, {
    type: "RESCHEDULED",
    fromStatus: statusBeforeResponse,
    toStatus: session.status,
    actorType: actorTypeForResponse,
    actorUserId: params.expertUserId,
    channel: channelForResponse,
    summary: `Expert moved the session to ${when.toISOString()}`,
    metadata: {
      from: previousScheduledAt,
      to: when.toISOString(),
      initiatedBy: "EXPERT",
    },
  });

  notify(
    session.userId,
    "BOOKING_STATUS_UPDATED",
    "Session rescheduled",
    `Your expert moved your session to ${when.toLocaleString("en-IN", { timeZone: tz })}.`,
    { sessionId: session._id.toString() },
    true,
  );
  return session;
};

export const cancelExpertSession = async (params: {
  sessionId: string;
  actorUserId: string;
  role?: string | undefined;
  reason?: string | undefined;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");

  const isAdmin = params.role === "Admin";
  const expert = await Expert.findById(session.expertId).select("userId");
  const isExpert = expert?.userId?.toString() === params.actorUserId;
  const isClient = session.userId.toString() === params.actorUserId;
  if (!isAdmin && !isExpert && !isClient) {
    throw new Error("You are not authorized to cancel this session");
  }
  if (session.status === "COMPLETED")
    throw new Error("A completed session cannot be cancelled");
  if (session.status === "CANCELLED") return session;
  // Once a session has actually taken place, cancelling it would auto-flag a
  // refund below — that's only safe before the session happens. Without an
  // auto-complete job, a session can otherwise sit SCHEDULED past its end
  // time (awaiting the expert's MOM), which would make it cancellable —
  // and refundable — well after the fact. Admin keeps override for disputes.
  if (!isAdmin && sessionHasEnded(session)) {
    throw new Error(
      "This session already took place and can no longer be cancelled. Contact support if it didn't actually happen.",
    );
  }

  const by: ExpertSessionCanceller = isAdmin
    ? "ADMIN"
    : isExpert
      ? "EXPERT"
      : "CLIENT";
  const statusForCancelEvent = session.status;
  const cancelledAt = new Date();
  session.status = "CANCELLED";
  session.cancelledAt = cancelledAt;
  session.cancelledBy = by;
  session.cancelReason = params.reason?.trim();
  // Paid sessions require a manual refund (handled by admin/finance). We record
  // how much notice was given so admin can apply their own late-cancellation
  // judgment when processing it — the app never auto-forfeits the payment.
  if (session.paymentStatus === "COMPLETED") {
    session.refundStatus = "REQUIRED";
    if (session.scheduledAt) {
      session.cancellationNoticeHours = Math.round(
        (session.scheduledAt.getTime() - cancelledAt.getTime()) /
          (60 * 60 * 1000),
      );
    }
  }
  const statusBeforeCancel = statusForCancelEvent;
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "CANCELLED",
    fromStatus: statusBeforeCancel,
    toStatus: "CANCELLED",
    actorType: isAdmin ? "ADMIN" : isExpert ? "PROVIDER" : "USER",
    actorUserId: params.actorUserId,
    channel: isAdmin
      ? "ADMIN_PANEL"
      : isExpert
        ? "PROVIDER_WEB"
        : "CLIENT_WEB",
    amountPaise: toPaise(session.amount),
    summary: `Cancelled by ${by}${
      session.paymentStatus === "COMPLETED"
        ? " — paid session, manual refund required"
        : ""
    }`,
    metadata: {
      cancelledBy: by,
      reason: session.cancelReason,
      refundStatus: session.refundStatus,
      // Notice given is what admin uses to judge a late cancellation; there is
      // no automatic forfeit, so the number needs to survive in the record.
      cancellationNoticeHours: session.cancellationNoticeHours,
      wasPaid: session.paymentStatus === "COMPLETED",
    },
  });

  const expertUserId = expert?.userId?.toString();
  // Notify the other party.
  if (isClient && expertUserId) {
    notify(
      expertUserId,
      "BOOKING_CANCELLED",
      "Session cancelled",
      "A client cancelled their session with you.",
      { sessionId: session._id.toString() },
      true,
    );
  } else {
    notify(
      session.userId,
      "BOOKING_CANCELLED",
      "Session cancelled",
      session.paymentStatus === "COMPLETED"
        ? "Your session was cancelled. A refund will be processed manually by our team."
        : "Your session was cancelled.",
      { sessionId: session._id.toString() },
      true,
    );
  }
  return session;
};

const recomputeExpertRating = async (expertId: mongoose.Types.ObjectId) => {
  const agg = await ExpertSession.aggregate([
    {
      $match: {
        expertId,
        reviewed: true,
        reviewHidden: { $ne: true },
        rating: { $gte: 1 },
      },
    },
    {
      $group: {
        _id: "$expertId",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const avg = agg[0]?.avg || 0;
  const count = agg[0]?.count || 0;
  await Expert.findByIdAndUpdate(expertId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
};

export const reviewExpertSession = async (params: {
  sessionId: string;
  userId: string;
  rating: number;
  review?: string;
  anonymous?: boolean;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.status !== "COMPLETED")
    throw new Error("You can only review a completed session");
  if (session.reviewed)
    throw new Error("You have already reviewed this session");
  if (params.rating < 1 || params.rating > 5)
    throw new Error("Rating must be between 1 and 5");

  session.reviewed = true;
  session.rating = params.rating;
  session.review = params.review?.trim();
  session.reviewAnonymous = Boolean(params.anonymous);
  session.reviewedAt = new Date();
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "REVIEW_SUBMITTED",
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    summary: `Client left a ${params.rating}-star review`,
    metadata: {
      rating: params.rating,
      anonymous: Boolean(params.anonymous),
      hasWrittenReview: Boolean(session.review),
    },
  });

  await recomputeExpertRating(session.expertId);

  const expertUserId = await expertUserIdOf(session.expertId);
  if (expertUserId) {
    notify(
      expertUserId,
      "REVIEW_POSTED",
      "New review",
      `You received a ${params.rating}-star review.`,
      { sessionId: session._id.toString() },
    );
  }
  return session;
};

/** Admin: hide/unhide a review and recompute the aggregate rating. */
export const setReviewHidden = async (sessionId: string, hidden: boolean) => {
  const session = await ExpertSession.findById(sessionId);
  if (!session) throw new Error("Session not found");
  session.reviewHidden = hidden;
  await session.save();
  await recomputeExpertRating(session.expertId);
  return session;
};

/** Admin/finance: mark a required manual refund as done, triggering a PhonePe reversal where possible. */
export const markSessionRefundDone = async (sessionId: string) => {
  const session = await ExpertSession.findById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.refundStatus !== "REQUIRED") {
    throw new Error("This session has no pending refund");
  }

  if (session.merchantOrderId) {
    try {
      const refundMerchantId = `EXPERT-REFUND-${Date.now()}-${session._id.toString().slice(-6)}`;
      await initiatePhonePeRefund({
        merchantRefundId: refundMerchantId,
        originalMerchantOrderId: session.merchantOrderId,
        amount: session.amount, // ExpertSession.amount is in rupees
      });
    } catch (refundError) {
      console.error(
        `PhonePe refund failed for expert session ${sessionId} — manual transfer required:`,
        refundError,
      );
      // Do not block the status update; the admin has acknowledged this refund
      // is required and will process it via bank transfer if PhonePe fails.
    }
  } else {
    console.warn(
      `Expert session ${sessionId} has no merchantOrderId — cannot auto-refund via PhonePe. Manual bank transfer required.`,
    );
  }

  session.refundStatus = "MANUAL_DONE";
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "REFUND_COMPLETED",
    toStatus: session.status,
    actorType: "ADMIN",
    channel: "ADMIN_PANEL",
    amountPaise: toPaise(session.amount),
    summary: "Admin marked the manual refund as done",
    metadata: {
      merchantOrderId: session.merchantOrderId,
      refundStatus: "MANUAL_DONE",
    },
  });

  notify(
    session.userId,
    "PAYMENT_REFUND",
    "Refund processed",
    `Your refund of ₹${session.amount.toLocaleString("en-IN")} has been processed.`,
    { sessionId: session._id.toString() },
    true,
  );
  return session;
};

/** Admin/finance: mark a completed session's payout to the expert as done (early, ahead of the 24h auto-release). */
export const markSessionPayoutDone = async (sessionId: string) => {
  const session = await ExpertSession.findById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "COMPLETED" || session.paymentStatus !== "COMPLETED") {
    throw new Error("This session has no payout to release");
  }
  if (session.payoutStatus === "PAID") {
    throw new Error("This session's payout has already been marked paid");
  }
  session.payoutStatus = "PAID";
  session.payoutPaidAt = new Date();
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "PAYOUT_RELEASED",
    toStatus: session.status,
    actorType: "ADMIN",
    channel: "ADMIN_PANEL",
    amountPaise: toPaise(session.amount),
    summary: "Admin released the expert payout early, ahead of the 24h auto-release",
    metadata: { manual: true, payoutPaidAt: session.payoutPaidAt?.toISOString() },
  });

  const expertUserId = await expertUserIdOf(session.expertId);
  if (expertUserId) {
    notify(
      expertUserId,
      "PAYOUT_PROCESSED",
      "Payout released",
      `Your payout of ₹${session.amount} for a completed session has been released.`,
      { sessionId: session._id.toString() },
      true,
    );
  }
  return session;
};

// ── Reads ────────────────────────────────────────────────────────────────────

export const getExpertSessionForUser = async (params: {
  sessionId: string;
  userId: string;
  isAdmin?: boolean;
}) => {
  const session = await ExpertSession.findById(params.sessionId).lean();
  if (!session) throw new Error("Session not found");

  const expert = await Expert.findById(session.expertId)
    .populate("userId", "name email")
    .lean();
  const isClient = session.userId.toString() === params.userId;
  const isExpert =
    expert && (expert.userId as any)?._id?.toString() === params.userId;
  if (!isClient && !isExpert && !params.isAdmin) {
    throw new Error("You are not authorized to view this session");
  }
  const playerSummaries = await fetchPlayerSummariesByIds([session]);
  return serializeSession(session, {
    expert: expert ? serializeExpert(expert) : undefined,
    expertInPersonAddress: expert?.inPersonAddress,
    player: (session as any).playerId
      ? playerSummaries.get((session as any).playerId.toString())
      : undefined,
  });
};

/** Full child profile + roadmap narrative for the expert's booking-detail page. Expert-only. */
export const getExpertSessionPlayerDetail = async (params: {
  sessionId: string;
  expertUserId: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId).lean();
  if (!session) throw new Error("Session not found");

  const expert = await Expert.findOne({
    userId: toObjectId(params.expertUserId),
  })
    .select("_id isActive verificationStatus")
    .lean();
  if (!expert || expert._id.toString() !== session.expertId.toString()) {
    throw new Error("You are not authorized to view this session");
  }
  assertExpertOperational(expert);

  if (!session.playerId) {
    throw new Error("No player profile is linked to this session");
  }

  const player = await Player.findById(session.playerId).lean();
  if (!player) throw new Error("Player profile not found");

  return {
    player: serializeFullPlayerForExpert(player),
  };
};

export const listUserExpertSessions = async (userId: string) => {
  const sessions = await ExpertSession.find({ userId: toObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean();
  const expertIds = [...new Set(sessions.map((s) => s.expertId.toString()))];
  const experts = await Expert.find({ _id: { $in: expertIds } })
    .populate("userId", "name email")
    .lean();
  const byId = new Map(experts.map((e) => [e._id.toString(), e]));
  const playerSummaries = await fetchPlayerSummariesByIds(sessions);
  return sessions.map((s) => {
    const e = byId.get(s.expertId.toString());
    return serializeSession(s, {
      expert: e ? serializeExpert(e) : undefined,
      expertInPersonAddress: e?.inPersonAddress,
      player: s.playerId ? playerSummaries.get(s.playerId.toString()) : undefined,
    });
  });
};

export const listExpertOwnSessions = async (expertUserId: string) => {
  const expert = await Expert.findOne({
    userId: toObjectId(expertUserId),
  }).select("_id timezone");
  if (!expert) return [];
  const tz = (expert as any).timezone || "Asia/Kolkata";
  const sessions = await ExpertSession.find({
    expertId: expert._id,
    // Only show sessions the client actually paid for — an unpaid hold
    // (PENDING_PAYMENT) or a failed payment was never a real booking from
    // the expert's point of view, just noise. A session cancelled after
    // payment succeeded is still shown (paymentStatus stays COMPLETED).
    paymentStatus: "COMPLETED",
  })
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .lean();
  const playerSummaries = await fetchPlayerSummariesByIds(sessions);
  return sessions.map((s) => {
    const u = s.userId as unknown as { name?: string } | null;
    return serializeSession(s, {
      clientName: u?.name || "Client",
      expertTimezone: tz,
      player: s.playerId ? playerSummaries.get(s.playerId.toString()) : undefined,
    });
  });
};

/** Admin: an expert's sessions plus an earnings summary. */
export const getExpertSessionsForAdmin = async (expertId: string) => {
  const expertDoc = await Expert.findById(expertId).select("timezone").lean();
  const tz = (expertDoc as any)?.timezone || "Asia/Kolkata";
  const sessions = await ExpertSession.find({ expertId: toObjectId(expertId) })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();
  const paid = sessions.filter((s) => s.paymentStatus === "COMPLETED");
  const grossEarnings = paid.reduce((sum, s) => sum + (s.amount || 0), 0);
  const refundsPending = sessions
    .filter((s) => s.refundStatus === "REQUIRED")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const completedPaid = sessions.filter(
    (s) => s.status === "COMPLETED" && s.paymentStatus === "COMPLETED",
  );
  const payoutPending = completedPaid
    .filter((s) => (s.payoutStatus || "PENDING") === "PENDING")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const payoutReleased = completedPaid
    .filter((s) => s.payoutStatus === "PAID")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const playerSummaries = await fetchPlayerSummariesByIds(sessions);
  const now = Date.now();
  // A SCHEDULED session whose end time has passed and still has no MOM —
  // it can no longer auto-complete, so this is the admin escalation signal.
  const isAwaitingMom = (s: (typeof sessions)[number]) => {
    if (s.status !== "SCHEDULED" || !s.scheduledAt) return false;
    const end =
      new Date(s.scheduledAt).getTime() + (s.durationMinutes || 60) * 60_000;
    return end < now;
  };
  return {
    sessions: sessions.map((s) => {
      const u = s.userId as unknown as { name?: string; email?: string } | null;
      return {
        ...serializeSession(s, {
          clientName: u?.name || "Client",
          expertTimezone: tz,
          player: s.playerId ? playerSummaries.get(s.playerId.toString()) : undefined,
        }),
        awaitingMom: isAwaitingMom(s),
      };
    }),
    summary: {
      total: sessions.length,
      completed: sessions.filter((s) => s.status === "COMPLETED").length,
      upcoming: sessions.filter((s) => s.status === "SCHEDULED").length,
      awaitingMom: sessions.filter(isAwaitingMom).length,
      grossEarnings,
      refundsPending,
      payoutPending,
      payoutReleased,
    },
  };
};

// ── Webhook reconciliation (idempotent; runs from the Outbox worker) ──────────

const asRec = (v: unknown): Record<string, any> =>
  v && typeof v === "object" ? (v as Record<string, any>) : {};

const pickString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (typeof v === "string" && v) return v;
  return undefined;
};

/**
 * Reconcile an expert session payment from a PhonePe webhook payload.
 * Only handles merchant order IDs prefixed "EXP_"; returns null otherwise so
 * the shared webhook dispatcher can try other handlers.
 */
export const reconcileExpertSessionPaymentFromWebhookPayload = async (
  rawPayload: unknown,
): Promise<ExpertSessionDocument | null> => {
  const payload = asRec(rawPayload);
  const inner = asRec(payload.payload);
  const data = asRec(payload.data);

  const merchantOrderId = pickString(
    payload.originalMerchantOrderId,
    payload.merchantOrderId,
    inner.originalMerchantOrderId,
    inner.merchantOrderId,
    data.originalMerchantOrderId,
    data.merchantOrderId,
    asRec(inner.paymentDetails).merchantOrderId,
    asRec(data.paymentDetails).merchantOrderId,
  );
  if (!merchantOrderId || !merchantOrderId.startsWith("EXP_")) return null;

  const session = await ExpertSession.findOne({ merchantOrderId });
  if (!session) return null;

  const rawState = pickString(
    payload.state,
    inner.state,
    data.state,
    asRec(inner.paymentDetails).state,
    asRec(data.paymentDetails).state,
  );
  const upper = (rawState || "").toUpperCase();

  session.callbackPayload = payload;
  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(upper)) {
    await session.save();
    await applyExpertPaymentSuccess(session, { channel: "WEBHOOK" });
    console.info(
      `[ExpertWebhook] payment confirmed for session ${session._id}`,
    );
  } else if (
    ["FAILED", "PAYMENT_ERROR", "PAYMENT_DECLINED"].includes(upper) &&
    session.paymentStatus !== "COMPLETED"
  ) {
    session.paymentStatus = "FAILED";
    if (session.status === "PENDING_PAYMENT") {
      session.status = "CANCELLED";
      session.cancelledBy = "SYSTEM";
      session.cancelReason = "Payment failed";
      session.cancelledAt = new Date();
      session.set("holdExpiresAt", undefined);
    }
    await session.save();
    console.info(`[ExpertWebhook] payment failed for session ${session._id}`);
  } else {
    await session.save();
  }
  return session;
};

// ── Background maintenance (called by scheduledJobs) ──────────────────────────

/** Expire unpaid holds so their slot frees up. */
export const expireUnpaidExpertHolds = async (): Promise<number> => {
  const now = new Date();
  const stale = await ExpertSession.find({
    status: "PENDING_PAYMENT",
    holdExpiresAt: { $lte: now },
  });
  let count = 0;
  for (const session of stale) {
    // The client-side reconcile call (and previously the webhook, see
    // phonepeWebhook.ts history) can miss a captured payment — never write
    // a hold off as expired without confirming with PhonePe first, so a
    // captured-but-unconfirmed payment doesn't get silently cancelled.
    try {
      const status = await getPhonePeOrderStatus(session.merchantOrderId);
      const state = (status.state || "").toUpperCase();
      if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(state)) {
        await applyExpertPaymentSuccess(session, { channel: "CRON" });
        continue;
      }
    } catch (err) {
      console.error(
        `[expireUnpaidExpertHolds] failed to check PhonePe status for session ${session._id}, skipping this run`,
        err,
      );
      continue;
    }

    const updated = await ExpertSession.findOneAndUpdate(
      { _id: session._id, status: "PENDING_PAYMENT" },
      {
        $set: {
          status: "CANCELLED",
          cancelledBy: "SYSTEM",
          cancelledAt: now,
          cancelReason: "Payment not completed in time",
        },
      },
    );
    if (updated) {
      count += 1;
      await recordExpertSessionEvent(session, {
        type: "EXPIRED",
        fromStatus: "PENDING_PAYMENT",
        toStatus: "CANCELLED",
        actorType: "SYSTEM",
        channel: "CRON",
        occurredAt: session.holdExpiresAt ?? now,
        amountPaise: toPaise(session.amount),
        summary:
          "Unpaid hold expired — cancelled after confirming with PhonePe that no payment was captured",
        metadata: {
          merchantOrderId: session.merchantOrderId,
          holdExpiresAt: session.holdExpiresAt?.toISOString(),
        },
      });
    }
  }
  return count;
};

/** Auto-complete scheduled sessions whose end time has passed. */
// Grace period after a session's end time before the expert gets nudged —
// generous since the cleanup job itself only polls every 15–60 minutes.
const MOM_REMINDER_GRACE_MS = 2 * 60 * 60_000;
// Re-nudge cadence once a session is overdue for MOM (not one-shot — a
// session can sit SCHEDULED indefinitely now that nothing auto-completes it).
const MOM_REMINDER_REPEAT_MS = 24 * 60 * 60_000;

/**
 * Nudge experts whose SCHEDULED session has ended but still has no MOM, so
 * it never gets marked COMPLETED. Repeats every MOM_REMINDER_REPEAT_MS until
 * the expert submits notes — there is no time-based auto-complete anymore.
 */
export const sendExpertMomReminders = async (): Promise<number> => {
  const now = new Date();
  const candidates = await ExpertSession.find({
    status: "SCHEDULED",
    scheduledAt: { $exists: true },
  }).select("_id expertId scheduledAt durationMinutes momReminderSentAt");
  let count = 0;
  for (const s of candidates) {
    const end = new Date(
      new Date(s.scheduledAt as Date).getTime() +
        (s.durationMinutes || 60) * 60_000,
    );
    if (now.getTime() - end.getTime() < MOM_REMINDER_GRACE_MS) continue;
    const lastSent = s.momReminderSentAt
      ? new Date(s.momReminderSentAt).getTime()
      : 0;
    if (now.getTime() - lastSent < MOM_REMINDER_REPEAT_MS) continue;

    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, status: "SCHEDULED", momReminderSentAt: s.momReminderSentAt },
      { $set: { momReminderSentAt: now } },
    );
    if (!updated) continue;
    count += 1;
    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "SESSION_MOM_REMINDER",
        "Add your session notes to complete this session",
        "A session of yours has ended but isn't marked complete yet — add your minutes of meeting to close it out. The parent is waiting to see your notes.",
        { sessionId: s._id.toString() },
        true,
      );
    }
  }
  return count;
};

/**
 * Nudge the expert to add a meeting link when an ONLINE session is starting
 * soon and still has none. Fires once per session (deduped via
 * meetingLinkNudgeSentAt). Window is generous (up to 3h out) since the
 * cleanup job itself only polls every 15–60 minutes.
 */
export const sendExpertMeetingLinkNudges = async (): Promise<number> => {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 60 * 60_000);
  const candidates = await ExpertSession.find({
    status: "SCHEDULED",
    mode: "ONLINE",
    meetingLink: { $in: [null, ""] },
    scheduledAt: { $gte: now, $lte: soon },
    meetingLinkNudgeSentAt: { $exists: false },
  }).select("_id expertId scheduledAt");
  let count = 0;
  for (const s of candidates) {
    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, meetingLinkNudgeSentAt: { $exists: false } },
      { $set: { meetingLinkNudgeSentAt: now } },
    );
    if (!updated) continue;
    count += 1;
    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "SESSION_LINK_REQUIRED",
        "Add your meeting link",
        `Your session on ${new Date(s.scheduledAt as Date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} is coming up and still needs a meeting link.`,
        { sessionId: s._id.toString() },
        true,
      );
    }
  }
  return count;
};

/**
 * "Your session starts soon" reminder to both parties, with whatever
 * connection details are available (meeting link for ONLINE, address for
 * IN_PERSON). Fires once per session (deduped via startReminderSentAt).
 */
export const sendSessionStartReminders = async (): Promise<number> => {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 60 * 60_000);
  const candidates = await ExpertSession.find({
    status: "SCHEDULED",
    scheduledAt: { $gte: now, $lte: soon },
    startReminderSentAt: { $exists: false },
  }).select("_id expertId userId scheduledAt mode meetingLink");
  let count = 0;
  for (const s of candidates) {
    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, startReminderSentAt: { $exists: false } },
      { $set: { startReminderSentAt: now } },
    );
    if (!updated) continue;
    count += 1;

    const when = new Date(s.scheduledAt as Date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
    let clientDetail = "";
    let expertDetail = "";
    if (s.mode === "ONLINE") {
      clientDetail = s.meetingLink
        ? ` Join here: ${s.meetingLink}`
        : " Your expert hasn't shared a meeting link yet — check back shortly.";
      expertDetail = s.meetingLink
        ? ` Your meeting link: ${s.meetingLink}`
        : " Don't forget to add a meeting link.";
    } else if (s.mode === "IN_PERSON") {
      const expertDoc = await Expert.findById(s.expertId)
        .select("inPersonAddress")
        .lean();
      const address = (expertDoc as any)?.inPersonAddress;
      clientDetail = address
        ? ` Location: ${address}`
        : " Contact your expert for the exact location.";
    }

    notify(
      s.userId,
      "BOOKING_REMINDER",
      "Your session starts soon",
      `Your session is scheduled for ${when}.${clientDetail}`,
      { sessionId: s._id.toString() },
      true,
    );

    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "BOOKING_REMINDER",
        "Your session starts soon",
        `Your session is scheduled for ${when}.${expertDetail}`,
        { sessionId: s._id.toString() },
        true,
      );
    }
  }
  return count;
};

/**
 * Auto-release expert payouts 24 hours after session completion, mirroring
 * releaseCompletedBookingPayments() for venue/coach bookings. Anchored on
 * `completedAt` (not `updatedAt`, which a later review submission bumps).
 */
export const releaseExpertSessionPayouts = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const candidates = await ExpertSession.find({
    status: "COMPLETED",
    paymentStatus: "COMPLETED",
    payoutStatus: "PENDING",
    completedAt: { $lte: cutoff },
  }).select("_id expertId amount");
  let count = 0;
  for (const s of candidates) {
    const now = new Date();
    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, payoutStatus: "PENDING" },
      { $set: { payoutStatus: "PAID", payoutPaidAt: now } },
    );
    if (updated) {
      count += 1;
      await recordExpertSessionEvent(s, {
        type: "PAYOUT_RELEASED",
        toStatus: "COMPLETED",
        actorType: "SYSTEM",
        channel: "CRON",
        amountPaise: toPaise(s.amount),
        summary: "Expert payout auto-released 24h after completion",
        metadata: { manual: false, payoutPaidAt: now.toISOString() },
      });

      const expertUserId = await expertUserIdOf(s.expertId);
      if (expertUserId) {
        notify(
          expertUserId,
          "PAYOUT_PROCESSED",
          "Payout released",
          `Your payout of ₹${s.amount} for a completed session has been released.`,
          { sessionId: s._id.toString() },
          true,
        );
      }
    }
  }
  return count;
};

/** Nudge clients who completed a session but haven't reviewed (once). */
export const sendExpertReviewReminders = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sessions = await ExpertSession.find({
    status: "COMPLETED",
    reviewed: false,
    reviewReminderSentAt: { $exists: false },
    updatedAt: { $lte: cutoff },
  }).select("_id userId");
  let count = 0;
  for (const s of sessions) {
    notify(
      s.userId,
      "REVIEW_REMINDER",
      "Rate your expert session",
      "You haven't reviewed your recent expert session yet — your feedback helps other players.",
      { sessionId: s._id.toString() },
      true,
    );
    await ExpertSession.updateOne(
      { _id: s._id },
      { $set: { reviewReminderSentAt: new Date() } },
    );
    count += 1;
  }
  return count;
};
