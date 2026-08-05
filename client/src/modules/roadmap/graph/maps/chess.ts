// ─── Chess — rating archetype ───────────────────────────────────────────────
//
// Written for the same reader as the tennis map: an Indian parent working out
// whether this is worth starting, with nobody beside them to explain it.
//
// FOUR DESTINATIONS. Play for India, earn a living from the game, get a funded
// university place, or build a career in it. There is deliberately no state
// terminal: unlike cricket, where a Ranji cap is recognised for life, a state
// chess place is a step on the way to a national nomination rather than an
// outcome anybody frames as an ambition. It's on the map as a rung, not a prize.
//
// THE SHORTCUT TRAP IS THE WORST IN INDIAN SPORT, and it is the reason this map
// exists. Chess has no selection trials, so nothing structural stops a parent
// entering a FIDE-rated open in week one. But a player's FIRST rating is computed
// from those first rated results. Enter too early against strong opposition and
// the child is anchored at a low initial rating that then takes years of wins to
// climb out of. The damage isn't a wasted entry fee — it's a public number that
// follows them. That is why the age-group ladder and the open rated circuit are
// separate tracks on this map: the order you meet them in is the whole game.
//
// FUNDING. Chess IS a Khelo India sport, so scheme money is available from the
// national age-group level. TOPS is not — it is Olympic-podium focused and chess
// is not an Olympic sport — so it is deliberately absent here. The other side of
// the ledger is unusually strong: PSUs and banks employ chess players outright.
//
// Cost bands are indicative annual all-in figures and are surfaced as estimates.

import { PathwayGraph } from "../types";

/**
 * Five tracks, with the age-group ladder down the middle: to its LEFT is chess
 * as a living, to its RIGHT is a life built around the game. The open rated
 * circuit sits beside the ladder rather than on it, because meeting them in the
 * wrong order is the single most expensive mistake in this sport.
 */
const LANE = {
  title: 0,
  rated: 1,
  ladder: 2,
  academic: 3,
  career: 4,
} as const;

