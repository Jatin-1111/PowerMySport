import type { ChildAmbition, ChildExperienceLevel, ChildGender } from "@powermysport/shared-types";
import crypto from "crypto";
import { WhatsAppNote, type NoteChild } from "../../client/models/WhatsAppNote";
import { User } from "../../client/models/User";
import { AppError } from "../../utils/AppError";
import { log as __rootLog } from "../../utils/logger";
import { addDependent, hasCurrentParentalConsent } from "./AuthService/dependents";
import { childNamesOnAccount, describeAge } from "./whatsappNotes";

const log = __rootLog.child("whatsappHandoff");

/**
 * Moving what a parent told the WhatsApp assistant onto their website profile.
 *
 * The parent gets a link in the chat. Holding the link is the proof that they are the person
 * in that chat, so there is nothing to verify about the phone number and the number never
 * appears on the website. The link is a signed token naming the hashed number and a nonce
 * kept on the note: a newer link, the end of the import, or STOP (which deletes the note)
 * each make an older link stop working.
 *
 * Nothing becomes a child profile until a signed-in parent confirms it with a date of birth
 * (WhatsApp only ever heard an age) and the Parental Consent policy.
 */

export const LINK_LIFETIME_DAYS = 7;
const LINK_LIFETIME_MS = LINK_LIFETIME_DAYS * 24 * 3600 * 1000;

export const siteUrl = (): string =>
  (process.env.FRONTEND_URL?.trim() || "https://powermysport.com").replace(/\/+$/, "");

// ─── The token ───────────────────────────────────────────────────────────────

interface LinkPayload {
  /** Hashed WhatsApp number: the key of the note. Signed, so it cannot be swapped. */
  h: string;
  /** Must equal the nonce on the note. */
  n: string;
  /** Expiry, ms since epoch. */
  e: number;
}

const secret = (): string => {
  const key = process.env.JWT_SECRET;
  if (!key) throw new Error("Missing JWT_SECRET");
  return key;
};

const b64 = (value: Buffer | string): string => Buffer.from(value).toString("base64url");

/** Domain-separated, so a token signed for another purpose can never pass as one of these. */
const sign = (body: string): Buffer =>
  crypto.createHmac("sha256", secret()).update(`whatsapp-note-link:${body}`).digest();

