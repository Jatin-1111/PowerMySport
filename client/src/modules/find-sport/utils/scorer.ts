import type { FitLabel, SportFitResult, SportProfile, SportResult, WizardAnswers } from "../types";
import { MAX_CONSIDERED_SPORTS } from "../types";
import { SPORT_PROFILES } from "../data/sportProfiles";
import { getStateInfraTier } from "../data/stateInfraTier";

// ─── Answer → Dimension value maps (1–5 scale) ───────────────────────────────

function getChildDimensions(a: WizardAnswers) {
  return {
    // The two scales run in opposite directions and must be reconciled here:
    // the wizard's answer is 1 = "Just me" → 5 = "Team, always" (SpectrumSlider),
    // while SportProfile.individual is 1 = very team → 5 = very individual.
    // Feeding the answer across unflipped matched team-preferring children to
    // the most solo sports and vice versa.
    individual: 6 - (a.teamIndividual ?? 3),
    explosive: a.energyType === "explosive" ? 5 : a.energyType === "endurance" ? 1 : 3,
    endurance: a.energyType === "endurance" ? 5 : a.energyType === "explosive" ? 1 : 3,
    visualTracking: a.visualTracking === "strong" ? 5 : a.visualTracking === "moderate" ? 3 : 1,
    reactFast: a.decisionStyle === "react" ? 5 : a.decisionStyle === "strategic" ? 1 : 3,
    sustainedFocus: a.focusStyle === "sustained" ? 5 : a.focusStyle === "bursts" ? 1 : 3,
    pressureTolerance:
      a.pressureResponse === "thrives" ? 5 : a.pressureResponse === "manages" ? 3 : 1,
    repetitionNeed: a.repetitionTolerance === "high" ? 5 : a.repetitionTolerance === "low" ? 1 : 3,
    contactRequired: a.contactComfort === "loves" ? 5 : a.contactComfort === "neutral" ? 3 : 1,
    eyesightValue:
      a.eyesight === "sharp"
        ? 5
        : a.eyesight === "corrected"
          ? 3
          : a.eyesight === "limited"
            ? 1
            : 3,
    agilityValue:
      a.agility === "high" ? 5 : a.agility === "moderate" ? 3 : a.agility === "low" ? 1 : 3,
    // Physical traits — derived from numeric height/weight
    buildValue: (() => {
      if (a.height && a.weight) {
        const bmi = a.weight / (a.height / 100) ** 2;
        if (bmi < 17) return 1;
        if (bmi > 22) return 5;
        return 3;
      }
      return 3;
    })(),
    heightValue: (() => {
      if (!a.height) return 3;
      const avg = a.age ? Math.min(175, 85 + a.age * 5.5) : 140;
      if (a.height < avg * 0.93) return 1;
      if (a.height > avg * 1.07) return 5;
      return 3;
    })(),
    // Environment preference
    envValue: a.environment,
  };
}

// ─── Weight vectors by ambition ───────────────────────────────────────────────

const WEIGHTS = {
  fun: {
    individual: 0.15,
    explosive: 0.07,
    endurance: 0.05,
    visualTracking: 0.06,
    reactFast: 0.06,
    sustainedFocus: 0.07,
    pressureTolerance: 0.04,
    repetitionNeed: 0.07,
    contactRequired: 0.08,
    eyesight: 0.04,
    agility: 0.05,
    physicalMatch: 0.03,
    environment: 0.09,
    age: 0.03,
    timeMatch: 0.03,
    infrastructure: 0.05,
  },
  competitive: {
    individual: 0.12,
    explosive: 0.08,
    endurance: 0.07,
    visualTracking: 0.07,
    reactFast: 0.06,
    sustainedFocus: 0.05,
    pressureTolerance: 0.07,
    repetitionNeed: 0.05,
    contactRequired: 0.05,
    eyesight: 0.05,
    agility: 0.07,
    physicalMatch: 0.05,
    environment: 0.03,
    age: 0.08,
    timeMatch: 0.05,
    infrastructure: 0.04,
  },
  national: {
    individual: 0.09,
    explosive: 0.1,
    endurance: 0.08,
    visualTracking: 0.07,
    reactFast: 0.06,
    sustainedFocus: 0.04,
    pressureTolerance: 0.06,
    repetitionNeed: 0.05,
    contactRequired: 0.05,
    eyesight: 0.06,
    agility: 0.08,
    physicalMatch: 0.07,
    environment: 0.01,
    age: 0.1,
    timeMatch: 0.07,
    infrastructure: 0.03,
  },
  professional: {
    individual: 0.06,
    explosive: 0.1,
    endurance: 0.08,
    visualTracking: 0.07,
    reactFast: 0.06,
    sustainedFocus: 0.04,
    pressureTolerance: 0.07,
    repetitionNeed: 0.06,
    contactRequired: 0.04,
    eyesight: 0.06,
    agility: 0.09,
    physicalMatch: 0.09,
    environment: 0.0,
    age: 0.1,
    timeMatch: 0.08,
    infrastructure: 0.02,
  },
} as const;

// Sum of a tier's weights = the theoretical ceiling raw score for a
// mathematically perfect dimension match at that ambition tier (all budget
// fit is already handled by the hard gate, not a soft weight, so it's not
// part of this vector). Absolute scoring normalizes against this ceiling
// instead of the child's own best-scoring sport, so a "70/100" means
// "70% of a genuinely perfect match" — comparable across children, not just
// relative to their own other options.
function weightCeiling(weights: Record<string, number>): number {
  return Object.values(weights).reduce((sum, w) => sum + w, 0);
}

