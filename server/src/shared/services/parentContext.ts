import { ExpertSession } from "../../client/models/ExpertBooking";
import { Player } from "../../client/models/Player";
import { SeasonPlan } from "../../client/models/SeasonPlan";
import { User } from "../../client/models/User";
import { RankingClaimService } from "../../client/services/RankingClaimService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("parentContext");

/**
 * What the assistant may know about the parent it is talking to, read from their account.
 *
 * This is the one place account data reaches the assistant's prompt, so it is also the one
 * place to put a gate in front of it. WhatsApp matches a number to an account on the typed
 * phone alone; if that is ever tightened (a verified number), this function is where
 * "who may see this" gets enforced.
 *
 * Deliberately left out: phone, email, address, payment and wallet details, and anything
 * that identifies a child beyond a first name. A child's surname, date of birth and
 * registration number never leave the account.
 */

const MAX_CHILDREN = 4;

export interface ChildContext {
  firstName: string;
  age?: number;
  /** The committed sport first, then the ones in focus. */
  sports: string[];
  yearsPlaying?: number;
  level?: string;
  ambition?: string;
  state?: string;
  ranking?: { sport: string; list: string; rank: number };
}

export interface ParentContext {
  parent: { firstName: string; city?: string };
  children: ChildContext[];
  /** Children on the account beyond the ones listed. */
  moreChildren: number;
  plannedEvents: number;
  upcomingSessions: number;
}

export const firstName = (full: string | null | undefined, fallback: string): string =>
  (full ?? "").trim().split(/\s+/)[0] || fallback;

/** From the date of birth when there is one, otherwise the age the parent entered. */
export function ageOf(player: { dob?: Date; age?: number }, now: Date): number | undefined {
  if (player.dob) {
    const born = new Date(player.dob);
    let years = now.getUTCFullYear() - born.getUTCFullYear();
    const hadBirthday =
      now.getUTCMonth() > born.getUTCMonth() ||
      (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() >= born.getUTCDate());
    if (!hadBirthday) years -= 1;
    if (years >= 0 && years < 30) return years;
  }
  return typeof player.age === "number" ? player.age : undefined;
}

/** One failed read drops its section, not the whole answer. */
async function orElse<T>(what: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (err) {
    log.warn(`could not read ${what} for the parent context`, { error: (err as Error).message });
    return fallback;
  }
}

export async function getParentContext(
  userId: string,
  now: Date = new Date()
): Promise<ParentContext | null> {
  const [user, players, claims, plans, upcomingSessions] = await Promise.all([
    orElse("user", () => User.findById(userId).select("name city").lean(), null),
    orElse("children", () => Player.find({ userId }).sort({ createdAt: 1 }).lean(), []),
    orElse("rankings", () => RankingClaimService.list(userId), []),
    orElse("season plans", () => SeasonPlan.find({ userId }).select("entries.status").lean(), []),
    orElse(
      "sessions",
      () =>
        ExpertSession.countDocuments({
          userId,
          status: { $in: ["PAID", "SCHEDULED"] },
          scheduledAt: { $gte: now },
        }),
      0
    ),
  ]);
  if (!user) return null;

  const children: ChildContext[] = players.slice(0, MAX_CHILDREN).map((player) => {
    const sports = [
      ...new Set([player.chosenSport, ...(player.sportsFocus ?? [])].filter(Boolean) as string[]),
    ];
    // The list the child ranks highest in, for the sport that ranking is for.
    const claim = claims.find((c) => c.dependentId === String(player._id) && c.standings.length);
    const standing = claim?.standings[0];
    const age = ageOf(player, now);
    return {
      firstName: firstName(player.name, "your child"),
      ...(age !== undefined ? { age } : {}),
      sports,
      ...(player.yearsPlaying !== undefined ? { yearsPlaying: player.yearsPlaying } : {}),
      ...(player.experienceLevel ? { level: String(player.experienceLevel) } : {}),
      ...(player.ambition ? { ambition: String(player.ambition) } : {}),
      ...(player.location ? { state: player.location } : {}),
      ...(claim && standing
        ? {
            ranking: {
              sport: claim.sportSlug,
              list: `${standing.category} ${standing.subcategory}`,
              rank: standing.rank,
            },
          }
        : {}),
    };
  });

  return {
    parent: {
      firstName: firstName(user.name, "there"),
      ...(user.city ? { city: user.city } : {}),
    },
    children,
    moreChildren: Math.max(0, players.length - MAX_CHILDREN),
    plannedEvents: plans.reduce((sum, plan) => sum + (plan.entries?.length ?? 0), 0),
    upcomingSessions,
  };
}

