// ─── Derived graphs ─────────────────────────────────────────────────────────
//
// Only a few sports have a hand-authored, researched map. Every other sport
// still needs to render something graph-shaped, so we build one from the
// archetype skeleton the roadmap already has (3–4 macro stages) plus the two
// alternative outcomes that exist in essentially every Indian sport: the school
// circuit and a university sports quota.
//
// A derived graph is deliberately thinner than an authored one — generic gate
// labels, no anchor metric, no researched cost bands. The UI labels it as such
// so we never imply depth we don't have.

import {
  MacroLevel,
  getCombinedFeeRange,
  mergeAgeRanges,
} from "@/modules/sports/config/macroLevels";
import { Archetype } from "@/modules/sports/config/sportArchetypes";

import {
  GoalId,
  GraphEdge,
  GraphNode,
  IconKey,
  PathwayGraph,
  PathwayLane,
} from "./types";

/**
 * The advancement vocabulary per archetype. This is the one place a derived
 * map's edges get sport-appropriate wording instead of a generic "next level".
 */
const GATE_COPY: Record<
  Archetype,
  { gate: string; overreachLabel: string; overreachWarning: string }
> = {
  federation: {
    gate: "Selected at trials",
    overreachLabel: "Open trials — anyone can attend",
    overreachWarning:
      "Open trials exist in almost every federation sport, and they will accept your entry. What they won't do is evaluate a child with no record. Selectors shortlist from district and state age-group results, so a trial attended without that history is a lottery rather than a shortcut. The ladder is what makes the trial worth attending.",
  },
  ranking: {
    gate: "Earn ranking points",
    overreachLabel: "Open entry — no gate at all",
    overreachWarning:
      "Entry to the top of a ranking circuit is usually open to anyone who pays. That is not the same as belonging there. Ranking points come from winning matches, and a child entered years early loses in the first round for zero points while the travel and entry costs accumulate. In these sports the gate is competitive, not administrative — skipping the domestic circuit doesn't bypass it.",
  },
  rating: {
    gate: "Raise the rating",
    overreachLabel: "Open entry — rated immediately",
    overreachWarning:
      "Rated events are open to anyone registered, and this is the one shortcut that does lasting damage. A first rating is computed from those first results, so entering against far stronger opposition anchors the number near the floor — then costs years of wins to climb back to where an age-group start would have landed in months. The entry fee is trivial; the rating is permanent.",
  },
  standard: {
    gate: "Clear the qualifying mark",
    overreachLabel: "Blocked — the mark is the gate",
    overreachWarning:
      "This is the one archetype where the shortcut genuinely isn't available: you cannot enter a higher meet without having already posted the qualifying mark at an official one. That is a feature. The published standard tells you exactly what your child has to do, with no selector's opinion involved — so progress here is a training problem, not an access problem.",
  },
};

const STAGE_ICONS: IconKey[] = ["city", "state", "national", "world"];

/**
 * A derived map has no researched side tracks, so its lanes are the five
 * outcomes plus the ladder that leads to them. Every macro stage sits on the
 * ladder lane, which makes the generic structure read as exactly what it is — a
 * single line of progression with the outcomes branching off it.
 */
const LANE = {
  pro: 0,
  national: 1,
  ladder: 2,
  academic: 3,
  state: 4,
  school: 5,
} as const;

const LANES: PathwayLane[] = [
  { id: "pro", label: "Turning pro", tone: "pro" },
  { id: "national", label: "National route", tone: "national" },
  { id: "ladder", label: "The main ladder", tone: "ladder" },
  { id: "academic", label: "College route", tone: "college" },
  { id: "state", label: "State route", tone: "state" },
  { id: "school", label: "School & lifelong", tone: "thrive" },
];