export const CHESS_GRAPH: PathwayGraph = {
  sportName: "Chess",
  archetype: "rating",
  startNodeId: "start",
  source: "authored",
  orientation: "vertical",
  goals: ["pro", "national", "college", "job"],
  anchorMetric: {
    label: "Rating",
    hint: "An AICF or FIDE rating is the whole pathway in chess — there are no trials to pass. It also means the number is public and permanent, so the events you choose early genuinely matter.",
  },

  lanes: [
    { id: "title", label: "Title track", tone: "pro" },
    { id: "rated", label: "Open rated circuit", tone: "national" },
    { id: "ladder", label: "Age-group ladder", tone: "ladder" },
    { id: "academic", label: "School & college", tone: "college" },
    { id: "career", label: "Career in chess", tone: "job" },
  ],

  nodes: [
    {
      id: "start",
      kind: "start",
      label: "Where you are today",
      sublabel: "Knows how the pieces move",
      lane: LANE.ladder,
      goals: ["pro", "national", "college", "job"],
      icon: "start",
    },
    {
      id: "learn",
      kind: "stage",
      label: "Coaching & Club Play",
      sublabel: "Openings, tactics, unrated games",
      lane: LANE.ladder,
      rawLevel: 1,
      goals: ["pro", "national", "college", "job"],
      icon: "coach",
      ageBand: "5–10 years",
      anchorBand: "Unrated",
      costBand: "₹25k–80k / year",
      durationNote: "1–2 years",
      funnelNote:
        "The cheapest competitive pathway in Indian sport — almost no equipment cost, and a strong online club is genuinely a substitute for a local one. Stay unrated on purpose while the basics land.",
    },
    {
      id: "school",
      kind: "stage",
      label: "School & SGFI Chess",
      sublabel: "Inter-school → national school meets",
      lane: LANE.academic,
      rawLevel: 1,
      goals: ["college", "job"],
      icon: "school",
      ageBand: "7–17 years",
      costBand: "Near zero — school funded",
      funnelNote:
        "Real tournament experience with no rating consequences at all, which makes it the right place to learn to lose. Also the cheapest way to find out whether your child actually enjoys competing.",
    },
    {
      id: "district",
      kind: "stage",
      label: "District & State Age-Group",
      sublabel: "U-7 to U-19, age-banded fields",
      lane: LANE.ladder,
      rawLevel: 2,
      goals: ["pro", "national", "college", "job"],
      icon: "city",
      ageBand: "7–13 years",
      anchorBand: "First AICF rating",
      costBand: "₹60k–1.5L / year",
      durationNote: "1–2 years",
      funnelNote:
        "The correct place for a first rating. The fields are age-banded, so the number your child is given reflects children their own age — which is the difference between a rating that helps and one they spend three years undoing.",
    },
    {
      id: "state-rated",
      kind: "stage",
      label: "AICF Rated Open Circuit",
      sublabel: "Open events, rating climbing",
      lane: LANE.rated,
      rawLevel: 2,
      goals: ["pro", "national", "college", "job"],
      icon: "rating",
      ageBand: "9–16 years",
      anchorBand: "AICF 1200–1600",
      costBand: "₹1L–2L / year",
      durationNote: "1–2 years",
      funnelNote:
        "Open means all ages, so a twelve-year-old can be drawn against a rated adult. That is the point of it once the rating is established — and the danger of it before.",
    },
    {
      id: "nationals",
      kind: "stage",
      label: "National Age-Group Championship",
      sublabel: "State nomination required",
      lane: LANE.ladder,
      rawLevel: 3,
      goals: ["pro", "national", "college", "job"],
      icon: "national",
      ageBand: "10–17 years",
      anchorBand: "FIDE 1600–1900",
      costBand: "₹2L–4L / year",
      fundingNote:
        "Chess is a Khelo India sport, and selection into the Athlete Scheme typically happens around here — reported at roughly ₹6 lakh a year covering coaching, travel, diet and education. Several state associations add their own grant on top.",
      durationNote: "2–3 years",
      funnelNote:
        "Qualifying is by state nomination, so the state circuit is not optional however good the rating is. Reaching this rung is already enough for a university seat or a coaching career.",
    },
    {
      id: "fide",
      kind: "stage",
      label: "FIDE Rated Internationals",
      sublabel: "Open internationals, Asian youth",
      lane: LANE.rated,
      rawLevel: 4,
      goals: ["pro", "national", "college", "job"],
      icon: "world",
      ageBand: "13–18 years",
      anchorBand: "FIDE 1900–2200",
      costBand: "₹4L–10L / year",
      fundingNote:
        "Travel is the whole cost at this level. Asian and Commonwealth youth events are the cheap way to collect international rated games; sponsorship becomes realistic once there is a national ranking to show.",
      durationNote: "2–3 years",
      funnelNote:
        "Rating gains slow sharply above 2000 — the same effort that added 200 points a year now adds 30. Plan the season around a handful of strong events rather than many weak ones.",
    },
    {
      id: "norms",
      kind: "milestone",
      label: "IM / GM Norm Events",
      sublabel: "Title norms and the climb to 2500",
      lane: LANE.title,
      rawLevel: 5,
      goals: ["pro", "job"],
      icon: "crown",
      ageBand: "16+ years",
      anchorBand: "FIDE 2200+",
      costBand: "₹10L–20L / year",
      fundingNote:
        "Norm events are chosen and paid for, not qualified into — round-robins with the right mix of titled opponents. AICF support and private patrons carry most Indian players through these years.",
      durationNote: "3–6 years",
      funnelNote:
        "India has produced under 90 Grandmasters in its history. This rung is genuinely tiny, and reaching an IM title is already a career in itself.",
    },
    {
      id: "ncaa",
      kind: "milestone",
      label: "US College Chess Scholarship",
      sublabel: "A funded degree on a chess team",
      lane: LANE.academic,
      goals: ["college", "job"],
      icon: "college",
      ageBand: "18–22 years",
      anchorBand: "FIDE 2000+",
      costBand: "Often fully funded",
      fundingNote:
        "Here the scholarship IS the funding. A handful of US universities fund chess teams outright and recruit internationally on rating alone — an award can cover fees and living costs together.",
      durationNote: "4 years",
      funnelNote:
        "Enormously under-applied by Indian players, who tend not to know it exists. A FIDE 2000+ rating with decent school grades is a competitive application.",
    },
    {
      id: "quota",
      kind: "milestone",
      label: "Indian University Sports Quota",
      sublabel: "A seat on a state or national record",
      lane: LANE.academic,
      rawLevel: 3,
      goals: ["college", "job"],
      icon: "college",
      ageBand: "17–19 years",
      costBand: "Reduced or waived fees",
      fundingNote:
        "Quota seats usually carry fee concessions, a hostel place and a flexible academic schedule for tournament weeks. Rules differ by university — check each one directly.",
      funnelNote:
        "State representation is usually sufficient; you do not need to have played internationally. Confirm each university's own quota rules before you apply.",
    },
    {
      id: "coaching",
      kind: "milestone",
      label: "Coaching & Arbiting",
      sublabel: "AICF / FIDE badges · PSU sports jobs",
      lane: LANE.career,
      goals: ["job"],
      icon: "briefcase",
      ageBand: "18+ years",
      costBand: "Course fees, then salaried",
      fundingNote:
        "The strongest job market of any sport on this platform. Railways, banks, ONGC and LIC recruit rated players on sports quota, and online coaching pays in dollars from a bedroom in any Indian city.",
      durationNote: "Lifelong",
      funnelNote:
        "Coaching runs club → academy → national → team second. Arbiting runs state → national → FIDE arbiter → international. Neither needs a title, and both start paying while you are still playing.",
    },

    // ── Goal terminals, each in the lane of the track that feeds it ──
    {
      id: "goal-pro",
      kind: "goal",
      label: "Professional Chess",
      lane: LANE.title,
      goals: ["pro"],
      goalId: "pro",
      icon: "crown",
    },
    {
      id: "goal-national",
      kind: "goal",
      label: "Represent India",
      lane: LANE.rated,
      goals: ["national"],
      goalId: "national",
      icon: "national",
    },
    {
      id: "goal-college",
      kind: "goal",
      label: "College on a Scholarship",
      lane: LANE.academic,
      goals: ["college"],
      goalId: "college",
      icon: "college",
    },
    {
      id: "goal-job",
      kind: "goal",
      label: "A Job in Chess",
      lane: LANE.career,
      goals: ["job"],
      goalId: "job",
      icon: "briefcase",
    },
  ],

  edges: [
    {
      id: "e-start-learn",
      from: "start",
      to: "learn",
      kind: "primary",
      label: "Find a coach or club",
      eligibility: "None — just turn up",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-start-school",
      from: "start",
      to: "school",
      kind: "offramp",
      label: "Play for the school",
      eligibility: "School enrolment",
      goals: ["college", "job"],
    },
    {
      id: "e-learn-district",
      from: "learn",
      to: "district",
      kind: "primary",
      label: "Enter age-group events first",
      eligibility: "AICF registration and age proof",
      readiness:
        "Can finish a game on the clock without giving away pieces. Order matters more than timing here.",
      timeline: "After about a year of coaching",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-school-district",
      from: "school",
      to: "district",
      kind: "offramp",
      label: "School results, then a rating",
      readiness: "A zonal or state school medal",
      goals: ["college", "job"],
    },
    {
      id: "e-district-staterated",
      from: "district",
      to: "state-rated",
      kind: "primary",
      label: "Step up to open rated events",
      eligibility: "AICF membership",
      readiness:
        "An established age-group rating first. This is the order that protects the number.",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-district-nationals",
      from: "district",
      to: "nationals",
      kind: "primary",
      label: "Win a state nomination",
      eligibility: "Nomination from your state association",
      readiness: "A state age-group podium",
      timeline: "1–2 years",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-staterated-nationals",
      from: "state-rated",
      to: "nationals",
      kind: "primary",
      label: "Rating opens the state squad",
      readiness: "AICF 1400+",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-staterated-quota",
      from: "state-rated",
      to: "quota",
      kind: "offramp",
      label: "A rating earns a seat",
      goals: ["college", "job"],
    },
    {
      id: "e-nationals-fide",
      from: "nationals",
      to: "fide",
      kind: "primary",
      label: "National results → internationals",
      readiness: "FIDE 1700+ and a national top-20 finish",
      timeline: "2–3 years",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-nationals-coaching",
      from: "nationals",
      to: "coaching",
      kind: "offramp",
      label: "Turn the rating into income",
      eligibility: "A rating, then a coaching or arbiter certification",
      goals: ["job"],
    },
    {
      id: "e-district-fide",
      from: "district",
      to: "fide",
      kind: "bypass",
      label: "Fast track — skip nationals",
      readiness: "Prodigy-level results only",
      unlocks: [
        "FIDE 1900+ before age 12",
        "A national age-group medal",
        "Two rated tournament wins against 2000+ opposition",
      ],
      timeline: "Saves roughly 2 years",
      goals: ["pro"],
    },
    {
      id: "e-fide-norms",
      from: "fide",
      to: "norms",
      kind: "primary",
      label: "Cross FIDE 2200",
      readiness: "FIDE 2200 and stable results against titled players",
      timeline: "3–6 years",
      goals: ["pro"],
    },
    {
      id: "e-fide-goalnational",
      from: "fide",
      to: "goal-national",
      kind: "primary",
      label: "The India youth squad",
      readiness: "Selection for a World or Asian youth championship",
      goals: ["national"],
    },
    {
      id: "e-fide-ncaa",
      from: "fide",
      to: "ncaa",
      kind: "offramp",
      label: "Rating → a US scholarship",
      eligibility: "NCAA academic eligibility + SAT/TOEFL",
      readiness: "FIDE 2000+ is competitive for funding",
      goals: ["college", "job"],
    },
    {
      id: "e-ncaa-goalcollege",
      from: "ncaa",
      to: "goal-college",
      kind: "primary",
      label: "A degree and a scholarship",
      goals: ["college"],
    },
    {
      id: "e-ncaa-coaching",
      from: "ncaa",
      to: "coaching",
      kind: "offramp",
      label: "A degree plus a rating",
      goals: ["job"],
    },
    {
      id: "e-quota-goalcollege",
      from: "quota",
      to: "goal-college",
      kind: "primary",
      label: "Quota admission",
      goals: ["college"],
    },
    {
      id: "e-norms-goalpro",
      from: "norms",
      to: "goal-pro",
      kind: "primary",
      label: "Earn the GM title",
      readiness: "Three GM norms and FIDE 2500",
      goals: ["pro"],
    },
    {
      id: "e-norms-coaching",
      from: "norms",
      to: "coaching",
      kind: "offramp",
      label: "Titled players coach and second",
      goals: ["job"],
    },
    {
      id: "e-coaching-goaljob",
      from: "coaching",
      to: "goal-job",
      kind: "primary",
      label: "A salaried life in chess",
      goals: ["job"],
    },

    // ── The edge this map exists for ──
    {
      id: "e-overreach-pro",
      from: "learn",
      to: "fide",
      kind: "overreach",
      label: "Open entry — rated from day one",
      eligibility: "AICF membership and the entry fee. Nothing else.",
      readiness:
        "Those fields are full of 1900–2200 players. An uncoached beginner is effectively unrated.",
      warning:
        "Nobody will stop you entering a FIDE-rated open immediately — and this is the one shortcut in Indian sport that does lasting damage. Your child's FIRST published rating is calculated from these games. Enter against 2000-rated opposition before they are ready and they get anchored near the floor, then spend two or three years grinding back to where an age-group start would have placed them in six months. The entry fee is trivial. The rating is permanent.",
      goals: ["pro"],
    },
  ],
};
