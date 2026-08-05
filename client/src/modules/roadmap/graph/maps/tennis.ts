// ─── Tennis — ranking archetype ─────────────────────────────────────────────
//
// Written for one reader: an Indian parent who has never navigated a sporting
// federation and is trying to work out whether this is worth starting. Three
// consequences follow from that, and they explain most of the choices below.
//
// FOUR DESTINATIONS, ALL OF THEM ANSWERS TO A REAL QUESTION. Play for India,
// turn professional, get a funded university place, or build a career in the
// sport. There is deliberately no "state colours" terminal: AITA grades its
// tournaments nationally and state associations simply host them, so unlike
// cricket there is no state cap to win. Putting one on the map invented an
// outcome that Indian tennis does not award.
//
// IT HAS TO READ WITHOUT A GUIDE. Every rung states the age, the standard, the
// annual cost and what can help pay for it, on the card. The gate on every
// transition is written on the line. The rank rail down the left side turns the
// flow axis from an abstract "further along" into "your child is nine, you are
// here". Nobody should have to be told how to read this.
//
// IT RUNS DOWNWARDS. Twelve ranks laid out left to right is a 4800px canvas and
// four screens of horizontal panning. Turned on its side it is one screen wide
// and scrolls like every other page. The trunk runs down the middle: everything
// to the LEFT of it is playing the sport for a living, everything to the RIGHT is
// a life built around it.
//
// The shortcut trap is still the reason the map exists. Entry to the bottom rung
// of professional tennis (ITF World Tour M15/W15) is genuinely open — an IPIN, an
// entry fee, a flight — while AITA's age-group circuit LOOKS like bureaucracy.
// So a parent concludes one path is gated and the other isn't, and picks the
// ungated one. The `foundation → itf-pro` overreach edge answers that with
// arithmetic instead of advice.
//
// Cost bands follow the PowerMySport Tennis Pathway handbook's own annual ranges
// and are surfaced in the UI as estimates, not quotes.

import { PathwayGraph } from "../types";

/**
 * Lane indices, named. The trunk sits in the MIDDLE so the two families of
 * outcome fall on either side of it — playing careers to the left, careers
 * around the sport to the right — which is the whole mental model in one glance.
 */
const LANE = {
  pro: 0,
  world: 1,
  aita: 2,
  academic: 3,
  career: 4,
} as const;