export function deriveGraph(
  sportName: string,
  archetype: Archetype,
  macroLevels: MacroLevel[],
): PathwayGraph {
  const copy = GATE_COPY[archetype];
  const stages = macroLevels.slice(0, 4);
  const lastIdx = stages.length - 1;

  const nodes: GraphNode[] = [
    {
      id: "start",
      kind: "start",
      label: "Where you are today",
      sublabel: "Just getting started",
      lane: LANE.ladder,
      goals: ["pro", "national", "college", "state", "thrive"],
      icon: "start",
    },
    {
      id: "school",
      kind: "stage",
      label: "School & SGFI Circuit",
      sublabel: "Inter-school → national school meets",
      lane: LANE.school,
      goals: ["thrive", "state", "college"],
      icon: "school",
      costBand: "Low — largely school funded",
      funnelNote:
        "The cheapest competitive route in Indian sport, and the most overlooked.",
    },
  ];

  stages.forEach((macro, i) => {
    // Early and middle stages are on the way to a state outcome; the top two
    // are the only ones that genuinely lead to pro.
    const goals: GoalId[] = ["national", "college"];
    if (i >= lastIdx - 1) goals.push("pro");
    if (i <= 1) goals.push("state");
    if (i === 0) goals.push("thrive");

    nodes.push({
      id: macro.id,
      kind: "stage",
      label: macro.label,
      sublabel: macro.scopeTag,
      lane: LANE.ladder,
      rawLevel: macro.representativeRawLevel,
      goals,
      icon: STAGE_ICONS[Math.min(i, STAGE_ICONS.length - 1)],
      ageBand: mergeAgeRanges(macro.rawLevels.map((l) => l.ageRange)),
      costBand: getCombinedFeeRange(macro.rawLevelNumbers),
      durationNote: macro.durationNote,
      funnelNote: macro.funnelNote,
    });
  });

  nodes.push({
    id: "quota",
    kind: "milestone",
    label: "University Sports Quota",
    sublabel: "Seat via district or state record",
    lane: LANE.academic,
    goals: ["college", "state"],
    icon: "college",
    ageBand: "17–19 years",
    costBand: "Reduced or waived fees",
    funnelNote:
      "District or state representation is usually enough. Confirm each university's own rules.",
  });

  const GOAL_TERMINALS: {
    id: string;
    goalId: GoalId;
    label: string;
    lane: number;
    icon: IconKey;
  }[] = [
    { id: "goal-pro", goalId: "pro", label: "Turn Professional", lane: LANE.pro, icon: "crown" },
    { id: "goal-national", goalId: "national", label: "Represent India", lane: LANE.national, icon: "national" },
    { id: "goal-college", goalId: "college", label: "College on a Scholarship", lane: LANE.academic, icon: "college" },
    { id: "goal-state", goalId: "state", label: "State Colours", lane: LANE.state, icon: "state" },
    { id: "goal-thrive", goalId: "thrive", label: "A Lifelong Sport", lane: LANE.school, icon: "heart" },
  ];

  for (const t of GOAL_TERMINALS) {
    nodes.push({
      id: t.id,
      kind: "goal",
      label: t.label,
      lane: t.lane,
      goals: [t.goalId],
      goalId: t.goalId,
      icon: t.icon,
    });
  }

  // ── Edges ──
  const edges: GraphEdge[] = [
    {
      id: "e-start-first",
      from: "start",
      to: stages[0]?.id ?? "school",
      kind: "primary",
      label: "Find a coach",
      eligibility: "None",
      goals: ["pro", "national", "college", "state", "thrive"],
    },
    {
      id: "e-start-school",
      from: "start",
      to: "school",
      kind: "offramp",
      label: "Play for the school",
      goals: ["thrive", "state", "college"],
    },
    {
      id: "e-school-thrive",
      from: "school",
      to: "goal-thrive",
      kind: "offramp",
      label: "Keep playing for life",
      goals: ["thrive"],
    },
    {
      id: "e-school-quota",
      from: "school",
      to: "quota",
      kind: "offramp",
      label: "School record earns a seat",
      goals: ["college", "state"],
    },
    {
      id: "e-quota-college",
      from: "quota",
      to: "goal-college",
      kind: "primary",
      label: "Quota admission",
      goals: ["college"],
    },
  ];

  // Chain the stages, using the archetype's own advancement vocabulary.
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    const goals: GoalId[] = ["national", "college"];
    if (i + 1 >= lastIdx - 1) goals.push("pro");
    if (i === 0) goals.push("state");

    edges.push({
      id: `e-${from.id}-${to.id}`,
      from: from.id,
      to: to.id,
      kind: "primary",
      label: copy.gate,
      timeline: from.durationNote,
      goals,
    });
  }

  // Second stage is where a state outcome and a quota seat become real.
  const stateStage = stages[Math.min(1, lastIdx)];
  if (stateStage) {
    edges.push(
      {
        id: `e-${stateStage.id}-goalstate`,
        from: stateStage.id,
        to: "goal-state",
        kind: "primary",
        label: "State colours",
        goals: ["state"],
      },
      {
        id: `e-${stateStage.id}-quota`,
        from: stateStage.id,
        to: "quota",
        kind: "offramp",
        label: "State record earns a seat",
        goals: ["college", "state"],
      },
    );
  }

  const topStage = stages[lastIdx];
  const penultimate = stages[lastIdx - 1];
  if (penultimate) {
    edges.push({
      id: `e-${penultimate.id}-goalnational`,
      from: penultimate.id,
      to: "goal-national",
      kind: "primary",
      label: "National selection",
      goals: ["national"],
    });
  }
  if (topStage) {
    edges.push({
      id: `e-${topStage.id}-goalpro`,
      from: topStage.id,
      to: "goal-pro",
      kind: "primary",
      label: "Turn professional",
      goals: ["pro"],
    });
  }

  // The overreach edge. For the standard archetype it's still drawn, but its
  // copy explains that the qualifying mark genuinely blocks the jump — which is
  // the honest answer for athletics and swimming, and a useful contrast.
  if (stages.length > 2 && topStage) {
    edges.push({
      id: "e-overreach-pro",
      from: stages[0].id,
      to: topStage.id,
      kind: "overreach",
      label: copy.overreachLabel,
      warning: copy.overreachWarning,
      goals: ["pro"],
    });
  }

  return {
    sportName,
    archetype,
    startNodeId: "start",
    lanes: LANES,
    nodes,
    edges,
    goals: ["pro", "national", "college", "state", "thrive"],
    source: "derived",
  };
}