/** The block placed in the system prompt, as short lines the model reads rather than JSON. */
export function formatParentContext(ctx: ParentContext): string {
  const lines = [
    `The parent is ${ctx.parent.firstName}${ctx.parent.city ? `, in ${ctx.parent.city}` : ""}.`,
  ];
  if (ctx.children.length === 0) {
    lines.push("No child has been added to this account yet.");
  }
  for (const child of ctx.children) {
    const facts = [
      child.age !== undefined ? `${child.age} years old` : null,
      child.sports.length ? `plays or is considering ${child.sports.join(", ")}` : null,
      child.yearsPlaying !== undefined ? `${child.yearsPlaying} years playing` : null,
      child.level ? `level: ${child.level}` : null,
      child.ambition ? `ambition: ${child.ambition}` : null,
      child.state ? `from ${child.state}` : null,
      child.ranking
        ? `ranked ${child.ranking.rank} in ${child.ranking.list} (${child.ranking.sport})`
        : null,
    ].filter(Boolean);
    lines.push(
      `- Child ${child.firstName}: ${facts.length ? facts.join("; ") : "no details yet"}.`
    );
  }
  if (ctx.moreChildren > 0) lines.push(`- ${ctx.moreChildren} more on the account.`);
  lines.push(
    `They have ${ctx.plannedEvents} tournament${ctx.plannedEvents === 1 ? "" : "s"} on a season plan and ${ctx.upcomingSessions} upcoming expert session${ctx.upcomingSessions === 1 ? "" : "s"}.`
  );
  return lines.join("\n");
}

// ─── Lookups the assistant makes on request ──────────────────────────────────

export const dateOnly = (value: Date | undefined): string | undefined =>
  value ? new Date(value).toISOString().slice(0, 10) : undefined;

export type ChildLookup<T> =
  { found: true; items: T[] } | { found: false; childrenOnAccount: string[] };

/**
 * Narrows to the child a parent named, by first name. A name that is not on the account
 * (or one carried over from an earlier message) returns who is, so the assistant can ask,
 * instead of reporting that nothing exists.
 */
export function pickChildren<T extends { name: string }>(
  players: T[],
  childName: string | undefined
): ChildLookup<T> {
  const wanted = childName?.trim().toLowerCase();
  const items = wanted
    ? players.filter((player) => player.name.toLowerCase().startsWith(wanted))
    : players;
  if (items.length === 0 && players.length > 0) {
    return { found: false, childrenOnAccount: players.map((p) => firstName(p.name, "a child")) };
  }
  return { found: true, items };
}

export interface ChildDetail {
  child: string;
  age?: number;
  committedSport?: string;
  sportsInFocus: string[];
  consideringSports: string[];
  /** The sports the assessment scored highest, best first. */
  assessmentMatches: Array<{ sport: string; fit: string }>;
  yearsPlaying?: number;
  level?: string;
  ambition?: string;
  weeklyHours?: string;
  trainingType?: string;
  state?: string;
}

/** What the parent told us about a child that helps answer "what suits him", first names only. */
export async function getChildrenDetail(
  userId: string,
  childName?: string,
  now: Date = new Date()
): Promise<ChildLookup<ChildDetail>> {
  const players = await Player.find({ userId }).sort({ createdAt: 1 }).lean();
  const picked = pickChildren(players, childName);
  if (!picked.found) return picked;
  return {
    found: true,
    items: picked.items.slice(0, MAX_CHILDREN).map((player) => {
      const age = ageOf(player, now);
      return {
        child: firstName(player.name, "your child"),
        ...(age !== undefined ? { age } : {}),
        ...(player.chosenSport ? { committedSport: player.chosenSport } : {}),
        sportsInFocus: player.sportsFocus ?? [],
        consideringSports: player.consideringSports ?? [],
        assessmentMatches: [...(player.sportMatches ?? [])]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((match) => ({ sport: match.sport, fit: match.fitLabel })),
        ...(player.yearsPlaying !== undefined ? { yearsPlaying: player.yearsPlaying } : {}),
        ...(player.experienceLevel ? { level: String(player.experienceLevel) } : {}),
        ...(player.ambition ? { ambition: String(player.ambition) } : {}),
        ...(player.weeklyHoursCategory ? { weeklyHours: String(player.weeklyHoursCategory) } : {}),
        ...(player.trainingType ? { trainingType: String(player.trainingType) } : {}),
        ...(player.location ? { state: player.location } : {}),
      };
    }),
  };
}

