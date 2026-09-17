import { entryStatus, TALENT_SERIES_ZONE_RULE } from "@/modules/rankings/utils/aitaRules";

/**
 * Which of the upcoming tournaments a ranked child can actually enter.
 *
 * ── Why this is worth computing rather than listing ─────────────────────────
 * The tournament calendar already exists as a list. What it cannot tell a
 * parent is the only thing they want to know: of these, which ones is my child
 * allowed to enter? Answering it needs three facts that live in three different
 * places — the child's age bracket, their rank, and which rung of the circuit
 * the event sits on — and the last of those did not exist as data until the
 * name parser landed.
 *
 * ── Kept pure on purpose ────────────────────────────────────────────────────
 * No React, no fetch, no dates beyond what is passed in. The server will need
 * this same logic when the digest starts naming next week's entries, and a pure
 * module moves to `packages/` mechanically. Its one import, `aitaRules`, is
 * equally pure and would move with it.
 *
 * ── What it deliberately does not claim ─────────────────────────────────────
 * "Open" here means *not barred by the rules we hold*. AITA publishes bars, not
 * guarantees: above Championship Series a draw is cut by ranking and a place is
 * earned rather than granted, so nothing below promises entry. The wording is
 * "open to enter", never "you will get in".
 */

/** The shape the editions endpoint returns, narrowed to what matters here. */
export interface PlannerEdition {
  slug?: string;
  name: string;
  startDate: string;
  endDate?: string;
  city?: string | null;
  state?: string | null;
  ageGroups?: string[];
  /** From editionSeries.ts. Absent on editions ingested before it existed. */
  ladder?: string | null;
  grade?: number | null;
  kind?: string | null;
}

export interface PlannerPlayer {
  /** The list they are ranked in, e.g. "U-14". */
  bracket: string;
  rank: number;
}

export type EligibilityStatus = "open" | "closed" | "unknown";

export interface PlannerEntry {
  edition: PlannerEdition;
  status: EligibilityStatus;
  /** One line a parent can act on. Always present. */
  reason: string;
  /** True when the event's age group is older than the child's own. */
  playingUp: boolean;
  /** Caveats that do not bar entry but change what a parent should check. */
  notes: string[];
}

/**
 * Circuits a junior plan may draw from.
 *
 * The exclusions matter more than the inclusions: 14% of the tennis calendar is
 * the senior prize-money circuit, carrying age groups of Men and Women. Those
 * are not "closed" to a twelve-year-old in any interesting sense — they are a
 * different sport's worth of event, and listing them as blocked would be noise.
 * They are filtered out before any rule runs.
 */
const JUNIOR_KINDS = new Set(["junior-ladder", "international-junior"]);

/** "U-14" and "Under-14" are the same bracket written two ways. */
const bracketAge = (value: string): number | null => {
  const match = /(\d{1,2})/.exec(value ?? "");
  return match ? Number(match[1]) : null;
};

const formatAge = (age: number): string => `Under-${age}`;

/**
 * An edition is enterable by age when one of its groups is at or above the
 * child's own bracket.
 *
 * Playing up is allowed and common; playing down is not. A U-14 cannot enter an
 * Under-12 event, and offering it would be the kind of mistake a parent only
 * discovers at the entry desk.
 */
const ageVerdict = (
  edition: PlannerEdition,
  playerAge: number
): { ok: boolean; playingUp: boolean; groups: number[] } => {
  const groups = (edition.ageGroups ?? [])
    .map(bracketAge)
    .filter((age): age is number => age !== null);
  if (groups.length === 0) return { ok: false, playingUp: false, groups: [] };

  const usable = groups.filter((age) => age >= playerAge);
  return {
    ok: usable.length > 0,
    playingUp: usable.length > 0 && Math.min(...usable) > playerAge,
    groups,
  };
};

/**
 * Judge one edition for one player.
 *
 * Returns `unknown` rather than guessing whenever the data cannot answer:
 * an edition with no age groups recorded, or one whose series the parser could
 * not read. A parent told "we do not know, check the fact sheet" can act on it;
 * one told "open" on a guess cannot.
 */