// ─── Budget tier ordering ─────────────────────────────────────────────────────

const BUDGET_ORDER = ["under-3k", "3k-7k", "7k-15k", "15k-plus"] as const;

function budgetCoversMinimum(
  parentBudget: WizardAnswers["budget"],
  sportMin: SportProfile["minBudgetTier"]
): boolean {
  if (!parentBudget) return true;
  return BUDGET_ORDER.indexOf(parentBudget) >= BUDGET_ORDER.indexOf(sportMin);
}

// ─── Match score for a single dimension (bidirectional, 0–1) ─────────────────
// Use for style/preference dimensions where mismatch hurts in both directions
// (teamIndividual, energyType, reactFast, sustainedFocus, pressureTolerance, contactRequired).
function dimMatch(childVal: number, sportVal: number): number {
  return 1 - Math.abs(childVal - sportVal) / 4;
}

// Use for capability dimensions where having MORE than required is neutral, not a penalty
// (visualTracking, eyesight, agility, repetitionNeed).
// A child with sharp vision playing chess is not disadvantaged — they just don't need it.
function capMatch(childVal: number, sportVal: number): number {
  if (childVal >= sportVal) return 1.0;
  return 1 - (sportVal - childVal) / 4;
}

// ─── Physical match ───────────────────────────────────────────────────────────

function physicalMatch(child: ReturnType<typeof getChildDimensions>, sport: SportProfile): number {
  const buildTarget =
    sport.buildPreference === "lean" ? 1 : sport.buildPreference === "stocky" ? 5 : 3;
  const heightTarget =
    sport.heightAdvantage === "short" ? 1 : sport.heightAdvantage === "tall" ? 5 : 3;
  return (dimMatch(child.buildValue, buildTarget) + dimMatch(child.heightValue, heightTarget)) / 2;
}

// ─── Environment match ────────────────────────────────────────────────────────

function envMatch(
  childPref: WizardAnswers["environment"],
  sportPref: SportProfile["environmentPreference"]
): number {
  if (!childPref || childPref === "no-preference" || sportPref === "either") return 1;
  return childPref === sportPref ? 1 : 0.3;
}

// ─── Infrastructure availability match ───────────────────────────────────────
// Soft penalty (not a hard gate) for sports whose minCityTier requirement
// exceeds what the parent's state generally offers — having MORE than needed
// is neutral, same shape as capMatch, just on a 1-3 scale instead of 1-5.
function infraMatch(stateTier: number, sportMinCityTier: SportProfile["minCityTier"]): number {
  if (stateTier >= sportMinCityTier) return 1;
  return Math.max(0.3, 1 - (sportMinCityTier - stateTier) * 0.35);
}

// ─── Time availability match ─────────────────────────────────────────────────

function timeMatch(childHours: WizardAnswers["weeklyHours"], sport: SportProfile): number {
  if (!childHours) return 0.7;
  const childVal =
    childHours === "1-3" ? 2 : childHours === "4-7" ? 5 : childHours === "8-12" ? 10 : 15;
  if (childVal >= sport.minWeeklyHours) return 1.0;
  return Math.max(0.15, childVal / sport.minWeeklyHours);
}

// ─── Age window match ─────────────────────────────────────────────────────────
// Penalty per year of overshoot scales by BOTH ambition and age-start sensitivity.
// critical (gymnastics): window closes fast — 2× the penalty multiplier.
// flexible (chess, shooting, cricket): late starts are viable — 0.4× multiplier.

// ─── Ambition tiers ──────────────────────────────────────────────────────────
//
// "career" (building a livelihood through sport — the sports quota job, the
// college scholarship, the pro route) sits at the TOP of the ladder alongside
// national ambition, not off to one side. A parent choosing it is the most
// committed segment, so it takes the same treatment as the elite tiers: the
// steeper late-start penalty, the age-window cutoff, and the height gates.
//
// "professional" is legacy — it was the top option before "career" replaced it
// and is no longer offered, but rows written earlier still carry it, so every
// check below keeps honouring it.
const ELITE_AMBITIONS = new Set(["national", "career", "professional"]);
const isEliteAmbition = (a: string | null | undefined): boolean => !!a && ELITE_AMBITIONS.has(a);

function ageMatch(
  age: number | null,
  sport: SportProfile,
  ambition: WizardAnswers["ambition"]
): number {
  if (!age) return 0.7;
  const [idealMin, idealMax] = sport.ageWindowIdeal;
  if (age >= idealMin && age <= idealMax) return 1;
  if (age < idealMin) return 0.9; // started before ideal window — still fine
  if (age <= sport.ageWindowCutoff) {
    const overshoot = age - idealMax;
    const sensitivityMult =
      sport.ageStartSensitivity === "critical"
        ? 2.2
        : sport.ageStartSensitivity === "flexible"
          ? 0.4
          : 1.0;
    const basePerYear = isEliteAmbition(ambition) ? 0.12 : 0.06;
    const penaltyPerYear = basePerYear * sensitivityMult;
    const minScore =
      sport.ageStartSensitivity === "critical"
        ? 0.05
        : sport.ageStartSensitivity === "flexible"
          ? 0.45
          : 0.2;
    return Math.max(minScore, 1 - overshoot * penaltyPerYear);
  }
  if (isEliteAmbition(ambition)) return 0.05;
  return 0.4;
}

