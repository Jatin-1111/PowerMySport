import { CHILD_AMBITIONS, CHILD_EXPERIENCE_LEVELS } from "@powermysport/shared-types";
import { GuidanceSubmission } from "../../client/models/GuidanceSubmission";
import { Player } from "../../client/models/Player";
import { WhatsAppConversation } from "../../client/models/WhatsAppConversation";
import { createGuidancePlan } from "../../client/services/GuidancePlanService";
import {
  buildPlanInput,
  type PlanAnswers,
  type PlanProfile,
} from "../../client/services/guidancePlanInput";
import { log as __rootLog } from "../../utils/logger";
import type { ChatToolContext } from "./chatToolsService";
import { summariseGuidance } from "./parentAccountLookups";
import { firstName, pickChildren } from "./parentContext";
import { siteUrl } from "./whatsappHandoff";

const log = __rootLog.child("whatsappGuidancePlan");

/**
 * Making a development plan from WhatsApp, in two steps the server enforces.
 *
 * The model cannot be trusted to confirm on the parent's behalf, so confirming is not something
 * it decides. `prepare` builds and stores the request and asks nothing of the model beyond saying
 * it back. `confirm` makes the plan only when (1) the parent's own latest message is a clear yes,
 * (2) a prepared plan is waiting from an earlier message and is under 15 minutes old, and (3) the
 * daily limits allow it. The prepared plan is taken atomically, so two yeses make one plan.
 *
 * Off unless `WHATSAPP_GUIDANCE_PLAN=on`: a plan costs model calls, so it is switched on on
 * purpose, after it has been tried live.
 */

export const planToolEnabled = (): boolean => process.env.WHATSAPP_GUIDANCE_PLAN === "on";

export const PLAN_CONFIRM_MINUTES = 15;
export const MAX_PLANS_PER_CHILD_PER_DAY = 1;
export const MAX_PLANS_PER_ACCOUNT_PER_DAY = 3;

const DAY_MS = 24 * 3600 * 1000;

const NOT_ON = {
  available: false,
  instruction:
    "Making a plan here is not switched on yet. Say so, and that they can make one at https://powermysport.com/guidance.",
} as const;

const NOT_LINKED = {
  available: false,
  reason: "number_not_linked",
  instruction:
    "This number is not tied to a PowerMySport account, so a plan cannot be made here. Say that plainly, and that signing in at https://powermysport.com/guidance lets them make one.",
} as const;

// ─── Is this message a yes? ──────────────────────────────────────────────────────────────

/** Words that say yes, in English, Hindi written in English letters, and Devanagari. */
const YES = new Set([
  "yes",
  "y",
  "yeah",
  "yep",
  "yup",
  "ok",
  "okay",
  "okey",
  "sure",
  "confirm",
  "confirmed",
  "proceed",
  "go",
  "ahead",
  "do",
  "haan",
  "han",
  "ha",
  "haa",
  "hanji",
  "ji",
  "theek",
  "thik",
  "chalega",
  "kar",
  "karo",
  "kardo",
  "krdo",
  "bana",
  "banao",
  "dijiye",
  "हाँ",
  "हां",
  "जी",
  "ठीक",
  "कर",
  "दो",
  "बना",
]);

/** Words that may surround a yes without changing it. Anything else makes the message not a yes. */
const FILLER = new Set([
  "please",
  "plz",
  "pls",
  "thanks",
  "thank",
  "you",
  "the",
  "plan",
  "it",
  "now",
  "then",
  "and",
  "hai",
  "to",
  "sir",
  "madam",
  "make",
  "create",
  "kindly",
  "है",
]);

/**
 * A clear yes and nothing else. Every word must be a yes or a harmless filler, so "yes but add
 * cricket", "what do you do" and "no" all fail and the assistant simply asks again.
 */
export function isAffirmative(text: string | undefined | null): boolean {
  const words = (text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > 7) return false;
  return words.every((word) => YES.has(word) || FILLER.has(word)) && words.some((w) => YES.has(w));
}

// ─── Limits ─────────────────────────────────────────────────────────────────────────────

/** Why no more plans can be made now, in words for the parent, or null when one can. */
async function limitReached(
  userId: string,
  childId: string,
  childName: string,
  now: Date
): Promise<string | null> {
  const since = new Date(now.getTime() - DAY_MS);
  const [forAccount, forChild] = await Promise.all([
    GuidanceSubmission.countDocuments({ userId, createdAt: { $gte: since } }),
    GuidanceSubmission.countDocuments({
      userId,
      createdAt: { $gte: since },
      "request.dependent_id": childId,
    }),
  ]);
  if (forChild >= MAX_PLANS_PER_CHILD_PER_DAY) {
    return `${childName} already has a plan made in the last day. Say so, that a new one can be made tomorrow, and that the saved one is at ${siteUrl()}/guidance. get_my_guidance_plan reads it.`;
  }
  if (forAccount >= MAX_PLANS_PER_ACCOUNT_PER_DAY) {
    return `Plans are limited to ${MAX_PLANS_PER_ACCOUNT_PER_DAY} a day for one account. Say so, and that they can make another tomorrow.`;
  }
  return null;
}

