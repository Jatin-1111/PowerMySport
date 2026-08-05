// ─── Cricket — federation archetype ─────────────────────────────────────────
//
// Written for the same reader as the tennis map: an Indian parent working out
// whether this is worth starting, with nobody beside them to explain it.
//
// FIVE DESTINATIONS. Cricket is the one sport on the platform that keeps a state
// terminal, and it keeps it because a state cap is real here in a way it is not in
// tennis or chess — a Ranji player has arrived somewhere the whole country
// recognises, whether or not they ever play for India. The other four are the
// questions every family actually asks: play for India, make a living from it,
// get a funded university seat, or get a JOB out of it. That last one is not a
// consolation prize in cricket. Railways, the banks and the armed forces employ
// cricketers on salary, and it is the most common good outcome in the sport.
//
// THE SHORTCUT TRAP. Cricket's ladder is selection-gated, so in theory it can't
// be skipped. In practice the bypass is public and advertised: open franchise and
// academy trials, which anyone can pay to attend. What that misses is what a
// selector is actually doing at a trial — looking for a name they can
// cross-reference against an age-group record. A child with no district or state
// history is an unknown quantity being watched for ten minutes among hundreds.
// The trial isn't a shortcut past the ladder; the ladder is what makes a trial
// worth attending.
//
// FUNDING IS DIFFERENT HERE. Cricket sits outside the sports-ministry schemes —
// BCCI is autonomous and cricket is not an Olympic sport — so there is no Khelo
// India or TOPS money in this pathway. What there is instead is association
// funding from state level upwards, and match fees once you reach first-class.
//
// Cost bands are indicative annual all-in figures and are surfaced as estimates.

import { PathwayGraph } from "../types";

/**
 * Five tracks, with the selection ladder down the middle: everything to its LEFT
 * is playing cricket for a living, everything to its RIGHT is a life built
 * around the game.
 */
const LANE = {
  pro: 0,
  senior: 1,
  selection: 2,
  academic: 3,
  career: 4,
} as const;

