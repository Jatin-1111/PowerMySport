import mongoose from "mongoose";
import { Player } from "../../client/models/Player";
import { SeasonPlan } from "../../client/models/SeasonPlan";
import { PlannerService } from "../../client/services/PlannerService";
import { SeasonPlanService } from "../../client/services/SeasonPlanService";
import { isSupportedSport, toSupportedSlug } from "../constants/supportedSports";
import { AppError } from "../../utils/AppError";
import { log as __rootLog } from "../../utils/logger";
import type { ChatToolContext } from "./chatToolsService";
import { chooseChild, dateOnly, firstName } from "./parentContext";
import { findEditionsForChat, type EditionForChat } from "./tournamentEditionQueries";
import {
  registerPendingExecutor,
  storePendingAction,
  type PendingExecutor,
} from "./whatsappPendingAction";
import { siteUrl } from "./whatsappHandoff";

const log = __rootLog.child("whatsappSeasonPlan");

/**
 * Putting a tournament on a child's season plan from WhatsApp.
 *
 * `prepare_season_plan_entry` finds the one event, checks it against the planner, and stores what
 * it would do as a pending action. The shared `confirm_pending_action` step then adds it, only
 * after the parent's own clear yes. Only "shortlisted" is ever written: entering an event is a
 * commitment, and it stays the parent's own decision on the website.
 *
 * Off unless `WHATSAPP_SEASON_PLAN=on`.
 */

export const SEASON_KIND = "season_entry";

export const seasonToolEnabled = (): boolean => process.env.WHATSAPP_SEASON_PLAN === "on";

export const MAX_SEASON_ADDS_PER_DAY = 10;
const DAY_MS = 24 * 3600 * 1000;
/** A note on an entry is the parent's own words; kept short and plain. */
const MAX_NOTE = 140;

const NOT_ON = {
  available: false,
  instruction:
    "Adding to a season plan from here is not switched on yet. Say so, and that they can add it themselves at https://powermysport.com/planner.",
} as const;

const NOT_LINKED = {
  available: false,
  reason: "number_not_linked",
  instruction:
    "This number is not tied to a PowerMySport account, so nothing can be added to a plan here. Say that plainly, and that signing in at https://powermysport.com/planner lets them plan a season.",
} as const;