export const TENNIS_GRAPH: PathwayGraph = {
  sportName: "Tennis",
  archetype: "ranking",
  startNodeId: "start",
  source: "authored",
  orientation: "vertical",
  goals: ["pro", "national", "college", "job"],
  anchorMetric: {
    label: "UTR",
    hint: "Universal Tennis Rating — a single 1–16 scale that lets you compare your child directly against anyone in the world, including the players in the draw you're thinking of entering.",
  },

  lanes: [
    { id: "pro", label: "Professional tour", tone: "pro" },
    { id: "world", label: "International", tone: "national" },
    { id: "aita", label: "The AITA ladder", tone: "ladder" },
    { id: "academic", label: "College route", tone: "college" },
    { id: "career", label: "Career in tennis", tone: "job" },
  ],

  nodes: [
    {
      id: "start",
      kind: "start",
      label: "Where you are today",
      sublabel: "First racquet in hand",
      lane: LANE.aita,
      goals: ["pro", "national", "college", "job"],
      icon: "start",
    },
    {
      id: "learn",
      kind: "stage",
      label: "Coaching · Red & Orange Ball",
      sublabel: "Smaller court, slower ball, first rallies",
      lane: LANE.aita,
      rawLevel: 1,
      goals: ["pro", "national", "college", "job"],
      icon: "coach",
      ageBand: "4–8 years",
      anchorBand: "Unrated",
      costBand: "₹30k–80k / year",
      durationNote: "2–3 years",
      funnelNote:
        "The ITF Tennis10s ball stages exist so a child can rally in week one instead of month six. Two or three sessions a week is the whole job at this age — adding hours here is what produces children who quit at twelve.",
    },
    {
      id: "foundation",
      kind: "stage",
      label: "Green Ball & Full Court",
      sublabel: "Technique, footwork, first real matches",
      lane: LANE.aita,
      rawLevel: 1,
      goals: ["pro", "national", "college", "job"],
      icon: "ball",
      ageBand: "8–10 years",
      anchorBand: "UTR 1–3",
      costBand: "₹80k–2L / year",
      durationNote: "1–2 years",
      funnelNote:
        "The technical habits built here are the ones a player keeps for good. Club, school and district events belong at this stage — school and SGFI tennis is the cheapest match practice in India, and it teaches scoring, nerves and losing with no ranking riding on any of it.",
    },
    {
      id: "talent",
      kind: "stage",
      label: "AITA Talent Series",
      sublabel: "U-10 & U-12 · your first ranking points",
      lane: LANE.aita,
      rawLevel: 2,
      goals: ["pro", "national", "college", "job"],
      icon: "city",
      ageBand: "7–12 years",
      anchorBand: "First AITA ranking",
      costBand: "₹1.5L–3L / year",
      fundingNote:
        "Academy scholarships — RoundGlass, MS Star, IMG and similar — are awarded on the academy's own trials from around here, and can waive coaching or residential fees outright.",
      durationNote: "1–2 years",
      funnelNote:
        "The real entry point to ranked tennis in India. U-10 is the youngest official AITA category and opens at age 7, though most families register between 9 and 11. Roughly 1 in 5 go further.",
    },
    {
      id: "champ",
      kind: "stage",
      label: "AITA Championship Series",
      sublabel: "U-14 / U-16 · a national ranking",
      lane: LANE.aita,
      rawLevel: 3,
      goals: ["pro", "national", "college", "job"],
      icon: "trophy",
      ageBand: "12–16 years",
      anchorBand: "UTR 6–9",
      costBand: "₹3L–6L / year",
      fundingNote:
        "Khelo India Athlete Scheme selection typically happens around this level — reported at roughly ₹6 lakh a year covering training, equipment, diet and education for as long as the athlete stays in the scheme.",
      durationNote: "2–3 years",
      funnelNote:
        "Travel becomes constant here. This is where most families stop for cost reasons rather than talent reasons — which is exactly why the funding above is worth chasing before the costs arrive.",
    },
    {
      id: "nationals",
      kind: "stage",
      label: "AITA Super Series & Nationals",
      sublabel: "Top 20 in India for your age group",
      lane: LANE.aita,
      rawLevel: 4,
      goals: ["pro", "national", "college", "job"],
      icon: "national",
      ageBand: "14–18 years",
      anchorBand: "UTR 9–11",
      costBand: "₹5L–12L / year",
      fundingNote:
        "A national ranking is the track record corporate CSR and private sponsors want before they commit. Sponsorship is the hardest money to raise and the only kind that scales with the player's own story.",
      durationNote: "2–4 years",
      funnelNote:
        "A few hundred children in the country are here in any age group. Reaching this rung is already enough to open a university seat or a coaching career, whatever happens next.",
    },
    {
      id: "itf-jr",
      kind: "milestone",
      label: "ITF Juniors — J30 → J500",
      sublabel: "A world junior ranking",
      lane: LANE.world,
      rawLevel: 4,
      goals: ["pro", "national", "college"],
      icon: "world",
      ageBand: "14–18 years",
      anchorBand: "UTR 10–13",
      costBand: "₹15L–30L / year",
      fundingNote:
        "The biggest cost jump on the map, and where funding stops being optional — Khelo India, an academy scholarship and a sponsor usually have to run together to make a season viable.",
      durationNote: "3–4 years",
      funnelNote:
        "International travel every few weeks. Asian Tennis Federation events are the cheaper way in: the same international experience for a fraction of the airfare.",
    },
    {
      id: "itf-pro",
      kind: "milestone",
      label: "ITF World Tour — M15 / W15",
      sublabel: "Your first professional ranking point",
      lane: LANE.pro,
      rawLevel: 5,
      goals: ["pro"],
      icon: "medal",
      ageBand: "17+ years",
      anchorBand: "UTR 13+",
      costBand: "₹20L–35L / year",
      fundingNote:
        "TOPS — the Target Olympic Podium Scheme — backs elite seniors with genuine international medal potential, in the form of foreign camps, top coaches and sports-science support rather than a cash grant.",
      durationNote: "2–5 years",
      funnelNote:
        "Open to anyone who pays. Winnable by almost nobody. That gap is the whole point of this map — and this is the START of a professional career, not the end of the climb.",
    },
    {
      id: "challenger",
      kind: "milestone",
      label: "ATP Challenger / WTA 125",
      sublabel: "The working professional circuit",
      lane: LANE.pro,
      rawLevel: 5,
      goals: ["pro", "job"],
      icon: "rating",
      ageBand: "20+ years",
      anchorBand: "UTR 14–15.5",
      costBand: "₹30L–50L / year, part prize-funded",
      fundingNote:
        "Prize money starts to contribute here but rarely covers a full season. TOPS support and sponsorship carry most Indian players through these years.",
      durationNote: "3–6 years",
      funnelNote:
        "Where most Indian professionals actually spend their careers. Draws are full of former tour players and rising internationals, and a top-400 ranking is a real achievement rather than a rung you pass through.",
    },
    {
      id: "tour",
      kind: "milestone",
      label: "ATP / WTA Tour & Grand Slams",
      sublabel: "Top 100 in the world",
      lane: LANE.pro,
      rawLevel: 5,
      goals: ["pro"],
      icon: "trophy",
      ageBand: "23+ years",
      anchorBand: "UTR 16",
      costBand: "Prize money and sponsorship fund it",
      durationNote: "Career-long",
      funnelNote:
        "A handful of Indians have ever held a top-100 singles ranking; doubles has been far kinder. And most players inside the top 100 are 24–25, not teenagers — which may be the most useful single fact on this map.",
    },
    {
      id: "ncaa",
      kind: "milestone",
      label: "US College — NCAA D1 / D2",
      sublabel: "A funded degree on a tennis team",
      lane: LANE.academic,
      goals: ["college", "job"],
      icon: "college",
      ageBand: "18–22 years",
      anchorBand: "UTR 10–13 (D1)",
      costBand: "Often fully funded",
      fundingNote:
        "Here the scholarship IS the funding. More than 1,000 US universities field tennis programmes across NCAA D1/D2/D3, NAIA and junior colleges, and an athletic award can cover fees and living costs outright.",
      durationNote: "4 years",
      funnelNote:
        "The best risk-adjusted route in this sport, and the one Indian parents hear about last. Coaches recruit on UTR, ITF and AITA ranking together with school grades and English proficiency.",
    },
    {
      id: "quota",
      kind: "milestone",
      label: "Indian University Sports Quota",
      sublabel: "A seat on your AITA ranking",
      lane: LANE.academic,
      rawLevel: 3,
      goals: ["college", "job"],
      ageBand: "17–19 years",
      icon: "college",
      costBand: "Reduced or waived fees",
      fundingNote:
        "Quota seats usually carry fee concessions, a hostel place and a flexible academic schedule for tournament weeks. The rules differ by university — check each one directly.",
      funnelNote:
        "An AITA age-group ranking is usually enough; you do not need to have played internationally. Confirm each university's own quota rules before you apply.",
    },
    {
      id: "coaching",
      kind: "milestone",
      label: "Coaching & Officiating Badges",
      sublabel: "Certify as a coach, umpire or manager",
      lane: LANE.career,
      goals: ["job"],
      icon: "briefcase",
      ageBand: "18+ years",
      costBand: "Course fees, then salaried",
      durationNote: "Lifelong",
      funnelNote:
        "Coaching runs assistant → academy → high performance → national → touring coach, on AITA, ITF or PTR certification. Officiating runs chair umpire → referee → tournament director. Both take you around the world on somebody else's budget.",
    },

    // ── Goal terminals, each in the lane of the track that feeds it ──
    {
      id: "goal-pro",
      kind: "goal",
      label: "Turn Professional",
      lane: LANE.pro,
      goals: ["pro"],
      goalId: "pro",
      icon: "crown",
    },
    {
      id: "goal-national",
      kind: "goal",
      label: "Represent India",
      lane: LANE.world,
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
      label: "A Job in Tennis",
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
      label: "Find a coach",
      eligibility: "None — just show up",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-learn-foundation",
      from: "learn",
      to: "foundation",
      kind: "primary",
      label: "Move up to the green ball",
      eligibility: "None — the coach decides",
      readiness:
        "Rallying consistently on the orange court. Progression here is by skill, not by birthday.",
      timeline: "After 2–3 years of red and orange ball",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-foundation-talent",
      from: "foundation",
      to: "talent",
      kind: "primary",
      label: "Register with AITA",
      eligibility:
        "AITA membership and verified age proof. U-10 is the youngest category and opens at age 7.",
      readiness:
        "Can serve, rally and score a match unaided — and handle losing one. Roughly UTR 3.",
      timeline: "Most families register between 9 and 11",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-talent-champ",
      from: "talent",
      to: "champ",
      kind: "primary",
      label: "Earn Talent Series points",
      readiness: "Consistent quarter-finals at Talent Series level",
      timeline: "1–2 years",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-champ-nationals",
      from: "champ",
      to: "nationals",
      kind: "primary",
      label: "Reach the India top 100",
      readiness: "AITA age-group ranking inside the top 100",
      timeline: "2–3 years",
      goals: ["pro", "national", "college", "job"],
    },
    {
      id: "e-champ-quota",
      from: "champ",
      to: "quota",
      kind: "offramp",
      label: "An AITA ranking earns a seat",
      eligibility: "A documented AITA age-group ranking",
      goals: ["college", "job"],
    },
    {
      id: "e-champ-itfjr",
      from: "champ",
      to: "itf-jr",
      kind: "bypass",
      label: "Fast track — skip nationals",
      readiness: "Genuinely strong juniors only",
      unlocks: [
        "AITA top 10 in India at U-14",
        "UTR 9 or above",
        "Two main-draw wins at an ITF J30",
      ],
      timeline: "Saves roughly 2 years",
      goals: ["pro", "college"],
    },
    {
      id: "e-nationals-itfjr",
      from: "nationals",
      to: "itf-jr",
      kind: "primary",
      label: "A national ranking opens ITF entry",
      eligibility: "AITA nomination for ITF events",
      readiness: "Top 20 in India in the age group",
      goals: ["pro", "national", "college"],
    },
    {
      id: "e-nationals-goalnational",
      from: "nationals",
      to: "goal-national",
      kind: "primary",
      label: "Win a national title",
      readiness: "An AITA national age-group final",
      goals: ["national"],
    },
    {
      id: "e-nationals-quota",
      from: "nationals",
      to: "quota",
      kind: "offramp",
      label: "A national record, a better seat",
      goals: ["college", "job"],
    },
    {
      id: "e-nationals-coaching",
      from: "nationals",
      to: "coaching",
      kind: "offramp",
      label: "Turn the years into a career",
      eligibility: "A playing record, then a coaching certification",
      goals: ["job"],
    },
    {
      id: "e-itfjr-itfpro",
      from: "itf-jr",
      to: "itf-pro",
      kind: "primary",
      label: "ITF junior top 100 in the world",
      readiness: "An ITF junior world ranking inside the top 100",
      timeline: "3–4 years",
      goals: ["pro"],
    },
    {
      id: "e-itfjr-ncaa",
      from: "itf-jr",
      to: "ncaa",
      kind: "offramp",
      label: "ITF ranking → NCAA recruiting",
      eligibility: "NCAA academic eligibility + SAT/TOEFL",
      readiness: "UTR 10+ for D2, 12+ for a strong D1",
      goals: ["college", "job"],
    },
    {
      id: "e-itfjr-goalnational",
      from: "itf-jr",
      to: "goal-national",
      kind: "primary",
      label: "The India junior squad",
      readiness: "Junior Davis Cup or Billie Jean King Cup selection",
      goals: ["national"],
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
      id: "e-ncaa-itfpro",
      from: "ncaa",
      to: "itf-pro",
      kind: "bypass",
      label: "College → pro is a real route",
      readiness: "All-American level college results",
      unlocks: [
        "NCAA D1 singles inside the top 50",
        "UTR 14+ by the end of college",
        "A funded post-college pro season",
      ],
      goals: ["pro"],
    },
    {
      id: "e-ncaa-coaching",
      from: "ncaa",
      to: "coaching",
      kind: "offramp",
      label: "A degree plus a playing record",
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
      id: "e-itfpro-challenger",
      from: "itf-pro",
      to: "challenger",
      kind: "primary",
      label: "Enough points for Challenger entry",
      eligibility: "An ATP/WTA ranking high enough for the qualifying draw",
      readiness:
        "Winning M15 and M25 main draws consistently — roughly a top-700 ranking",
      timeline: "2–4 years",
      goals: ["pro"],
    },
    {
      id: "e-challenger-goalpro",
      from: "challenger",
      to: "goal-pro",
      kind: "primary",
      label: "This is already a pro career",
      readiness: "A ranking and results that sustain a full season",
      goals: ["pro"],
    },
    {
      id: "e-challenger-tour",
      from: "challenger",
      to: "tour",
      kind: "primary",
      label: "Break into the world top 100",
      readiness: "Deep Challenger runs and titles, across several seasons",
      timeline: "3–6 years",
      goals: ["pro"],
    },
    {
      id: "e-challenger-coaching",
      from: "challenger",
      to: "coaching",
      kind: "offramp",
      label: "Ex-pros make the best coaches",
      goals: ["job"],
    },
    {
      id: "e-tour-goalpro",
      from: "tour",
      to: "goal-pro",
      kind: "primary",
      label: "The top of the game",
      readiness: "Direct entry to tour events and Grand Slam main draws",
      goals: ["pro"],
    },
    {
      id: "e-coaching-goaljob",
      from: "coaching",
      to: "goal-job",
      kind: "primary",
      label: "A salaried life in the sport",
      goals: ["job"],
    },

    // ── The edge this whole map exists for ──
    {
      id: "e-overreach-pro",
      from: "foundation",
      to: "itf-pro",
      kind: "overreach",
      label: "Open entry — barely a gate",
      eligibility:
        "An IPIN and the entry fee. The one real limit is the ITF age-eligibility rule, which caps how many senior events an under-18 may play in a year — it does not stop them entering.",
      readiness:
        "The players in that draw sit around UTR 13. A child on a full court for the first time is around UTR 2.",
      warning:
        "You can enter. You will barely be stopped. But the qualifying draw of an M15 is full of adults who were national juniors, and the realistic result is a first-round loss for zero ranking points — repeated at roughly ₹2–4 lakh a year in travel and entries. The gate in tennis is competitive, not administrative. Skipping the AITA circuit doesn't bypass it; it just means facing it with no ranking, no match record and no selectors watching.",
      goals: ["pro"],
    },
  ],
};