export interface SeasonPlanSummary {
  child: string;
  sport: string;
  goal?: string;
  /** Dates the parent said the child cannot play, such as exams. */
  datesBlocked: Array<{ from: string; to: string; label?: string }>;
  tournaments: Array<{
    name: string;
    starts: string;
    status: "shortlisted" | "entered" | "played";
    note?: string;
  }>;
}

/**
 * The season plans a parent built on the planner, soonest tournament first. The parent's own
 * cost figures and budget are left out: a cost question goes to the planner page, which shows
 * them with their assumptions.
 */
export async function getSeasonPlans(
  userId: string,
  filter: { childName?: string; sportSlug?: string } = {}
): Promise<ChildLookup<SeasonPlanSummary>> {
  const [players, plans] = await Promise.all([
    Player.find({ userId }).select("name").sort({ createdAt: 1 }).lean(),
    SeasonPlan.find({ userId, ...(filter.sportSlug ? { sportSlug: filter.sportSlug } : {}) })
      .select("dependentId sportSlug entries preferences")
      .lean(),
  ]);
  const picked = pickChildren(players, filter.childName);
  if (!picked.found) return picked;

  const wanted = new Set(picked.items.map((player) => String(player._id)));
  const nameOf = new Map(players.map((player) => [String(player._id), player.name]));
  const items: SeasonPlanSummary[] = plans
    .filter((plan) => wanted.has(String(plan.dependentId)))
    .map((plan) => ({
      child: firstName(nameOf.get(String(plan.dependentId)), "your child"),
      sport: plan.sportSlug,
      ...(plan.preferences?.goal ? { goal: plan.preferences.goal } : {}),
      datesBlocked: (plan.preferences?.blockedRanges ?? []).map((range) => ({
        from: dateOnly(range.from)!,
        to: dateOnly(range.to)!,
        ...(range.label ? { label: range.label } : {}),
      })),
      tournaments: [...(plan.entries ?? [])]
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .map((entry) => ({
          name: entry.name,
          starts: dateOnly(entry.startDate)!,
          status: entry.status,
          ...(entry.note ? { note: entry.note } : {}),
        })),
    }));
  return { found: true, items };
}

/**
 * Which of the parent's children an assistant action is for: the one they named, the only one
 * there is, or the question that settles it. `what` finishes the sentence "ask which one ... is
 * for", so each tool words it its own way ("the plan", "the event").
 */
export function chooseChild<T extends { name: string }>(
  players: T[],
  childName: unknown,
  what: string
): { child: T } | { reply: Record<string, unknown> } {
  if (players.length === 0) {
    return {
      reply: {
        ready: false,
        reason: "no_children",
        instruction: `No child is on this profile yet, so there is nobody to do this for. Say so, and offer to note the child and send a link to add them.`,
      },
    };
  }

  const name = typeof childName === "string" ? childName : undefined;
  if (name?.trim()) {
    const picked = pickChildren(players, name);
    if (!picked.found || picked.items.length === 0) {
      return {
        reply: {
          ready: false,
          reason: "child_not_on_account",
          childrenOnAccount: players.map((p) => firstName(p.name, "a child")),
          instruction: `No child with that name is on this profile. Say who is, by first name, and ask which one ${what} is for.`,
        },
      };
    }
    return { child: picked.items[0]! };
  }

  if (players.length > 1) {
    return {
      reply: {
        ready: false,
        reason: "which_child",
        children: players.map((p) => firstName(p.name, "a child")),
        instruction: `Ask which child ${what} is for, naming them. Then call this again with the name.`,
      },
    };
  }
  return { child: players[0]! };
}