export const CRICKET_GRAPH: PathwayGraph = {
  sportName: "Cricket",
  archetype: "federation",
  startNodeId: "start",
  source: "authored",
  orientation: "vertical",
  goals: ["pro", "national", "college", "job", "state"],
  anchorMetric: {
    label: "Age-group selection",
    hint: "Cricket has no public rating. Your child's record IS their age-group selection history — district, then state, then zonal. That paper trail is what every selector checks first.",
  },

  lanes: [
    { id: "pro", label: "Professional", tone: "pro" },
    { id: "senior", label: "Senior state", tone: "national" },
    { id: "selection", label: "Selection ladder", tone: "ladder" },
    { id: "academic", label: "School, club & college", tone: "college" },
    { id: "career", label: "Career in cricket", tone: "job" },
  ],

  nodes: [
    {
      id: "start",
      kind: "start",
      label: "Where you are today",
      sublabel: "Gully cricket and a bat",
      lane: LANE.selection,
      goals: ["pro", "national", "college", "job", "state"],
      icon: "start",
    },
    {
      id: "academy",
      kind: "stage",
      label: "Club & Academy Coaching",
      sublabel: "Technique, nets, age-group club games",
      lane: LANE.selection,
      rawLevel: 1,
      goals: ["pro", "national", "college", "job", "state"],
      icon: "coach",
      ageBand: "7–12 years",
      costBand: "₹40k–1.5L / year",
      durationNote: "2–4 years",
      funnelNote:
        "Every serious cricketer in India passes through here, and coach quality varies wildly. Watch a session before you pay for a term: are the children batting, or queuing?",
    },
    {
      id: "school",
      kind: "stage",
      label: "School & Inter-School Cricket",
      sublabel: "Harris / Giles Shield and equivalents",
      lane: LANE.academic,
      rawLevel: 1,
      goals: ["college", "job", "state"],
      icon: "school",
      ageBand: "9–17 years",
      costBand: "Low — largely school funded",
      funnelNote:
        "Historically a major scouting ground, and still the cheapest competitive cricket in India. Big scores here genuinely get noticed — Indian selectors have always read the school scorecards.",
    },
    {
      id: "district",
      kind: "stage",
      label: "District Age-Group Trials",
      sublabel: "U-14 / U-16 district squad",
      lane: LANE.selection,
      rawLevel: 2,
      goals: ["pro", "national", "college", "job", "state"],
      icon: "city",
      ageBand: "12–16 years",
      costBand: "₹1L–2L / year",
      durationNote: "1–2 years",
      funnelNote:
        "The first real filter, and the first entry in the record every selector after this will read. Attend the trial even if you don't expect to be picked — being on the list matters.",
    },
    {
      id: "club-league",
      kind: "stage",
      label: "Local League Cricket",
      sublabel: "Registered club, competitive weekends",
      lane: LANE.academic,
      rawLevel: 2,
      goals: ["national", "college", "job", "state"],
      icon: "city",
      ageBand: "13–18 years",
      costBand: "₹50k–1.5L / year",
      funnelNote:
        "Where a missed district trial can be recovered — league runs still count, and a senior-division season against adults is worth more than three age-group ones.",
    },
    {
      id: "state-age",
      kind: "stage",
      label: "State Age-Group",
      sublabel: "Vinoo Mankad U-16 · CK Nayudu U-23",
      lane: LANE.selection,
      rawLevel: 3,
      goals: ["pro", "national", "college", "job", "state"],
      icon: "state",
      ageBand: "15–19 years",
      costBand: "₹2L–4L / year",
      fundingNote:
        "From state level the association starts carrying the cost — travel, kit and accommodation for squad games are usually funded, which makes this the rung where the family's own bill stops climbing.",
      durationNote: "2–4 years",
      funnelNote:
        "A few dozen players per state per age group. This is the real gate in cricket, and reaching it is already enough for a university seat or a services job.",
    },
    {
      id: "ranji",
      kind: "stage",
      label: "Senior State — Ranji Trophy",
      sublabel: "First-class cricket, paid match fees",
      lane: LANE.senior,
      rawLevel: 4,
      goals: ["pro", "national", "job", "state"],
      icon: "trophy",
      ageBand: "19+ years",
      costBand: "Earning, not paying",
      fundingNote:
        "The money turns around here. BCCI match fees plus a state retainer make first-class cricket a paid job rather than an expense — the first rung on this map that pays you.",
      durationNote: "3–8 years",
      funnelNote:
        "The point where cricket becomes a career. Roughly 400 first-class players nationwide, and a Ranji cap is recognised for life whether or not India follows.",
    },
    {
      id: "franchise",
      kind: "milestone",
      label: "IPL / Franchise Contract",
      sublabel: "An auction pick or a squad signing",
      lane: LANE.pro,
      rawLevel: 5,
      goals: ["pro", "job"],
      icon: "medal",
      ageBand: "18+ years",
      costBand: "Contract income",
      funnelNote:
        "Effectively every pick comes from first-class cricket or a high-profile age-group season. Nobody is signed off an open trial without a record behind them.",
    },
    {
      id: "quota",
      kind: "milestone",
      label: "University Sports Quota",
      sublabel: "A seat on your district or state record",
      lane: LANE.academic,
      rawLevel: 3,
      goals: ["college", "job"],
      icon: "college",
      ageBand: "17–19 years",
      costBand: "Reduced or waived fees",
      fundingNote:
        "Quota seats usually carry fee concessions, a hostel place and a flexible academic schedule for match weeks. Rules differ by university — check each one directly.",
      funnelNote:
        "District representation is often enough; you do not need a state cap. Confirm each university's own quota rules before you apply.",
    },
    {
      id: "services",
      kind: "milestone",
      label: "Services & Corporate Teams",
      sublabel: "Railways, banks, armed forces",
      lane: LANE.career,
      goals: ["job"],
      icon: "briefcase",
      ageBand: "18+ years",
      costBand: "Salaried, with a job attached",
      fundingNote:
        "This is employment, not sponsorship. A sports-quota post comes with a salary, a pension and cricket as part of the job description, and it does not end when you stop playing.",
      funnelNote:
        "The most underrated outcome in Indian cricket. A state age-group record is usually the entry requirement, and thousands of players have built whole careers this way.",
    },
    {
      id: "coaching",
      kind: "milestone",
      label: "Coaching & Officiating",
      sublabel: "BCCI Level 1–3, umpire and scorer panels",
      lane: LANE.career,
      goals: ["job"],
      icon: "briefcase",
      ageBand: "21+ years",
      costBand: "Course fees, then salaried",
      durationNote: "Lifelong",
      funnelNote:
        "Coaching runs academy → state age-group → NCA-certified → first-class. Officiating runs scorer → state panel → BCCI panel → international. Both pay, both travel, and neither needs you to have played for India.",
    },

    // ── Goal terminals, each in the lane of the track that feeds it ──
    {
      id: "goal-pro",
      kind: "goal",
      label: "Professional Cricketer",
      lane: LANE.pro,
      goals: ["pro"],
      goalId: "pro",
      icon: "crown",
    },
    {
      id: "goal-national",
      kind: "goal",
      label: "Play for India",
      lane: LANE.senior,
      goals: ["national"],
      goalId: "national",
      icon: "national",
    },
    {
      id: "goal-state",
      kind: "goal",
      label: "State Colours",
      lane: LANE.selection,
      goals: ["state"],
      goalId: "state",
      icon: "state",
    },
    {
      id: "goal-college",
      kind: "goal",
      label: "College on a Quota Seat",
      lane: LANE.academic,
      goals: ["college"],
      goalId: "college",
      icon: "college",
    },
    {
      id: "goal-job",
      kind: "goal",
      label: "A Job in Cricket",
      lane: LANE.career,
      goals: ["job"],
      goalId: "job",
      icon: "briefcase",
    },
  ],

  edges: [
    {
      id: "e-start-academy",
      from: "start",
      to: "academy",
      kind: "primary",
      label: "Join an academy",
      eligibility: "None — just turn up",
      goals: ["pro", "national", "college", "job", "state"],
    },
    {
      id: "e-start-school",
      from: "start",
      to: "school",
      kind: "offramp",
      label: "Play for the school",
      eligibility: "School enrolment",
      goals: ["college", "job", "state"],
    },
    {
      id: "e-academy-district",
      from: "academy",
      to: "district",
      kind: "primary",
      label: "Attend district trials",
      eligibility: "District association registration + age proof",
      readiness: "Holding a place in a competitive club age-group side",
      timeline: "After 2–3 years of coaching",
      goals: ["pro", "national", "college", "job", "state"],
    },
    {
      id: "e-academy-league",
      from: "academy",
      to: "club-league",
      kind: "primary",
      label: "Register with a league club",
      eligibility: "Club registration",
      goals: ["national", "college", "job", "state"],
    },
    {
      id: "e-school-league",
      from: "school",
      to: "club-league",
      kind: "offramp",
      label: "School runs get you a club",
      goals: ["college", "job", "state"],
    },
    {
      // Cricket's genuine shortcut, and the reason the map can't only show the
      // open-trials trap: a big enough school season really does get a player
      // pulled straight into a state setup. Indian cricket has always scouted
      // the Harris/Giles Shield directly.
      id: "e-school-state",
      from: "school",
      to: "state-age",
      kind: "bypass",
      label: "Fast track — skip district",
      readiness: "Only for a genuinely dominant school season",
      unlocks: [
        "A double century or a 10-wicket haul in a major school tournament",
        "Named on a state U-16 probables list",
        "Leading run-scorer or wicket-taker in a senior league division while still U-16",
      ],
      timeline: "Saves roughly 1–2 years",
      goals: ["pro", "national", "state"],
    },
    {
      id: "e-district-state",
      from: "district",
      to: "state-age",
      kind: "primary",
      label: "Selected for the state squad",
      eligibility: "District squad record + a state trial call-up",
      readiness: "A standout district season — runs or wickets on paper",
      timeline: "1–2 years",
      goals: ["pro", "national", "college", "job", "state"],
    },
    {
      id: "e-league-state",
      from: "club-league",
      to: "state-age",
      kind: "primary",
      label: "League form forces a trial",
      readiness: "Leading run-scorer or wicket-taker in a senior division",
      goals: ["national", "state"],
    },
    {
      id: "e-league-quota",
      from: "club-league",
      to: "quota",
      kind: "offramp",
      label: "A club record earns a seat",
      goals: ["college", "job"],
    },
    {
      id: "e-state-goalstate",
      from: "state-age",
      to: "goal-state",
      kind: "primary",
      label: "State colours",
      readiness: "Selected and capped for your state",
      goals: ["state"],
    },
    {
      id: "e-state-quota",
      from: "state-age",
      to: "quota",
      kind: "offramp",
      label: "A state record, a better seat",
      goals: ["college", "job"],
    },
    {
      id: "e-state-ranji",
      from: "state-age",
      to: "ranji",
      kind: "primary",
      label: "Break into the senior side",
      eligibility: "State senior squad selection",
      readiness: "Dominant age-group returns, usually over two seasons",
      timeline: "2–4 years",
      goals: ["pro", "national", "job", "state"],
    },
    {
      id: "e-state-services",
      from: "state-age",
      to: "services",
      kind: "offramp",
      label: "Sports quota job entry",
      eligibility: "Documented state representation",
      goals: ["job"],
    },
    {
      id: "e-ranji-franchise",
      from: "ranji",
      to: "franchise",
      kind: "primary",
      label: "First-class form → the auction",
      readiness: "A strong Ranji season that scouts can point at",
      timeline: "1–4 years",
      goals: ["pro", "job"],
    },
    {
      id: "e-ranji-goalnational",
      from: "ranji",
      to: "goal-national",
      kind: "primary",
      label: "India A, then the senior squad",
      readiness: "Consistent first-class returns across seasons",
      goals: ["national"],
    },
    {
      id: "e-ranji-goalstate",
      from: "ranji",
      to: "goal-state",
      kind: "primary",
      label: "A first-class state cap",
      goals: ["state"],
    },
    {
      id: "e-ranji-coaching",
      from: "ranji",
      to: "coaching",
      kind: "offramp",
      label: "First-class players coach best",
      goals: ["job"],
    },
    {
      id: "e-franchise-goalpro",
      from: "franchise",
      to: "goal-pro",
      kind: "primary",
      label: "A cricket career",
      goals: ["pro"],
    },
    {
      id: "e-franchise-coaching",
      from: "franchise",
      to: "coaching",
      kind: "offramp",
      label: "Then commentary or coaching",
      goals: ["job"],
    },
    {
      id: "e-services-goaljob",
      from: "services",
      to: "goal-job",
      kind: "primary",
      label: "A salaried post through cricket",
      goals: ["job"],
    },
    {
      id: "e-coaching-goaljob",
      from: "coaching",
      to: "goal-job",
      kind: "primary",
      label: "A lifelong trade in the game",
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

    // ── The edge this map exists for ──
    {
      id: "e-overreach-pro",
      from: "academy",
      to: "franchise",
      kind: "overreach",
      label: "Open trials — anyone can attend",
      eligibility: "A registration fee. Advertised as open to all.",
      readiness:
        "Everyone the selectors actually sign has a state age-group record behind them.",
      warning:
        "Open franchise and academy trials are real, and they will take your money. What they won't do is what you're hoping for. A selector at an open trial watches hundreds of players for a few minutes each, and what decides the shortlist is the record they can look up afterwards — district, state, age-group returns. A child with no such record is not being evaluated so much as counted. The trial isn't a way around the age-group ladder; the ladder is the thing that makes a trial worth attending.",
      goals: ["pro"],
    },
  ],
};