/** Plain, short text only: no links, markup or line breaks. */
function plainNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[<>{}[\]\\`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NOTE);
  return text || undefined;
}

// ─── The daily limit ─────────────────────────────────────────────────────────────────────

/** Events put on any of this account's plans in the last day, from here or from the website. */
async function addsInTheLastDay(userId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS);
  const [row] = await SeasonPlan.aggregate<{ n: number }>([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $unwind: "$entries" },
    { $match: { "entries.addedAt": { $gte: since } } },
    { $count: "n" },
  ]);
  return row?.n ?? 0;
}

const LIMIT_TEXT = `Season plans take ${MAX_SEASON_ADDS_PER_DAY} events a day for one account. Say so, and that they can add more tomorrow or on https://powermysport.com/planner.`;

// ─── Step one: prepare ──────────────────────────────────────────────────────────────────

/** The event the parent means: one calendar event, or what to ask to settle it. */
async function findEvent(
  query: string,
  sportSlug: string | undefined
): Promise<{ edition: EditionForChat } | { reply: Record<string, unknown> }> {
  const { editions, more } = await findEditionsForChat({
    query,
    ...(sportSlug ? { sportSlug } : {}),
    limit: 3,
  });
  const wanted = query.trim().toLowerCase();
  // A slug typed in full (the assistant passes one back after asking which) settles it.
  const exact = editions.find((edition) => edition.slug === wanted);
  const found = exact ? [exact] : editions;

  if (found.length === 0) {
    return {
      reply: {
        ready: false,
        reason: "not_found",
        instruction:
          "No upcoming tournament on the calendar matches that. Say so, and ask for the city or the full name, or point to https://powermysport.com/tournaments.",
      },
    };
  }
  if (found.length > 1) {
    return {
      reply: {
        ready: false,
        reason: "which_event",
        moreMatches: more,
        options: found.map((edition) => ({
          name: edition.name,
          city: edition.city,
          starts: dateOnly(edition.startDate),
          slug: edition.slug,
        })),
        instruction:
          "More than one event matches. Ask the parent which one they mean, listing these by name, place and date. Then call this again with that event's slug as `tournament`. Do not guess.",
      },
    };
  }
  return { edition: found[0]! };
}

/** What the planner says about this event for this child, as a refusal or the caveats to say aloud. */
async function checkEligibility(
  userId: string,
  dependentId: string,
  childName: string,
  slug: string
): Promise<{ refuse: string } | { caveats: string[] }> {
  const overview = await PlannerService.forDependent(userId, dependentId).catch(() => null);

  if (!overview || overview.linkState !== "ready" || !overview.shortlist) {
    return {
      caveats: [
        `I could not check whether ${childName} can enter, because no ranking is linked yet. The planner at ${siteUrl()}/planner shows that once one is.`,
      ],
    };
  }

  const { ownGroup, playingUp, unknown, closed } = overview.shortlist;
  const inList = (entries: typeof ownGroup) => entries.find((entry) => entry.edition.slug === slug);

  const shut = inList(closed);
  if (shut) return { refuse: shut.reason };

  const older = inList(playingUp);
  if (older) {
    return {
      caveats: [
        `This is an older age group than ${childName}'s own, so it would use a place from the yearly allowance.`,
        ...older.notes,
      ],
    };
  }
  const uncertain = inList(unknown);
  if (uncertain) return { caveats: [uncertain.reason, ...uncertain.notes] };
  const own = inList(ownGroup);
  if (own) return { caveats: own.notes };

  return {
    caveats: [
      `It is not on ${childName}'s list of events they can enter, so check its entry rules before planning on it.`,
    ],
  };
}

export async function prepareSeasonEntry(
  context: ChatToolContext | undefined,
  args: Record<string, unknown>,
  now: Date = new Date()
): Promise<unknown> {
  if (!seasonToolEnabled()) return NOT_ON;
  if (!context?.userId || !context.phoneHash) return NOT_LINKED;
  const { userId, phoneHash } = context;

  const players = await Player.find({ userId }).sort({ createdAt: 1 }).lean();
  const picked = chooseChild(players, args.childName, "the event");
  if ("reply" in picked) return picked.reply;
  const child = picked.child;
  const dependentId = String(child._id);
  const name = firstName(child.name, "your child");

  const query = typeof args.tournament === "string" ? args.tournament.trim() : "";
  if (!query) {
    return {
      ready: false,
      reason: "which_event",
      instruction:
        "Ask which tournament they mean, by name or place. Then call this again with it.",
    };
  }

  // The plan's sport is fixed by its first event, so search that sport; before there is a plan,
  // the child's own sport narrows it when it is one we cover.
  const plan = await SeasonPlanService.get(userId, dependentId);
  const ownSport = [child.chosenSport, ...(child.sportsFocus ?? [])].find(
    (sport): sport is string => Boolean(sport) && isSupportedSport(String(sport))
  );
  const sportSlug =
    plan.entries.length > 0 ? plan.sportSlug : ownSport && toSupportedSlug(ownSport);

  const event = await findEvent(query, sportSlug);
  if ("reply" in event) return event.reply;
  const { edition } = event;
  if (!edition.slug) {
    return {
      ready: false,
      reason: "not_found",
      instruction:
        "That event cannot be added from here. Say so, and point to https://powermysport.com/planner.",
    };
  }

  if (plan.entries.some((entry) => entry.editionSlug === edition.slug)) {
    return {
      ready: false,
      reason: "already_on_plan",
      instruction: `${edition.name} is already on ${name}'s season plan. Say so; there is nothing to add.`,
    };
  }

  const eligibility = await checkEligibility(userId, dependentId, name, edition.slug);
  if ("refuse" in eligibility) {
    return {
      ready: false,
      reason: "cannot_enter",
      event: edition.name,
      instruction: `${name} cannot enter ${edition.name}: ${eligibility.refuse} Say so plainly and do not add it. You may offer to look for events that are open.`,
    };
  }

  if ((await addsInTheLastDay(userId, now)) >= MAX_SEASON_ADDS_PER_DAY) {
    return { ready: false, reason: "daily_limit", instruction: LIMIT_TEXT };
  }

  const note = plainNote(args.note);
  await storePendingAction(
    phoneHash,
    SEASON_KIND,
    {
      dependentId,
      childName: name,
      editionSlug: edition.slug,
      editionName: edition.name,
      ...(note ? { note } : {}),
    },
    now
  );

  const place = [edition.city, edition.state].filter(Boolean).join(", ");
  return {
    ready: true,
    child: name,
    event: {
      name: edition.name,
      starts: dateOnly(edition.startDate),
      ...(place ? { where: place } : {}),
    },
    caveats: eligibility.caveats,
    instruction: `Tell the parent you are about to shortlist ${edition.name}${place ? ` in ${place}` : ""}, starting ${dateOnly(edition.startDate)}, on ${name}'s season plan.${eligibility.caveats.length ? ` Mention: ${eligibility.caveats.join(" ")}` : ""} Say that this only shortlists it; entering is done on the website. Ask them to reply YES to go ahead. It is NOT added yet. Do NOT call confirm_pending_action until they have replied.`,
  };
}

// ─── Step two: adding it, once the parent has said yes ──────────────────────────────────

interface SeasonPayload {
  dependentId: string;
  childName: string;
  editionSlug: string;
  editionName: string;
  note?: string;
}

const executeSeasonEntry: PendingExecutor["execute"] = async (pending, { userId, now }) => {
  const { dependentId, childName, editionSlug, editionName, note } =
    pending.payload as unknown as SeasonPayload;

  if ((await addsInTheLastDay(userId, now)) >= MAX_SEASON_ADDS_PER_DAY) {
    return {
      done: false,
      retry: false,
      reply: { added: false, reason: "daily_limit", instruction: LIMIT_TEXT },
    };
  }

  try {
    const plan = await SeasonPlanService.addEntry({ userId, dependentId, editionSlug, note });
    log.info("season plan entry added from WhatsApp");
    return {
      done: true,
      reply: {
        added: true,
        event: editionName,
        status: "shortlisted",
        eventsOnPlan: plan.entries.length,
        link: `${siteUrl()}/planner`,
        instruction: `${editionName} is now shortlisted on ${childName}'s season plan (${plan.entries.length} on the plan). Say so in a line, that entering is done on the website, and give the link on its own line.`,
      },
    };
  } catch (err) {
    // The planner's own refusals (a full plan, a different sport, an event that has left the
    // calendar) are about this event, so trying again will not help. Anything else is unexpected
    // and the shared step puts the action back.
    if (err instanceof AppError) {
      return {
        done: false,
        retry: false,
        reply: {
          added: false,
          reason: "refused",
          instruction: `It could not be added: ${err.message} Say so briefly.`,
        },
      };
    }
    throw err;
  }
};

registerPendingExecutor(SEASON_KIND, {
  enabled: seasonToolEnabled,
  notEnabledReply: NOT_ON,
  execute: executeSeasonEntry,
});