// ─── Step one: prepare ──────────────────────────────────────────────────────────────────

const cleanGender = (value: unknown): PlanAnswers["gender"] => {
  const text = String(value ?? "").toLowerCase();
  if (text === "boy" || text === "male") return "male";
  if (text === "girl" || text === "female") return "female";
  return undefined;
};

function cleanAnswers(args: Record<string, unknown>): PlanAnswers {
  const ambition = String(args.ambition ?? "").toLowerCase();
  const experience = String(args.experienceLevel ?? "").toLowerCase();
  const hours = typeof args.weeklyHours === "number" ? args.weeklyHours : undefined;
  const gender = cleanGender(args.gender);
  return {
    ...(typeof args.sport === "string" && args.sport.trim() ? { sport: args.sport } : {}),
    ...(gender ? { gender } : {}),
    ...((CHILD_AMBITIONS as readonly string[]).includes(ambition)
      ? { ambition: ambition as PlanAnswers["ambition"] & string }
      : {}),
    ...((CHILD_EXPERIENCE_LEVELS as readonly string[]).includes(experience)
      ? { experienceLevel: experience as PlanAnswers["experienceLevel"] & string }
      : {}),
    ...(hours !== undefined ? { weeklyHours: hours } : {}),
    ...(typeof args.question === "string" && args.question.trim()
      ? { question: args.question }
      : {}),
    ...(args.skipOptionalQuestions === true ? { useDefaults: true } : {}),
  };
}

/** Shapes a stored profile the way the plan mapper reads it. */
function profileOf(player: {
  _id: unknown;
  dob?: Date | null;
  age?: number | null;
  gender?: string | null;
  sportsFocus?: string[];
  chosenSport?: string | null;
  yearsPlaying?: number | null;
  location?: string | null;
  ambition?: string | null;
  experienceLevel?: string | null;
  weeklyHoursCategory?: string | null;
  budgetRange?: string | null;
}): PlanProfile {
  return {
    id: String(player._id),
    dob: player.dob ?? undefined,
    age: player.age ?? undefined,
    gender: (player.gender as PlanProfile["gender"]) ?? undefined,
    sportsFocus: player.sportsFocus ?? [],
    chosenSport: player.chosenSport ?? undefined,
    yearsPlaying: player.yearsPlaying ?? undefined,
    location: player.location ?? undefined,
    ambition: (player.ambition as PlanProfile["ambition"]) ?? undefined,
    experienceLevel: (player.experienceLevel as PlanProfile["experienceLevel"]) ?? undefined,
    weeklyHoursCategory:
      (player.weeklyHoursCategory as PlanProfile["weeklyHoursCategory"]) ?? undefined,
    budgetRange: (player.budgetRange as PlanProfile["budgetRange"]) ?? undefined,
  };
}

export async function prepareGuidancePlan(
  context: ChatToolContext | undefined,
  args: Record<string, unknown>,
  now: Date = new Date()
): Promise<unknown> {
  if (!planToolEnabled()) return NOT_ON;
  if (!context?.userId || !context.phoneHash) return NOT_LINKED;
  const { userId, phoneHash } = context;

  const players = await Player.find({ userId }).sort({ createdAt: 1 }).lean();
  if (players.length === 0) {
    return {
      ready: false,
      reason: "no_children",
      instruction:
        "No child is on this profile yet, so there is nobody to make a plan for. Say so, and offer to note the child and send a link to add them.",
    };
  }

  const childName = typeof args.childName === "string" ? args.childName : undefined;
  let chosen = players[0]!;
  if (childName?.trim()) {
    const picked = pickChildren(players, childName);
    if (!picked.found || picked.items.length === 0) {
      return {
        ready: false,
        reason: "child_not_on_account",
        childrenOnAccount: players.map((p) => firstName(p.name, "a child")),
        instruction:
          "No child with that name is on this profile. Say who is, by first name, and ask which one the plan is for.",
      };
    }
    chosen = picked.items[0]!;
  } else if (players.length > 1) {
    return {
      ready: false,
      reason: "which_child",
      children: players.map((p) => firstName(p.name, "a child")),
      instruction:
        "Ask which child the plan is for, naming them. Then call this again with the name.",
    };
  }

  const name = firstName(chosen.name, "your child");
  const input = buildPlanInput(profileOf(chosen), cleanAnswers(args), now);
  if (!input.complete) {
    return {
      ready: false,
      reason: "needs_answers",
      child: name,
      next: input.missing[0],
      stillToAsk: input.missing.map((question) => question.field),
      instruction:
        "Ask the parent the question in `next`, one question only, in your own words and with its options if it has them. When it is optional, tell them they can say skip. Then call this again with the answer (or skipOptionalQuestions true if they skip). Do not make or promise a plan yet.",
    };
  }

  const limit = await limitReached(userId, String(chosen._id), name, now);
  if (limit) return { ready: false, reason: "daily_limit", instruction: limit };

  const conversation = await WhatsAppConversation.findOne({ phoneHash })
    .select("totalMessageCount")
    .lean();
  await WhatsAppConversation.updateOne(
    { phoneHash },
    {
      $set: {
        pendingPlan: {
          request: input.request,
          assumptions: input.assumptions,
          childName: name,
          turn: conversation?.totalMessageCount ?? 0,
          createdAt: now,
        },
      },
    },
    { upsert: true }
  );

  return {
    ready: true,
    child: name,
    sport: input.request.sport,
    age: input.request.child_age,
    assumptions: input.assumptions,
    instruction: `Tell the parent what you are about to make: a development plan for ${name} in ${input.request.sport}${input.assumptions.length ? `, assuming ${input.assumptions.join(", ")} (they can correct any of these)` : ""}. Say it takes about half a minute and is saved to their account. Ask them to reply YES to go ahead. Do NOT call confirm_guidance_plan until they have replied.`,
  };
}