// ─── Synergy bonuses ─────────────────────────────────────────────────────────
// Compound bonuses for attribute combinations that reinforce each other beyond
// what individual dimension scores already capture.

const RACKET_SPORT_NAMES = new Set(["Badminton", "Table Tennis", "Tennis"]);

function computeSynergyBonus(
  child: ReturnType<typeof getChildDimensions>,
  sport: SportProfile
): number {
  let bonus = 0;
  // Racket athlete: explosive bursts + high agility → unusually good fit for racket sports
  if (RACKET_SPORT_NAMES.has(sport.name) && child.explosive >= 4 && child.agilityValue >= 4) {
    bonus += 0.04;
  }
  // Precision athlete: sharp vision + strong tracking → compound edge in high-vision sports
  if (child.visualTracking >= 4 && child.eyesightValue >= 4 && sport.visionDemand >= 4) {
    bonus += 0.03;
  }
  // Endurance athlete: high endurance + high repetition tolerance → distance/technical sports
  if (child.endurance >= 4 && child.repetitionNeed >= 4 && sport.endurance >= 4) {
    bonus += 0.03;
  }
  // Tactical athlete: strategic decision-making + sustained focus → mind/precision sports
  if (
    child.reactFast <= 2 &&
    child.sustainedFocus >= 4 &&
    sport.reactFast <= 2 &&
    sport.sustainedFocus >= 4
  ) {
    bonus += 0.04;
  }
  return bonus;
}

// ─── Prior sport skill-transfer bonus ────────────────────────────────────────
// Skills from sports a child has already played transfer meaningfully to
// adjacent sports. Map is keyed by the sport being scored; values are prior
// sports whose practice builds transferable skills. Both keys and values are
// restricted to PRIOR_SPORTS_OPTIONS (the only sports the wizard lets a
// parent pick as "already played") — a value outside that list could never
// be selected, so it would just be dead weight.

const PRIOR_SPORT_TRANSFERS: Record<string, string[]> = {
  Badminton: ["Table Tennis", "Tennis"],
  "Table Tennis": ["Badminton", "Tennis"],
  Tennis: ["Badminton", "Table Tennis"],
  Basketball: ["Volleyball", "Football", "Cricket"],
  Volleyball: ["Basketball", "Football"],
  Football: ["Basketball", "Cricket", "Hockey"],
  Cricket: ["Football", "Volleyball"],
  Hockey: ["Football"],
};

function computePriorSportBonus(priorSports: string[], sport: SportProfile): number {
  if (!priorSports.length) return 0;
  if (priorSports.includes(sport.name)) return 0.05; // retaking own sport
  const transfersFrom = PRIOR_SPORT_TRANSFERS[sport.name] ?? [];
  return priorSports.some((ps) => transfersFrom.includes(ps)) ? 0.025 : 0;
}

// ─── Reasons generator ────────────────────────────────────────────────────────

interface TaggedReason {
  type: string;
  text: string;
}

// Reasons are tagged by underlying mechanism (not exact text) so scoreSports()
// can avoid showing the same reason type twice across the 3 displayed cards.
// Two dimensionally-similar sports (e.g. Badminton and Table Tennis) satisfy
// the same conditions in the same order, so without this a parent would see
// two cards with literally identical justification text (just the sport name
// swapped) — technically true, but reads as templated rather than personalised.
// Pronoun helpers — resolve to he/she when gender is known, singular "they"
// only when the parent didn't specify (same fallback rule as the wizard's
// own question prompts).
function pronounsFor(gender: WizardAnswers["gender"]) {
  if (gender === "boy")
    return { poss: "his", possPronoun: "his", subj: "he", obj: "him", plural: false };
  if (gender === "girl")
    return { poss: "her", possPronoun: "hers", subj: "she", obj: "her", plural: false };
  return { poss: "their", possPronoun: "theirs", subj: "they", obj: "them", plural: true };
}

