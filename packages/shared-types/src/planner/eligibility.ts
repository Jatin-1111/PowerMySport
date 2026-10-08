import { entryStatus, TALENT_SERIES_ZONE_RULE } from "./aitaRules";

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
 * ── Kept pure on purpose, and shared on purpose ─────────────────────────────
 * No React, no fetch, no dates beyond what is passed in. It lives in
 * `shared-types` because the website and the server must give the same answer:
 * the planner page shows the verdicts and the assistant chat quotes them, and
 * two copies of a rule set is how a parent gets told "open" in one place and
 * "closed" in the other. `aitaRules`, its one import, moved with it.
 *
 * ── What it deliberately does not claim ─────────────────────────────────────
 * "Open" here means *not barred by the rules we hold*. AITA publishes bars, not
 * guarantees: above Championship Series a draw is cut by ranking and a place is
 * earned rather than granted, so nothing below promises entry. The wording is
 * "open to enter", never "you will get in".
 */

/**
 * What AITA's own pages say about an event, where we have read them. Every date is
 * a calendar day `YYYY-MM-DD`, with the printed IST time kept apart in `times`.
 * Any field can be absent: a page may not print it, and absent means "not stated".
 */
export interface PlannerOfficialDetails {
  /**
   * Where the deadlines and fees came from. "factSheet" is the event's own page.
   * "rules" is AITA's published rules applied to its level and dates because the
   * page could not be read, so it states the rule and not the event.
   */
  source: "factSheet" | "rules";
  entryOpens?: string;
  entryCloses?: string;
  withdrawalDeadline?: string;
  freezeDeadline?: string;
  times?: { entryCloses?: string; withdrawal?: string; freeze?: string };
  /** Rupees. Singles per player, doubles per pair. */
  feeSingles?: number;
  feeDoubles?: number;
  /** Paid by the tournament to main-draw players, per day. */
  dailyAllowance?: number;
  surface?: string;
  qualifyingStart?: string;
  mainDrawStart?: string;
  /** AITA's own page for the event, where a parent enters. */
  pageUrl?: string;
  /** When we last confirmed the event against AITA's calendar (ISO timestamp). */
  checkedAt?: string;
}

/** The shape the editions endpoint returns, narrowed to what matters here. */
export interface PlannerEdition {
  slug?: string;
  name: string;
  startDate: string;
  endDate?: string;
  city?: string | null;
  state?: string | null;
  venue?: string | null;
  /** Absent on most rows: the calendar does not publish one. Never guessed. */
  registrationDeadlineDate?: string | null;
  ageGroups?: string[];
  /** From editionSeries.ts. Absent on editions ingested before it existed. */
  ladder?: string | null;
  grade?: number | null;
  kind?: string | null;
  /** From AITA's own pages. Absent on events we have not read them for. */
  official?: PlannerOfficialDetails;
}

export interface PlannerPlayer {
  /** The age group they play in, e.g. "U-14". */
  bracket: string;
  /**
   * Their rank in that age group's own list. Null when they are not ranked there,
   * which is true of a child who has only played up so far: no rank means no
   * ranking-based bar, because nothing about their standing can bar them.
   */
  rank: number | null;
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
  const status = player.rank === null ? null : entryStatus(player.rank, player.bracket);
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
      ? `${edition.ladder} is open to enter${player.rank === null ? "" : " at this rank"}.`
      : `Open to enter${player.rank === null ? "" : " at this rank"}.`,
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

/**
 * Where a child belongs: the age group they play in, and the lists they are ranked in.
 *
 * ── Age group comes from the birth year, not from the lists ─────────────────
 * AITA's age groups are two-year cohorts of the birth year (in 2026: U-12 is 2014
 * and later, U-14 is 2012-13, U-16 is 2010-11, U-18 is 2008-09), and a child may play
 * up, so being ranked in a list says what they have entered, not how old they are.
 * Measured on the 2026-09-21 lists, "the youngest list they appear in" gave the right
 * age group for 5,624 of 5,678 players. The 47 it got wrong were children who had
 * played up and had no rank in their own list yet: a 2014-born child ranked only in
 * U-14 and U-16 was judged as a U-14, and every U-12 event was "closed, below U-14".
 *
 * So the age group is read from the birth year, and the lists then say what rank they
 * hold there. The youngest list is only the fallback, for a player whose birth year
 * the list does not print.
 *
 * ── Several lists are the normal case ───────────────────────────────────────
 * 3,143 of those 5,678 players are in two or more lists. A child ranked in U-16 and
 * U-18 is a U-16 who plays up: their age group is U-16, their rank for the rules is
 * their U-16 rank, and their U-18 rank is kept as `alsoRanked` so it can be shown.
 *
 * Only junior lists count: an open-age list carries none of these rules.
 *
 * Generic over the standing so the client's and the server's shapes both fit, and
 * returns the caller's own objects rather than copies.
 */
export interface AgeGroupPlacement<T> {
  /** The age group they play in, e.g. "U-16". */
  ageGroup: string;
  /** Their standing in that group's own list. Null if they are not ranked there. */
  own: T | null;
  /** Every other junior list they are ranked in, youngest first. */
  alsoRanked: T[];
  /** What the age group was read from. */
  basis: "birth-year" | "youngest-list";
}

const JUNIOR_AGE_GROUPS = [12, 14, 16, 18] as const;

const listAge = (standing: { subcategory: string }): number =>
  Number(/\d+/.exec(standing.subcategory)?.[0] ?? 99);

/** The age group a birth year falls in for a list year, or null if it falls in none. */
function cohortOf(birthYear: number, year: number): number | null {
  if (!Number.isInteger(birthYear) || birthYear > year) return null;
  return JUNIOR_AGE_GROUPS.find((age) => birthYear >= year - age) ?? null;
}

export function placeInAgeGroup<
  T extends { subcategory: string; birthYear?: number | null; asOnDate?: string | Date },
>(standings: readonly T[]): AgeGroupPlacement<T> | null {
  const junior = standings
    .filter((standing) => /^U-\d+$/i.test(standing.subcategory))
    .sort((a, b) => listAge(a) - listAge(b));
  if (junior.length === 0) return null;

  // The year the lists are for, which is what the age cohorts are counted from.
  const listed = junior
    .map((standing) => (standing.asOnDate ? new Date(standing.asOnDate).getUTCFullYear() : NaN))
    .filter((year) => Number.isFinite(year));
  const year = listed.length > 0 ? Math.max(...listed) : new Date().getUTCFullYear();

  const birthYear = junior.find((standing) => typeof standing.birthYear === "number")?.birthYear;
  const cohort = typeof birthYear === "number" ? cohortOf(birthYear, year) : null;

  if (cohort === null) {
    const [youngest, ...rest] = junior;
    return {
      ageGroup: `U-${listAge(youngest!)}`,
      own: youngest!,
      alsoRanked: rest,
      basis: "youngest-list",
    };
  }

  const own = junior.find((standing) => listAge(standing) === cohort) ?? null;
  return {
    ageGroup: `U-${cohort}`,
    own,
    alsoRanked: junior.filter((standing) => standing !== own),
    basis: "birth-year",
  };
}