// ─── Step two: confirm ──────────────────────────────────────────────────────────────────

export async function confirmGuidancePlan(
  context: ChatToolContext | undefined,
  now: Date = new Date()
): Promise<unknown> {
  if (!planToolEnabled()) return NOT_ON;
  if (!context?.userId || !context.phoneHash) return NOT_LINKED;
  const { userId, phoneHash } = context;

  // The parent's own words, not the model's say-so. Checked before anything is touched, so a
  // message that is not a yes leaves the prepared plan waiting.
  if (!isAffirmative(context.userMessage)) {
    return {
      created: false,
      reason: "not_confirmed",
      instruction:
        "The parent's last message was not a clear yes, so no plan was made. Do not make one. Ask them to reply YES to go ahead, or to tell you what to change.",
    };
  }

  const conversation = await WhatsAppConversation.findOne({ phoneHash })
    .select("pendingPlan totalMessageCount")
    .lean();
  const pending = conversation?.pendingPlan;
  const fresh =
    pending &&
    now.getTime() - new Date(pending.createdAt).getTime() <= PLAN_CONFIRM_MINUTES * 60_000;
  if (!pending || !fresh) {
    return {
      created: false,
      reason: "nothing_pending",
      instruction:
        "There is no plan waiting for a yes, or it has timed out. Offer to set one up again with prepare_guidance_plan. Do not make a plan now.",
    };
  }
  // A plan can only be confirmed by a later message than the one that prepared it.
  if ((conversation?.totalMessageCount ?? 0) <= pending.turn) {
    return {
      created: false,
      reason: "not_confirmed",
      instruction:
        "The plan was only just prepared and the parent has not replied to it. Do not make it. Ask them to reply YES to go ahead.",
    };
  }

  // Take it, once. Only the request that wins this makes the plan; a second yes finds nothing.
  const taken = await WhatsAppConversation.findOneAndUpdate(
    { phoneHash, "pendingPlan.createdAt": pending.createdAt },
    { $unset: { pendingPlan: "" } },
    { new: false }
  ).lean();
  if (!taken?.pendingPlan) {
    return {
      created: false,
      reason: "already_handled",
      instruction:
        "That plan is already being made or was just made. Say it is on its way and do not start another.",
    };
  }

  const request = pending.request as unknown as Parameters<typeof createGuidancePlan>[0];
  const childId = String(request.dependent_id ?? "");
  const limit = await limitReached(userId, childId, pending.childName, now);
  if (limit) return { created: false, reason: "daily_limit", instruction: limit };

  try {
    const result = await createGuidancePlan(request, { userId, source: "SERVER" });
    if (result.status === "not_supported") {
      return {
        created: false,
        reason: "unsupported_sport",
        instruction: `Plans are not made for ${result.sport} yet. Say so.`,
      };
    }
    log.info(`plan made from WhatsApp for ${request.sport}`);
    return {
      created: true,
      plan: summariseGuidance(
        {
          request: result.submission.request,
          response: result.response,
          createdAt: result.submission.createdAt,
        },
        pending.childName
      ),
      assumptions: pending.assumptions,
      link: `${siteUrl()}/guidance`,
      instruction:
        "The plan is made and saved to their account. Summarise it in a few short lines: the verdict on the goal, the weekly blueprint, the first phase or two, and the burnout note. Say the full plan, with its PDF, is saved in their plan history at the link, on its own line. Do not paste the whole plan.",
    };
  } catch (err) {
    // Nothing was saved. Put the plan back so "try again" works without starting over.
    log.error("could not make the plan from WhatsApp", err);
    await WhatsAppConversation.updateOne(
      { phoneHash, pendingPlan: { $exists: false } },
      {
        $set: {
          pendingPlan: { ...pending, turn: conversation?.totalMessageCount ?? pending.turn },
        },
      }
    );
    return {
      created: false,
      reason: "unavailable",
      instruction:
        "The plan could not be made just now, and nothing was saved. Say so briefly, and that they can reply YES again in a minute to try once more.",
    };
  }
}