function buildReasons(
  answers: WizardAnswers,
  sport: SportProfile,
  child: ReturnType<typeof getChildDimensions>
): TaggedReason[] {
  const name = answers.childName || "Your child";
  const { poss, possPronoun } = pronounsFor(answers.gender);
  const reasons: TaggedReason[] = [];

  // Personality match reasons.
  // The claim about the child comes from the child's own answer, not from
  // whichever sport is being scored — scoring the same kid against several
  // sports and inferring their disposition from each one produced cards that
  // flatly contradicted each other. When the answer sits mid-scale there's no
  // preference to assert, so describe the sport instead.
  const indMatch = dimMatch(child.individual, sport.individual);
  if (indMatch >= 0.75) {
    const ti = answers.teamIndividual;
    if (sport.individual >= 4) {
      reasons.push({
        type: "team-individual",
        text:
          ti !== null && ti <= 2
            ? `${name} wants the result to be ${possPronoun} alone. In ${sport.name} it is.`
            : `${sport.name} is decided by one player — no teammates to carry a bad day.`,
      });
    } else if (sport.individual <= 2) {
      reasons.push({
        type: "team-individual",
        text:
          ti !== null && ti >= 4
            ? `${name} plays better with a team, and ${sport.name} is built entirely around one.`
            : `${sport.name} runs on shared effort, with a squad to fall back on.`,
      });
    } else {
      reasons.push({
        type: "team-individual",
        text: `${sport.name} is a team game where the big moments still land on one player. It works either way.`,
      });
    }
  }

  if (answers.energyType && dimMatch(child.explosive, sport.explosive) >= 0.75) {
    if (answers.energyType === "explosive" && sport.explosive >= 4) {
      reasons.push({
        type: "energy",
        text: `Speed and power decide ${sport.name} — exactly ${poss} energy pattern.`,
      });
    } else if (answers.energyType === "endurance" && sport.endurance >= 4) {
      reasons.push({
        type: "energy",
        text: `${sport.name} rewards staying power over long sessions. That's ${poss} strength.`,
      });
    }
  }

  // ── Vision ──
  // Strong tracking, sharp eyesight and the two combined used to fire as three
  // separate reasons, producing near-identical sentences on the same card. One
  // vision line per sport, picking the strongest claim that applies.
  const trackingFits =
    answers.visualTracking === "strong" &&
    sport.visualTracking >= 4 &&
    dimMatch(child.visualTracking, sport.visualTracking) >= 0.75;
  const sharpEyes = answers.eyesight === "sharp" && sport.visionDemand >= 4;

  if (trackingFits && sharpEyes && child.visualTracking >= 4 && child.eyesightValue >= 4) {
    reasons.push({
      type: "synergy-vision",
      text: `Sharp eyes and strong tracking together — ${sport.name} rewards the pair more than either alone.`,
    });
  } else if (trackingFits) {
    reasons.push({
      type: "visual-tracking",
      text: `${name} picks up a fast-moving object early — the core skill in ${sport.name}.`,
    });
  } else if (sharpEyes) {
    reasons.push({
      type: "eyesight",
      text: `Clear, uncorrected vision, and ${sport.name} is read at speed.`,
    });
  }

  if (
    answers.decisionStyle === "react" &&
    sport.reactFast >= 4 &&
    dimMatch(child.reactFast, sport.reactFast) >= 0.75
  ) {
    reasons.push({
      type: "decision-style",
      text: `${sport.name} moves too fast to overthink. ${name} reacts on instinct.`,
    });
  } else if (
    answers.decisionStyle === "strategic" &&
    sport.reactFast <= 2 &&
    dimMatch(child.reactFast, sport.reactFast) >= 0.75
  ) {
    reasons.push({
      type: "decision-style",
      text: `${sport.name} rewards planning over reflex — how ${name} already thinks.`,
    });
  }

  if (answers.pressureResponse === "thrives" && sport.pressureTolerance >= 4) {
    reasons.push({
      type: "pressure",
      text:
        sport.individual >= 4
          ? `${sport.name} puts one player in full view. ${name} plays better there.`
          : `Even in a team, ${sport.name}'s decisive moments land on one player. ${name} wants them.`,
    });
  }

  // Physical match reason
  const phys = physicalMatch(child, sport);
  if (
    phys >= 0.8 &&
    answers.height &&
    (sport.buildPreference !== "any" || sport.heightAdvantage !== "any")
  ) {
    const avg = answers.age ? Math.min(175, 85 + answers.age * 5.5) : 140;
    const isTall = answers.height > avg * 1.07;
    const isShort = answers.height < avg * 0.93;
    const isStocky =
      answers.height && answers.weight ? answers.weight / (answers.height / 100) ** 2 > 22 : false;
    if (sport.heightAdvantage === "tall" && isTall) {
      reasons.push({
        type: "physical",
        text: `Taller than most kids ${poss} age — a structural advantage in ${sport.name}.`,
      });
    } else if (sport.heightAdvantage === "short" && isShort) {
      reasons.push({
        type: "physical",
        text: `A compact build means a lower centre of gravity and quicker rotation. Both count in ${sport.name}.`,
      });
    } else if (sport.buildPreference === "stocky" && isStocky) {
      reasons.push({
        type: "physical",
        text: `A strong, stocky build suits the physical demands of ${sport.name}.`,
      });
    }
  }

  // Low vision demand — the sharp-eyesight case is handled with tracking above
  if (answers.eyesight === "limited" && sport.visionDemand <= 2) {
    reasons.push({
      type: "eyesight",
      text: `${sport.name} asks almost nothing of eyesight. Vision won't hold ${name} back.`,
    });
  }

  // Agility & flexibility reason
  if (
    answers.agility === "high" &&
    sport.agilityNeed >= 4 &&
    dimMatch(child.agilityValue, sport.agilityNeed) >= 0.75
  ) {
    reasons.push({
      type: "agility",
      text: `${sport.name} runs on quick footwork and range of movement. ${name} has both.`,
    });
  } else if (answers.agility === "low" && sport.agilityNeed <= 2) {
    reasons.push({
      type: "agility",
      text: `${sport.name} doesn't ask for agility — strength, strategy and consistency carry it.`,
    });
  }

  // Time availability reason
  if (answers.weeklyHours) {
    const childVal =
      answers.weeklyHours === "1-3"
        ? 2
        : answers.weeklyHours === "4-7"
          ? 5
          : answers.weeklyHours === "8-12"
            ? 10
            : 15;
    if (childVal >= sport.minWeeklyHours) {
      reasons.push({
        type: "time",
        text: `${sport.name} needs ${sport.minWeeklyHours}+ hours a week. Your time covers it.`,
      });
    }
  }

  // Budget + location reason (always include as a practical anchor)
  if (answers.state && answers.budget) {
    reasons.push({
      type: "budget",
      text: `${sport.name} runs ${sport.costRange} in ${answers.state} — inside your budget.`,
    });
  } else if (answers.budget) {
    reasons.push({
      type: "budget",
      text: `A good ${sport.name} academy runs ${sport.costRange} — inside your budget.`,
    });
  }

  // Age window reason
  if (answers.age) {
    const [idealMin, idealMax] = sport.ageWindowIdeal;
    if (answers.age >= idealMin && answers.age <= idealMax) {
      reasons.push({
        type: "age-window",
        text: `At ${answers.age}, ${name} is inside the ideal window to start ${sport.name}.`,
      });
    }
  }

  // Synergy reasons — only fire when the compound actually scored
  if (RACKET_SPORT_NAMES.has(sport.name) && child.explosive >= 4 && child.agilityValue >= 4) {
    reasons.push({
      type: "synergy-racket",
      text: `Explosive energy plus high agility — ${sport.name} demands exactly that pairing.`,
    });
  }
  if (
    child.reactFast <= 2 &&
    child.sustainedFocus >= 4 &&
    sport.reactFast <= 2 &&
    sport.sustainedFocus >= 4
  ) {
    reasons.push({
      type: "synergy-tactical",
      text: `Patience and precision beat reaction speed in ${sport.name}. ${name} has both.`,
    });
  }

  // Prior sport transfer reason
  const transfersFrom = PRIOR_SPORT_TRANSFERS[sport.name] ?? [];
  const matchingPrior = answers.priorSports.find((ps) => transfersFrom.includes(ps));
  if (matchingPrior) {
    reasons.push({
      type: "prior-sport",
      text: `${matchingPrior} transfers directly to ${sport.name} — the movement patterns overlap.`,
    });
  }

  return reasons;
}

