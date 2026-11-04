/**
 * Would a child of a given rank have got in? Answered from what actually happened.
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 * `judgeEdition` says whether an event is OPEN to a child: nothing in the entry rules
 * bars them. It cannot say whether they would be ACCEPTED, because above Championship
 * Series a draw is cut by ranking and a place is earned. A rank-312 child shown a
 * National Series as "recommended" is told to plan and pay for something the draw will
 * very likely refuse. AITA publishes, for every event, the acceptance list: the main-draw
 * size, who got a direct place, who is only in the qualifying, each with their rank. That
 * is the evidence, and it is public.
 *
 * ── What this says, and what it will not ────────────────────────────────────
 * It describes PAST events of the same level, age group and gender, and says where the
 * main draw and the qualifying closed. "Rank 312 was outside the main draw in all three
 * of the last National Series" is a fact about those events. It is not a prediction for
 * this one, and the wording says so. With fewer than two past events there is nothing to
 * say, and it says that instead of guessing.
 *
 * Pure, and shared between the server and the page, like the rest of this folder. Numbers
 * only: no names, no dates of birth, nothing that identifies a player.
 */

/** One finished event for one age category, reduced to ranks and sizes. */
export interface AcceptanceSample {
  /** AITA's own id for the tournament. Only used to tell samples apart. */
  externalId: string;
  /** The day the event started, `YYYY-MM-DD`. Newest samples count most. */
  startDate: string;
  ladder: string;
  /** "U-12" to "U-18". */
  ageGroup: string;
  gender: "Boys" | "Girls";
  /** Places in the main draw, and how many of them go to direct acceptances. */
  mainDrawSize: number;
  mainDirectSlots: number;
  /** Ranks of the ranked players who got a direct main-draw place, best first. */
  mainRanks: number[];
  /** Players with no rank who got a direct main-draw place. */
  mainUnranked: number;
  qualifyingSize: number;
  qualifyingDirectSlots: number;
  qualifyingRanks: number[];
  qualifyingUnranked: number;
}

/**
 * - likely:      the main draw took this rank in most of the past events
 * - qualifying:  it would mostly have meant playing the qualifying
 * - unlikely:    outside both in most of the past events
 * - no-evidence: too few past events of this kind to say anything
 */
export type ReachKind = "likely" | "qualifying" | "unlikely" | "no-evidence";

export interface ReachVerdict {
  kind: ReachKind;
  /** How many past events the verdict rests on. */
  events: number;
  /** Of those, in how many this rank would have had a main-draw place, or a qualifying one. */
  mainDraw: number;
  qualifying: number;
  /** Where the main draw closed in each full event, best first. Empty when none was full. */
  mainCutoffs: number[];
  /** One sentence a parent can read, always present. */
  text: string;
}

/** The events looked at. Older ones describe a different season. */
export const REACH_LOOKBACK = 5;
/** Fewer than this and a verdict would be a guess. */
export const REACH_MIN_EVENTS = 2;
/** The share of past events a rank must have got in to be called likely. */
const MAJORITY = 0.6;

type Outcome = "main" | "qualifying" | "out";

/**
 * Where this rank would have landed in one past event. A draw that was not full took
 * everybody who entered, so nobody was turned away and nothing is "cut". A full draw is
 * cut at the worst rank it accepted, and an unranked player gets in only if the event
 * showed it admitting unranked players.
 */
function outcomeIn(sample: AcceptanceSample, rank: number | null): Outcome {
  const mainAccepted = sample.mainRanks.length + sample.mainUnranked;
  const mainFull = mainAccepted >= sample.mainDirectSlots;
  if (!mainFull) return "main";
  const mainCutoff = sample.mainRanks.length ? Math.max(...sample.mainRanks) : 0;
  if (rank === null ? sample.mainUnranked > 0 : rank <= mainCutoff) return "main";

  const qualifyingAccepted = sample.qualifyingRanks.length + sample.qualifyingUnranked;
  const qualifyingFull = qualifyingAccepted >= sample.qualifyingDirectSlots;
  if (!qualifyingFull) return "qualifying";
  const qualifyingCutoff = sample.qualifyingRanks.length ? Math.max(...sample.qualifyingRanks) : 0;
  if (rank === null ? sample.qualifyingUnranked > 0 : rank <= qualifyingCutoff) return "qualifying";
  return "out";
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
};

/**
 * `samples` must all be the same level, age group and gender as the event being judged:
 * the caller picks them. Only the newest {@link REACH_LOOKBACK} are read.
 */
export function judgeReach(
  samples: readonly AcceptanceSample[],
  rank: number | null,
  label: string
): ReachVerdict {
  const recent = [...samples]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, REACH_LOOKBACK);

  if (recent.length < REACH_MIN_EVENTS) {
    return {
      kind: "no-evidence",
      events: recent.length,
      mainDraw: 0,
      qualifying: 0,
      mainCutoffs: [],
      text:
        recent.length === 0
          ? `We hold no past ${label} events to say who gets in.`
          : `We hold only one past ${label} event, which is too few to say who gets in.`,
    };
  }

  const outcomes = recent.map((sample) => outcomeIn(sample, rank));
  const main = outcomes.filter((outcome) => outcome === "main").length;
  const qualifying = outcomes.filter((outcome) => outcome === "qualifying").length;
  const mainCutoffs = recent
    .filter((sample) => sample.mainRanks.length + sample.mainUnranked >= sample.mainDirectSlots)
    .map((sample) => Math.max(...sample.mainRanks, 0))
    .filter((cutoff) => cutoff > 0)
    .sort((a, b) => a - b);

  const events = recent.length;
  const kind: ReachKind =
    main / events >= MAJORITY
      ? "likely"
      : (main + qualifying) / events >= MAJORITY
        ? "qualifying"
        : "unlikely";

  const where =
    mainCutoffs.length === 0
      ? "Every player who entered got a place"
      : `The main draw closed around rank ${median(mainCutoffs)}`;
  const reading =
    kind === "likely"
      ? "This rank would have had a main-draw place in"
      : kind === "qualifying"
        ? "This rank would mostly have meant the qualifying in"
        : "This rank was outside both the main draw and the qualifying in most of";
  const count =
    kind === "likely"
      ? main
      : kind === "qualifying"
        ? main + qualifying
        : events - main - qualifying;

  return {
    kind,
    events,
    mainDraw: main,
    qualifying,
    mainCutoffs,
    text:
      `${where} in the last ${events} ${label} events. ${reading} ${count} of them. ` +
      `That describes past events, not this one.`,
  };
}

/** The label a reader sees for a kind of event: "Boys U-16 National Series". */
export const reachLabel = (ladder: string, gender: string, ageGroup: string): string =>
  `${gender} ${ageGroup} ${ladder}`;