export function makeToken(payload: LinkPayload): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(sign(body))}`;
}

function readToken(token: string): LinkPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0 || token.length > 600) return null;
  const given = Buffer.from(signature, "base64url");
  const expected = sign(body);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LinkPayload;
    return typeof parsed.h === "string" &&
      typeof parsed.n === "string" &&
      typeof parsed.e === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export type TokenProblem = "invalid" | "expired" | "replaced" | "empty";

/** The status each problem is answered with: bad link is 400, a link that once worked is 410. */
export const PROBLEM_STATUS: Record<TokenProblem, number> = {
  invalid: 400,
  expired: 410,
  replaced: 410,
  empty: 410,
};

export const PROBLEM_MESSAGE: Record<TokenProblem, string> = {
  invalid: "This link is not valid. Ask the assistant on WhatsApp for a new one.",
  expired: "This link has expired. Ask the assistant on WhatsApp for a new one.",
  replaced: "A newer link was sent. Use the latest one in your WhatsApp chat.",
  empty:
    "There is nothing left to import. Ask the assistant on WhatsApp if you want to start again.",
};

type Resolved =
  { ok: true; phoneHash: string; children: NoteChild[] } | { ok: false; problem: TokenProblem };

async function resolveToken(token: string, now: Date): Promise<Resolved> {
  const payload = readToken(token);
  if (!payload) return { ok: false, problem: "invalid" };
  if (payload.e < now.getTime()) return { ok: false, problem: "expired" };

  const note = await WhatsAppNote.findOne({ phoneHash: payload.h }).lean();
  if (!note || note.children.length === 0) return { ok: false, problem: "empty" };
  if (!note.linkNonce || note.linkNonce !== payload.n) return { ok: false, problem: "replaced" };
  if (note.linkExpiresAt && new Date(note.linkExpiresAt) < now) {
    return { ok: false, problem: "expired" };
  }
  return { ok: true, phoneHash: payload.h, children: note.children };
}

// ─── Making the link (the assistant's tool) ──────────────────────────────────

export type CreateLinkResult =
  { created: true; url: string; days: number } | { created: false; reason: "nothing_noted" };

export async function createProfileLink(
  phoneHash: string,
  now: Date = new Date()
): Promise<CreateLinkResult> {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expires = new Date(now.getTime() + LINK_LIFETIME_MS);
  // Only a note with a child in it can carry a link; this also replaces any earlier link.
  const updated = await WhatsAppNote.updateOne(
    { phoneHash, "children.0": { $exists: true } },
    { $set: { linkNonce: nonce, linkExpiresAt: expires } }
  );
  if (updated.matchedCount === 0) return { created: false, reason: "nothing_noted" };

  const token = makeToken({ h: phoneHash, n: nonce, e: expires.getTime() });
  log.info("profile link made");
  return { created: true, url: `${siteUrl()}/start?t=${token}`, days: LINK_LIFETIME_DAYS };
}

// ─── Suggesting the site's fixed answers from the parent's words ─────────────

/** "professional" is kept on old profiles but is never suggested: "career" replaced it. */
export type Ambition = Exclude<ChildAmbition, "professional">;
export type Experience = ChildExperienceLevel;

/** A suggestion for the parent to confirm, never a value saved on their behalf. */
export function suggestAmbition(goal: string | undefined): Ambition | undefined {
  const text = (goal ?? "").toLowerCase();
  if (!text) return undefined;
  if (/\b(professional|pro|career|olympic|olympics|turn pro)\b/.test(text)) return "career";
  if (/\b(national|nationals|india team|country|represent india)\b/.test(text)) return "national";
  if (/\b(state|district|zonal|compet\w*|tournament\w*|rank\w*|win\w*|academy)\b/.test(text)) {
    return "competitive";
  }
  if (/\b(fun|hobby|enjoy\w*|recreation\w*|casual|just play)\b/.test(text)) return "fun";
  return undefined;
}

export function suggestExperience(level: string | undefined): Experience | undefined {
  const text = (level ?? "").toLowerCase();
  if (!text) return undefined;
  if (/\b(advanced|competitive|elite|state|national|expert|pro)\b/.test(text)) return "competitive";
  if (/\b(intermediate|some experience|club|district|medium|average)\b/.test(text)) {
    return "intermediate";
  }
  if (/\b(beginner|new|starting|just started|never|basic)\b/.test(text)) return "beginner";
  return undefined;
}

// ─── The review page ─────────────────────────────────────────────────────────

export interface PreviewChild {
  key: string;
  firstName: string;
  /** Said in words ("about 15"), never as a fresh number. */
  ageText?: string;
  sports: string[];
  level?: string;
  goal?: string;
  state?: string;
  suggestedAmbition?: Ambition;
  suggestedExperience?: Experience;
}

export type PreviewResult =
  { ok: true; children: PreviewChild[] } | { ok: false; problem: TokenProblem };

export async function previewForToken(
  token: string,
  now: Date = new Date()
): Promise<PreviewResult> {
  const resolved = await resolveToken(token, now);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    children: resolved.children.map((child) => {
      const ageText = describeAge(child, now);
      const ambition = suggestAmbition(child.goal);
      const experience = suggestExperience(child.level);
      return {
        key: child.key,
        firstName: child.firstName,
        ...(ageText ? { ageText } : {}),
        sports: child.sports,
        ...(child.level ? { level: child.level } : {}),
        ...(child.goal ? { goal: child.goal } : {}),
        ...(child.state ? { state: child.state } : {}),
        ...(ambition ? { suggestedAmbition: ambition } : {}),
        ...(experience ? { suggestedExperience: experience } : {}),
      };
    }),
  };
}

// ─── Confirming ──────────────────────────────────────────────────────────────

export interface ClaimItem {
  key: string;
  /** YYYY-MM-DD. WhatsApp only heard an age, so this is always asked for. */
  dob: string;
  gender?: ChildGender;
  relation?: string;
  ambition?: ChildAmbition;
  experienceLevel?: Experience;
}

export interface ClaimResult {
  created: string[];
  /** Already on the account under the same first name, so not added twice. */
  skipped: string[];
  /** Not in the note any more: claimed already, or removed. */
  missing: string[];
  failed: Array<{ name: string; reason: string }>;
  remaining: number;
}

const under18 = (dob: Date, now: Date): boolean => {
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - 18);
  return dob.getTime() > limit.getTime() && dob.getTime() <= now.getTime();
};

/**
 * Takes one child out of the note and returns it, or null when it is not there. Doing this
 * first, atomically, is what makes a child be created at most once even if the parent taps
 * twice or two tabs confirm together: only one of them gets the child back.
 */
async function takeChild(phoneHash: string, key: string): Promise<NoteChild | null> {
  const before = await WhatsAppNote.findOneAndUpdate(
    { phoneHash, "children.key": key },
    { $pull: { children: { key } } },
    { new: false }
  ).lean();
  return before?.children.find((child) => child.key === key) ?? null;
}

/** Puts a child back after the profile could not be made, so the parent can try again. */
async function restoreChild(phoneHash: string, child: NoteChild): Promise<void> {
  await WhatsAppNote.updateOne(
    { phoneHash, "children.key": { $ne: child.key } },
    { $push: { children: child } }
  );
}

export async function claimForUser(
  userId: string,
  token: string,
  items: ClaimItem[],
  parentalConsent: boolean,
  now: Date = new Date()
): Promise<ClaimResult> {
  const user = await User.findById(userId).select("role legalConsents").lean();
  if (!user) throw new AppError("Unauthorized", 401);
  if (user.role === "Player") {
    throw new AppError(
      "Only a parent profile can add children. Switch to a parent profile first.",
      403
    );
  }
  // Checked before any child is touched, so a missing tick does not half-import.
  if (!hasCurrentParentalConsent(user as never) && parentalConsent !== true) {
    throw new AppError("Please accept the Parental Consent policy to add a child.", 428);
  }

  const resolved = await resolveToken(token, now);
  if (!resolved.ok) {
    throw new AppError(PROBLEM_MESSAGE[resolved.problem], PROBLEM_STATUS[resolved.problem]);
  }

  const onAccount = await childNamesOnAccount(userId);

  const result: ClaimResult = { created: [], skipped: [], missing: [], failed: [], remaining: 0 };

  for (const item of items) {
    const child = await takeChild(resolved.phoneHash, item.key);
    if (!child) {
      result.missing.push(item.key);
      continue;
    }
    if (onAccount.has(child.key)) {
      result.skipped.push(child.firstName);
      continue;
    }

    const dob = new Date(item.dob);
    if (Number.isNaN(dob.getTime()) || !under18(dob, now)) {
      await restoreChild(resolved.phoneHash, child);
      result.failed.push({
        name: child.firstName,
        reason: "Enter a valid date of birth under 18.",
      });
      continue;
    }

    try {
      await addDependent(userId, {
        name: child.firstName,
        dob,
        parentalConsent,
        ...(item.gender ? { gender: item.gender } : {}),
        ...(item.relation ? { relation: item.relation } : {}),
        sportsFocus: child.sports,
        ...(child.state ? { location: child.state } : {}),
        ...(item.ambition ? { ambition: item.ambition } : {}),
        ...(item.experienceLevel ? { experienceLevel: item.experienceLevel } : {}),
      });
      onAccount.add(child.key);
      result.created.push(child.firstName);
    } catch (err) {
      await restoreChild(resolved.phoneHash, child);
      const reason = err instanceof AppError ? err.message : "Could not add this child.";
      // The consent case was handled above; any other refusal (the ten-child limit) is
      // reported for this child and the rest are still tried.
      result.failed.push({ name: child.firstName, reason });
      if (!(err instanceof AppError)) log.error("could not add an imported child", err);
    }
  }

  const left = await WhatsAppNote.findOne({ phoneHash: resolved.phoneHash }).lean();
  result.remaining = left?.children.length ?? 0;
  // A finished import leaves nothing behind, and ends the link with it.
  if (left && result.remaining === 0) {
    await WhatsAppNote.deleteOne({
      phoneHash: resolved.phoneHash,
      "children.0": { $exists: false },
    });
  }
  log.info(
    `import: ${result.created.length} created, ${result.skipped.length} skipped, ${result.failed.length} failed`
  );
  return result;
}