// ─── Hard gates ───────────────────────────────────────────────────────────────

function passesHardGates(answers: WizardAnswers, sport: SportProfile): boolean {
  // Water gate
  if (sport.requiresWater && answers.waterComfort === "uncomfortable") return false;
  // Contact gate
  if (sport.requiresContact && answers.contactComfort === "avoids") return false;
  // Budget gate
  if (answers.budget && !budgetCoversMinimum(answers.budget, sport.minBudgetTier)) return false;
  // Age cutoff for national/professional ambition
  if (answers.age && answers.age > sport.ageWindowCutoff && isEliteAmbition(answers.ambition))
    return false;

  // ── Biological gates ──────────────────────────────────────────────────────
  // Basketball: height lower bound — national/professional + age 13+
  if (
    sport.name === "Basketball" &&
    isEliteAmbition(answers.ambition) &&
    answers.age &&
    answers.age >= 13 &&
    answers.height
  ) {
    const minH = answers.gender === "girl" ? 160 : 168;
    if (answers.height < minH) return false;
  }

  // Volleyball: height lower bound — national/professional + age 13+
  if (
    sport.name === "Volleyball" &&
    isEliteAmbition(answers.ambition) &&
    answers.age &&
    answers.age >= 13 &&
    answers.height
  ) {
    const minH = answers.gender === "girl" ? 162 : 172;
    if (answers.height < minH) return false;
  }

  return true;
}

// ─── Blockers & gaps (parent-chosen sports only) ─────────────────────────────
// Our own recommendations are filtered by passesHardGates() — a sport the
// family can't afford or that needs water a scared child won't enter simply
// never gets suggested. A sport the PARENT put on their shortlist can't be
// handled that way: silently dropping it reads as a bug, and the honest
// answer ("here's the wall you'd hit") is the useful one. So the same gates
// are re-expressed as plain-language blockers, and the softer mismatches as
// gaps, both shown alongside what genuinely fits.

const BUDGET_GAP_LABEL: Record<NonNullable<WizardAnswers["budget"]>, string> = {
  "under-3k": "under ₹3,000/month",
  "3k-7k": "₹3,000–7,000/month",
  "7k-15k": "₹7,000–15,000/month",
  "15k-plus": "₹15,000+/month",
};

const HOURS_GAP_LABEL: Record<NonNullable<WizardAnswers["weeklyHours"]>, string> = {
  "1-3": "1–3 hours a week",
  "4-7": "4–7 hours a week",
  "8-12": "8–12 hours a week",
  "13-plus": "13+ hours a week",
};

/** Hard-gate failures, phrased for a parent rather than as a boolean. */
function findHardBlockers(answers: WizardAnswers, sport: SportProfile): string[] {
  const name = answers.childName || "Your child";
  const { poss, plural } = pronounsFor(answers.gender);
  const out: string[] = [];

  if (sport.requiresWater && answers.waterComfort === "uncomfortable") {
    out.push(
      `${name} isn't comfortable in water yet. Learn-to-swim comes first — ${sport.name} training makes no sense before that.`
    );
  }

  if (sport.requiresContact && answers.contactComfort === "avoids") {
    out.push(
      `${sport.name} involves regular physical contact ${name} actively avoids. Forcing it early usually ends the sport, not the discomfort.`
    );
  }

  if (answers.budget && !budgetCoversMinimum(answers.budget, sport.minBudgetTier)) {
    out.push(
      `${sport.name} coaching runs ${sport.costRange} — above the ${BUDGET_GAP_LABEL[answers.budget]} you set. School and district programmes are the cheaper way in.`
    );
  }

  if (answers.age && answers.age > sport.ageWindowCutoff && isEliteAmbition(answers.ambition)) {
    out.push(
      `For the goal you picked, ${answers.age} is past the starting window in ${sport.name} — that pathway begins by ${sport.ageWindowCutoff}. To play and enjoy, still wide open.`
    );
  }

  const eliteAmbition = isEliteAmbition(answers.ambition);
  if (
    (sport.name === "Basketball" || sport.name === "Volleyball") &&
    eliteAmbition &&
    answers.age &&
    answers.age >= 13 &&
    answers.height
  ) {
    const minH =
      sport.name === "Basketball"
        ? answers.gender === "girl"
          ? 160
          : 168
        : answers.gender === "girl"
          ? 162
          : 172;
    if (answers.height < minH) {
      out.push(
        `National selection in ${sport.name} is height-driven, and at ${answers.age} ${name} ${plural ? "are" : "is"} under the ${minH}cm mark selectors work from. Not out of the sport — out of that pathway, so ${poss} goal may need rethinking.`
      );
    }
  }

  return out;
}