export function judgeEdition(edition: PlannerEdition, player: PlannerPlayer): PlannerEntry | null {
  if (!JUNIOR_KINDS.has(edition.kind ?? "")) {
    // Includes `unknown`: an event we cannot classify is not offered as a
    // junior fixture, because the failure mode of being wrong is an adult
    // prize-money event in a child's plan.
    return null;
  }

  const playerAge = bracketAge(player.bracket);
  if (playerAge === null) return null;

  const age = ageVerdict(edition, playerAge);
  const notes: string[] = [];

  if (age.groups.length === 0) {
    return {
      edition,
      status: "unknown",
      reason: "No age group is published for this event. Check the fact sheet before entering.",
      playingUp: false,
      notes,
    };
  }

  if (!age.ok) {
    const youngest = Math.max(...age.groups);
    return {
      edition,
      status: "closed",
      reason: `This is an ${formatAge(youngest)} event, below ${formatAge(playerAge)}.`,
      playingUp: false,
      notes,
    };
  }

  // The reverse gate: doing well closes the entry level. Read from the same
  // function the ranking page uses, so the two can never disagree about it.
  const status = entryStatus(player.rank, player.bracket);
  if (edition.ladder && status?.closed.includes(edition.ladder)) {
    return {
      edition,
      status: "closed",
      reason: `${edition.ladder} is closed at rank ${player.rank} in ${formatAge(playerAge)}.`,
      playingUp: age.playingUp,
      notes,
    };
  }

  if (edition.ladder === "Talent Series") {
    // Not a bar we can evaluate: it depends on the zone the player is
    // registered in, which the edition data does not carry. Surfaced as a
    // caveat rather than silently ignored, because it is a gate parents hit.
    notes.push(TALENT_SERIES_ZONE_RULE);
  }
  if (age.playingUp) {
    notes.push(
      "Playing up an age group. Entries there draw from the same annual allowance, not a separate one."
    );
  }

  return {
    edition,
    status: "open",
    reason: edition.ladder
      ? `${edition.ladder} is open to enter at this rank.`
      : "Open to enter at this rank.",
    playingUp: age.playingUp,
    notes,
  };
}

/**
 * The upcoming fixtures for one player, soonest first, in four buckets.
 *
 * ── Why playing up is separated rather than merged ──────────────────────────
 * Measured against the real calendar on 2026-09-18: a U-12 player has 39
 * enterable events, and sorting them by date alone put three Under-14 and
 * Under-16 fixtures at the top, because older age groups simply hold more
 * events. A parent opening the card saw a list of tournaments for other
 * people's children. Their own age group is the answer to the question they
 * asked; playing up is a separate decision with its own consequences, one of
 * which is that it spends the same annual entry allowance.
 *
 * ── Why closed events are kept ──────────────────────────────────────────────
 * The reverse gate is the least intuitive rule on the circuit — a rank good
 * enough to celebrate is the rank that bars the events they have been winning —
 * and a parent who sees only a shorter list learns nothing about why it got
 * shorter.
 */
export interface Shortlist {
  /** Open, and in the player's own age group. The primary answer. */
  ownGroup: PlannerEntry[];
  /** Open, but in an older age group. A choice, not a default. */
  playingUp: PlannerEntry[];
  closed: PlannerEntry[];
  unknown: PlannerEntry[];
}

export function buildShortlist(editions: PlannerEdition[], player: PlannerPlayer): Shortlist {
  const judged = editions
    .map((edition) => judgeEdition(edition, player))
    .filter((entry): entry is PlannerEntry => entry !== null)
    .sort(
      (a, b) => new Date(a.edition.startDate).getTime() - new Date(b.edition.startDate).getTime()
    );

  const open = judged.filter((entry) => entry.status === "open");
  return {
    ownGroup: open.filter((entry) => !entry.playingUp),
    playingUp: open.filter((entry) => entry.playingUp),
    closed: judged.filter((entry) => entry.status === "closed"),
    unknown: judged.filter((entry) => entry.status === "unknown"),
  };
}
