import { User } from "../../models/User";
import { Expert } from "../../models/ExpertProfile";
import { encryptValue } from "../../../shared/utils/encryption";
import { isSupportedSport, SUPPORTED_SPORTS } from "../../../shared/constants/supportedSports";
import {
  toObjectId,
  PAN_REGEX,
  GST_REGEX,
  generateTemporaryPassword,
  serializeExpertFull,
} from "./shared";

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
  weeklyAvailability?: { dayOfWeek: number; start: string; end: string }[] | undefined;
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
    ...(Array.isArray(payload.blackoutDates) ? { blackoutDates: payload.blackoutDates } : {}),
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
  const unsupported = sports.filter((s) => typeof s === "string" && !isSupportedSport(s));
  if (unsupported.length > 0) {
    const names = SUPPORTED_SPORTS.map((s) => s.name).join(", ");
    throw new Error(
      `Unsupported sport(s): ${unsupported.join(", ")}. Experts currently only cover: ${names}.`
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
  if (out.sessionFee != null && (Number(out.sessionFee) < 0 || isNaN(Number(out.sessionFee)))) {
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

export const updateExpertByAdmin = async (expertId: string, patch: Record<string, unknown>) => {
  const update = sanitizeProfilePatch(patch);
  if (patch.isActive !== undefined) {
    const wantsActive = Boolean(patch.isActive);
    if (wantsActive) {
      // isActive:true is only meaningful alongside APPROVED — otherwise a
      // stray toggle here would make an un-vetted expert publicly bookable
      // with no independent status check anywhere in the booking path.
      const current = await Expert.findById(expertId).select("verificationStatus");
      if (!current) throw new Error("Expert not found");
      if (current.verificationStatus !== "APPROVED") {
        throw new Error("Only an APPROVED expert can be activated — approve them first");
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
    const current = await Expert.findById(expertId).select("verificationStatus");
    if (!current) throw new Error("Expert not found");
    if (current.verificationStatus !== "APPROVED") {
      throw new Error("Only an APPROVED expert can be activated — approve them first");
    }
  }
  const expert = await Expert.findByIdAndUpdate(expertId, { isActive }, { new: true })
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
  if (!current.bio?.trim() || current.bio.trim().length < 20)
    missing.push("a bio (20+ characters)");
  if (!current.achievements?.trim()) missing.push("achievements");
  if (!current.sports || current.sports.length === 0) missing.push("at least one sport");
  if (!current.expertise || current.expertise.length === 0)
    missing.push("at least one expertise tag");
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
    { new: true }
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
    { new: true }
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
    { new: true }
  )
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert not found");
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

export const updateMyExpertProfile = async (userId: string, patch: Record<string, unknown>) => {
  const update = sanitizeProfilePatch(patch);
  const expert = await Expert.findOneAndUpdate({ userId: toObjectId(userId) }, update, {
    new: true,
  })
    .populate("userId", "name email")
    .lean();
  if (!expert) throw new Error("Expert profile not found");
  return serializeExpertFull(expert);
};