/**
 * Soft mismatches — the honest "where it'll be harder" half of a fit report.
 * Deliberately mirrors buildReasons(): the same dimensions, read from the
 * opposite end, so a parent never sees a trait praised in one card and
 * ignored in another.
 */
function buildGaps(
  answers: WizardAnswers,
  sport: SportProfile,
  child: ReturnType<typeof getChildDimensions>
): string[] {
  const name = answers.childName || "Your child";
  const { poss, possPronoun, obj, subj, plural } = pronounsFor(answers.gender);
  const isAre = plural ? "are" : "is";
  const gaps: string[] = [];

  // Team vs individual
  if (answers.teamIndividual !== null && dimMatch(child.individual, sport.individual) <= 0.5) {
    gaps.push(
      sport.individual >= 4
        ? `${sport.name} rests entirely on one player, and ${name} plays better with a team around ${obj}. Watch that in a trial.`
        : `In ${sport.name} wins and losses belong to the group. ${name} wants them to be ${possPronoun}.`
    );
  }

  // Energy pattern
  if (answers.energyType === "explosive" && sport.endurance >= 4 && sport.explosive <= 3) {
    // Deliberately says "stamina", not "conditioning" — this branch also fires
    // for Chess, where the long sessions are mental rather than physical.
    gaps.push(
      `${sport.name} rewards long, sustained effort; ${name} works in short bursts. Stamina trains up — expect that to be the early grind.`
    );
  } else if (answers.energyType === "endurance" && sport.explosive >= 4 && sport.endurance <= 3) {
    gaps.push(
      `${sport.name} is decided in short bursts; ${name}'s strength is staying power. Speed work comes first.`
    );
  }

  // Visual tracking
  if (child.visualTracking <= 2 && sport.visualTracking >= 4) {
    gaps.push(
      `Reading a fast-moving object is central to ${sport.name}, and it's a weak spot today. Trainable, but the first real hurdle.`
    );
  }

  // Decision style
  if (answers.decisionStyle === "strategic" && sport.reactFast >= 4) {
    gaps.push(
      `${sport.name} rarely allows time to plan — decisions are made at speed. ${name} likes to watch first.`
    );
  } else if (answers.decisionStyle === "react" && sport.reactFast <= 2) {
    // Sport-neutral on purpose: this branch fires for Chess and Swimming alike,
    // so it can't lean on board-game language.
    gaps.push(`${sport.name} rewards deliberate, planned play. ${name} acts on instinct.`);
  }

  // Focus pattern
  if (answers.focusStyle === "bursts" && sport.sustainedFocus >= 4) {
    gaps.push(
      `${sport.name} asks for unbroken concentration; ${name} focuses in 20–30 minute blocks. Test session length.`
    );
  }

  // Pressure
  if (answers.pressureResponse === "avoids" && sport.pressureTolerance >= 4) {
    gaps.push(
      `${sport.name} puts one player in full view, and ${name} would rather not be. Fine socially; limiting at tournament level.`
    );
  }

  // Repetition tolerance
  if (answers.repetitionTolerance === "low" && sport.repetitionNeed >= 4) {
    gaps.push(
      `${sport.name} progresses through months of the same drills, and ${name} needs variety. Pick a coach who mixes them up.`
    );
  }

  // Contact comfort (soft — the hard case is already a blocker)
  if (answers.contactComfort === "avoids" && sport.contactRequired >= 3 && !sport.requiresContact) {
    gaps.push(
      `${sport.name} involves regular jostling ${name} would rather avoid. Uncomfortable at first, not a dealbreaker.`
    );
  }

  // Agility
  if (child.agilityValue <= 2 && sport.agilityNeed >= 4) {
    gaps.push(
      `${sport.name} lives on quick footwork, which isn't ${name}'s strength today. Agility drills would need a permanent slot.`
    );
  }

  // Eyesight
  if (answers.eyesight === "limited" && sport.visionDemand >= 4) {
    gaps.push(
      `${sport.name} depends on sharp vision at speed. Worth an eye check before starting.`
    );
  }

  // Physical build / height
  if (answers.height) {
    if (sport.heightAdvantage === "tall" && child.heightValue <= 2) {
      gaps.push(
        `Height is a structural advantage in ${sport.name}, and ${name} ${isAre} shorter than average today. Revisit as ${subj} ${plural ? "grow" : "grows"} — it's a moving target at this age.`
      );
    } else if (sport.heightAdvantage === "short" && child.heightValue >= 4) {
      gaps.push(
        `${sport.name} favours a compact frame, and ${name} ${isAre} taller than most kids ${poss} age.`
      );
    }
    if (sport.buildPreference === "lean" && child.buildValue >= 5) {
      gaps.push(
        `${sport.name} is built around a lean, light frame. Expect conditioning to carry more of the training.`
      );
    }
  }

  // Environment
  if (
    answers.environment &&
    answers.environment !== "no-preference" &&
    sport.environmentPreference !== "either" &&
    answers.environment !== sport.environmentPreference
  ) {
    gaps.push(
      `${sport.name} is played almost entirely ${sport.environmentPreference === "indoor" ? "indoors" : "outdoors"}, and ${name} gravitates the other way. Small thing that decides whether training feels like a chore.`
    );
  }

  // Weekly time
  if (answers.weeklyHours && timeMatch(answers.weeklyHours, sport) < 1) {
    gaps.push(
      `${sport.name} needs about ${sport.minWeeklyHours} hours a week; you've set aside ${HOURS_GAP_LABEL[answers.weeklyHours]}. Enough to enjoy, tight to compete.`
    );
  }

  // Infrastructure
  const stateTier = getStateInfraTier(answers.state);
  if (answers.state && infraMatch(stateTier, sport.minCityTier) < 1) {
    gaps.push(
      `Serious ${sport.name} coaching sits in the big metros. From ${answers.state}, expect travel or a longer academy search.`
    );
  }

  // Age window (short of the hard cutoff — that case is a blocker)
  if (answers.age) {
    const [, idealMax] = sport.ageWindowIdeal;
    if (answers.age > idealMax && answers.age <= sport.ageWindowCutoff) {
      gaps.push(
        `Most who go far in ${sport.name} start by ${idealMax}; ${name} would start at ${answers.age}. Workable, but the competitive path narrows.`
      );
    }
  }

  // Relocation / specialisation reality check.
  // We no longer ask whether the family would relocate, so this states the
  // structural fact and leaves the judgement to them rather than asserting
  // what they'd be willing to do.
  if (isEliteAmbition(answers.ambition) && sport.specializationIntensity === "high") {
    gaps.push(
      `Reaching the top in ${sport.name} in India usually means relocating to the coaching. Worth deciding early if that's on the table.`
    );
  }

  return gaps;
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

/** Fit-label thresholds — shared by recommendations and parent-chosen sports. */
function fitLabelFor(score: number): FitLabel {
  return score >= 88 ? "Strong fit" : score >= 70 ? "Good fit" : "Worth exploring";
}

/**
 * Everything needed to score any sport for this child, computed once per run.
 * Shared by scoreSports() (which then filters by hard gate and ranks) and
 * scoreChosenSports() (which scores exactly the sports the parent named), so
 * both report numbers off the identical engine.
 */
function scoringContext(answers: WizardAnswers) {
  const ambitionKey =
    answers.ambition === "fun"
      ? "fun"
      : answers.ambition === "competitive"
        ? "competitive"
        : answers.ambition === "national"
          ? "national"
          : "professional";

  const weights = WEIGHTS[ambitionKey];
  return {
    weights,
    ceiling: weightCeiling(weights),
    child: getChildDimensions(answers),
    stateInfraTier: getStateInfraTier(answers.state),
  };
}

function rawScoreFor(
  answers: WizardAnswers,
  sport: SportProfile,
  ctx: ReturnType<typeof scoringContext>
): number {
  const { weights, child, stateInfraTier } = ctx;

  const dims =
    weights.individual * dimMatch(child.individual, sport.individual) +
    weights.explosive * dimMatch(child.explosive, sport.explosive) +
    weights.endurance * dimMatch(child.endurance, sport.endurance) +
    weights.visualTracking * capMatch(child.visualTracking, sport.visualTracking) +
    weights.reactFast * dimMatch(child.reactFast, sport.reactFast) +
    weights.sustainedFocus * dimMatch(child.sustainedFocus, sport.sustainedFocus) +
    weights.pressureTolerance * dimMatch(child.pressureTolerance, sport.pressureTolerance) +
    weights.repetitionNeed * capMatch(child.repetitionNeed, sport.repetitionNeed) +
    weights.contactRequired * dimMatch(child.contactRequired, sport.contactRequired) +
    weights.eyesight * capMatch(child.eyesightValue, sport.visionDemand) +
    weights.agility * capMatch(child.agilityValue, sport.agilityNeed);

  const physScore = weights.physicalMatch * physicalMatch(child, sport);
  const envScore = weights.environment * envMatch(answers.environment, sport.environmentPreference);
  const ageScore = weights.age * ageMatch(answers.age, sport, answers.ambition);
  const timeScore = weights.timeMatch * timeMatch(answers.weeklyHours, sport);
  const infraScore = weights.infrastructure * infraMatch(stateInfraTier, sport.minCityTier);
  const synergyScore = computeSynergyBonus(child, sport);
  const priorScore = computePriorSportBonus(answers.priorSports, sport);

  return (
    dims + physScore + envScore + ageScore + timeScore + infraScore + synergyScore + priorScore
  );
}

function normalisedScore(rawScore: number, ceiling: number): number {
  return Math.max(0, Math.min(100, Math.round((rawScore / ceiling) * 100)));
}

export function scoreSports(answers: WizardAnswers): SportResult[] {
  const ctx = scoringContext(answers);
  const { child, ceiling } = ctx;

  const scored = SPORT_PROFILES.filter((sport) => passesHardGates(answers, sport)).map((sport) => ({
    sport,
    rawScore: rawScoreFor(answers, sport, ctx),
  }));

  if (scored.length === 0) return [];

  // Absolute scoring: normalise against the fixed theoretical ceiling for this
  // ambition tier (a mathematically perfect dimension match), not the child's
  // own best-scoring sport. A "70" means "70% of a perfect match" for anyone,
  // not just "70% as good as this child's #1 option" — comparable across
  // children. Bonuses (synergy, prior-sport transfer) are genuine extra credit
  // that can push a strong-but-imperfect match up to 100.
  const normalised = scored
    .map((s) => ({ ...s, score: normalisedScore(s.rawScore, ceiling) }))
    .sort((a, b) => b.score - a.score);

  // Pick top 2
  const top2 = normalised.slice(0, 2);

  // Third pick: wildcard from a different primary category
  const usedCategories = new Set(top2.map((s) => s.sport.category));
  const wildcard = normalised.slice(2).find((s) => !usedCategories.has(s.sport.category));
  const third = wildcard ?? normalised[2];

  const top3 = [...top2, ...(third ? [third] : [])].slice(0, 3);

  // Thresholds calibrated empirically under absolute scoring (each sport is
  // scored independently against a fixed ceiling, so this holds regardless of
  // catalog size): well-matched archetypal profiles land 83-100, weak-signal
  // (sparse/contradictory answers) profiles land 78-81, and genuinely poor
  // wildcard picks dip into the 60s. 80/60 (carried over from max-normalization,
  // where the #1 pick was always ~100) called almost everything "Strong fit".
  // (Thresholds live in fitLabelFor, shared with parent-chosen sports.)

  // Cross-card reason dedup: dimensionally-similar sports (e.g. Badminton and
  // Table Tennis) satisfy the same reason conditions in the same order, which
  // without this would show two cards with literally identical justification
  // text. Prefer each card's reason types the earlier cards haven't already
  // used; only fall back to a repeated type if a card runs out of fresh ones.
  const usedReasonTypes = new Set<string>();
  return top3.map((s, i) => {
    const fullReasons = buildReasons(answers, s.sport, child);
    const fresh = fullReasons.filter((r) => !usedReasonTypes.has(r.type));
    const padding = fullReasons.filter((r) => usedReasonTypes.has(r.type));
    const chosen = [...fresh, ...padding].slice(0, 3);
    chosen.forEach((r) => usedReasonTypes.add(r.type));

    return {
      sport: s.sport,
      score: s.score,
      fitLabel: fitLabelFor(s.score),
      reasons: chosen.map((r) => r.text),
      isWildcard: i === 2 && s === wildcard,
    };
  });
}

// ─── Parent-chosen sports ─────────────────────────────────────────────────────

/**
 * Scores the sports the parent shortlisted — in the order they picked them,
 * capped at MAX_CONSIDERED_SPORTS — and returns a two-sided report per sport.
 *
 * Deliberately does NOT apply passesHardGates(): the parent asked about these
 * specific sports, so a gate failure is information to deliver, not grounds to
 * drop the card. The score is the same absolute 0–100 as our recommendations,
 * which makes the two sections directly comparable on the page.
 */
export function scoreChosenSports(
  answers: WizardAnswers,
  chosenNames: string[] = answers.consideringSports
): SportFitResult[] {
  if (!chosenNames?.length) return [];

  const ctx = scoringContext(answers);
  const { child, ceiling } = ctx;

  // Dedupe while preserving the parent's own ordering, then resolve to profiles.
  const sports = Array.from(new Set(chosenNames))
    .slice(0, MAX_CONSIDERED_SPORTS)
    .map((n) => SPORT_PROFILES.find((s) => s.name === n))
    .filter((s): s is SportProfile => Boolean(s));

  return sports.map((sport) => {
    const score = normalisedScore(rawScoreFor(answers, sport, ctx), ceiling);
    const blockers = findHardBlockers(answers, sport);
    const strengths = buildReasons(answers, sport, child)
      .map((r) => r.text)
      .slice(0, 4);

    return {
      sport,
      score,
      fitLabel: fitLabelFor(score),
      strengths: strengths.length ? strengths : [fallbackStrength(answers, sport)],
      // Blockers lead — a wall the family would hit outranks a soft mismatch.
      gaps: [...blockers, ...buildGaps(answers, sport, child)].slice(0, 4),
      hasBlocker: blockers.length > 0,
    };
  });
}

/**
 * Every card needs at least one honest positive. When no scoring reason fires
 * (a sparse profile, or a genuinely poor match), fall back to something true
 * from the sport data rather than inventing praise.
 */
function fallbackStrength(answers: WizardAnswers, sport: SportProfile): string {
  const name = answers.childName || "Your child";
  if (answers.age) {
    const [idealMin, idealMax] = sport.ageWindowIdeal;
    if (answers.age >= idealMin && answers.age <= idealMax) {
      return `At ${answers.age}, ${name} is inside the usual starting window for ${sport.name}. Timing isn't working against you.`;
    }
  }
  if (sport.minBudgetTier === "under-3k") {
    return `${sport.name} is among the cheapest sports to try — ${sport.costRange}, cheaper still through school and district programmes.`;
  }
  return `${sport.name} runs ${sport.costRange} and about ${sport.minWeeklyHours} hours a week. A trial class tells you more than any score.`;
}
