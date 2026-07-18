import type { FitLabel, SportProfile, SportResult, WizardAnswers } from "../types";
import { SPORT_PROFILES } from "../data/sportProfiles";

// ─── Answer → Dimension value maps (1–5 scale) ───────────────────────────────

function getChildDimensions(a: WizardAnswers) {
  return {
    individual: a.teamIndividual ?? 3,
    explosive: a.energyType === "explosive" ? 5 : a.energyType === "endurance" ? 1 : 3,
    endurance: a.energyType === "endurance" ? 5 : a.energyType === "explosive" ? 1 : 3,
    visualTracking: a.visualTracking === "strong" ? 5 : a.visualTracking === "moderate" ? 3 : 1,
    reactFast: a.decisionStyle === "react" ? 5 : a.decisionStyle === "strategic" ? 1 : 3,
    sustainedFocus: a.focusStyle === "sustained" ? 5 : a.focusStyle === "bursts" ? 1 : 3,
    pressureTolerance: a.pressureResponse === "thrives" ? 5 : a.pressureResponse === "manages" ? 3 : 1,
    repetitionNeed: a.repetitionTolerance === "high" ? 5 : a.repetitionTolerance === "low" ? 1 : 3,
    contactRequired: a.contactComfort === "loves" ? 5 : a.contactComfort === "neutral" ? 3 : 1,
    eyesightValue: a.eyesight === "sharp" ? 5 : a.eyesight === "corrected" ? 3 : a.eyesight === "limited" ? 1 : 3,
    agilityValue: a.agility === "high" ? 5 : a.agility === "moderate" ? 3 : a.agility === "low" ? 1 : 3,
    // Physical traits — derived from numeric height/weight
    buildValue: (() => {
      if (a.height && a.weight) {
        const bmi = a.weight / ((a.height / 100) ** 2);
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
    budget: 0.08,
    timeMatch: 0.03,
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
    budget: 0.05,
    timeMatch: 0.05,
  },
  national: {
    individual: 0.09,
    explosive: 0.10,
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
    age: 0.10,
    budget: 0.01,
    timeMatch: 0.07,
  },
  professional: {
    individual: 0.06,
    explosive: 0.10,
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
    environment: 0.00,
    age: 0.10,
    budget: 0.00,
    timeMatch: 0.08,
  },
} as const;

// ─── Budget tier ordering ─────────────────────────────────────────────────────

const BUDGET_ORDER = ["under-3k", "3k-7k", "7k-15k", "15k-plus"] as const;

function budgetCoversMinimum(
  parentBudget: WizardAnswers["budget"],
  sportMin: SportProfile["minBudgetTier"],
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
  const buildTarget = sport.buildPreference === "lean" ? 1 : sport.buildPreference === "stocky" ? 5 : 3;
  const heightTarget = sport.heightAdvantage === "short" ? 1 : sport.heightAdvantage === "tall" ? 5 : 3;
  return (dimMatch(child.buildValue, buildTarget) + dimMatch(child.heightValue, heightTarget)) / 2;
}

// ─── Environment match ────────────────────────────────────────────────────────

function envMatch(childPref: WizardAnswers["environment"], sportPref: SportProfile["environmentPreference"]): number {
  if (!childPref || childPref === "no-preference" || sportPref === "either") return 1;
  return childPref === sportPref ? 1 : 0.3;
}

// ─── Time availability match ─────────────────────────────────────────────────

function timeMatch(childHours: WizardAnswers["weeklyHours"], sport: SportProfile): number {
  if (!childHours) return 0.7;
  const childVal = childHours === "1-3" ? 2 : childHours === "4-7" ? 5 : childHours === "8-12" ? 10 : 15;
  if (childVal >= sport.minWeeklyHours) return 1.0;
  return Math.max(0.15, childVal / sport.minWeeklyHours);
}

// ─── Age window match ─────────────────────────────────────────────────────────
// Penalty per year of overshoot scales by BOTH ambition and age-start sensitivity.
// critical (gymnastics): window closes fast — 2× the penalty multiplier.
// flexible (chess, shooting, cricket): late starts are viable — 0.4× multiplier.

function ageMatch(age: number | null, sport: SportProfile, ambition: WizardAnswers["ambition"]): number {
  if (!age) return 0.7;
  const [idealMin, idealMax] = sport.ageWindowIdeal;
  if (age >= idealMin && age <= idealMax) return 1;
  if (age < idealMin) return 0.9; // started before ideal window — still fine
  if (age <= sport.ageWindowCutoff) {
    const overshoot = age - idealMax;
    const sensitivityMult =
      sport.ageStartSensitivity === "critical" ? 2.2 :
      sport.ageStartSensitivity === "flexible" ? 0.4 : 1.0;
    const basePerYear = ambition === "professional" || ambition === "national" ? 0.12 : 0.06;
    const penaltyPerYear = basePerYear * sensitivityMult;
    const minScore =
      sport.ageStartSensitivity === "critical" ? 0.05 :
      sport.ageStartSensitivity === "flexible" ? 0.45 : 0.2;
    return Math.max(minScore, 1 - overshoot * penaltyPerYear);
  }
  if (ambition === "professional" || ambition === "national") return 0.05;
  return 0.4;
}

// ─── Synergy bonuses ─────────────────────────────────────────────────────────
// Compound bonuses for attribute combinations that reinforce each other beyond
// what individual dimension scores already capture.

const RACKET_SPORT_NAMES = new Set(["Badminton", "Table Tennis", "Tennis"]);

function computeSynergyBonus(
  child: ReturnType<typeof getChildDimensions>,
  sport: SportProfile,
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
  if (child.reactFast <= 2 && child.sustainedFocus >= 4 && sport.reactFast <= 2 && sport.sustainedFocus >= 4) {
    bonus += 0.04;
  }
  return bonus;
}

// ─── Prior sport skill-transfer bonus ────────────────────────────────────────
// Skills from sports a child has already played transfer meaningfully to
// adjacent sports. Map is keyed by the sport being scored; values are prior
// sports whose practice builds transferable skills.

const PRIOR_SPORT_TRANSFERS: Record<string, string[]> = {
  "Badminton":    ["Table Tennis", "Tennis"],
  "Table Tennis": ["Badminton", "Tennis"],
  "Tennis":       ["Badminton", "Table Tennis"],
  "Basketball":   ["Volleyball", "Football", "Cricket"],
  "Volleyball":   ["Basketball", "Football"],
  "Football":     ["Basketball", "Kabaddi", "Athletics", "Cricket"],
  "Cricket":      ["Athletics", "Football", "Volleyball"],
  "Athletics":    ["Football", "Swimming", "Cricket", "Gymnastics"],
  "Swimming":     ["Athletics", "Gymnastics"],
  "Gymnastics":   ["Athletics", "Swimming"],
  "Kabaddi":      ["Football", "Wrestling"],
  "Wrestling":    ["Kabaddi"],
  "Chess":        [],
  "Shooting":     [],
};

function computePriorSportBonus(priorSports: string[], sport: SportProfile): number {
  if (!priorSports.length) return 0;
  if (priorSports.includes(sport.name)) return 0.05; // retaking own sport
  const transfersFrom = PRIOR_SPORT_TRANSFERS[sport.name] ?? [];
  return priorSports.some((ps) => transfersFrom.includes(ps)) ? 0.025 : 0;
}

// ─── Reasons generator ────────────────────────────────────────────────────────

function buildReasons(
  answers: WizardAnswers,
  sport: SportProfile,
  child: ReturnType<typeof getChildDimensions>,
): string[] {
  const name = answers.childName || "Your child";
  const reasons: string[] = [];

  // Personality match reasons
  const indMatch = dimMatch(child.individual, sport.individual);
  if (indMatch >= 0.75) {
    if (sport.individual >= 4) {
      reasons.push(
        `${name}'s preference for individual competition is a natural fit — every point in ${sport.name} is entirely theirs to win or lose.`,
      );
    } else {
      reasons.push(
        `${name}'s team-oriented nature suits ${sport.name} well — the sport is built around collective effort and shared momentum.`,
      );
    }
  }

  if (answers.energyType && dimMatch(child.explosive, sport.explosive) >= 0.75) {
    if (answers.energyType === "explosive" && sport.explosive >= 4) {
      reasons.push(
        `Their explosive bursts of energy are exactly what ${sport.name} demands — speed and power define the sport.`,
      );
    } else if (answers.energyType === "endurance" && sport.endurance >= 4) {
      reasons.push(
        `Their ability to sustain effort over time is a key asset in ${sport.name}, which rewards consistent physical output.`,
      );
    }
  }

  if (
    answers.visualTracking === "strong" &&
    sport.visualTracking >= 4 &&
    dimMatch(child.visualTracking, sport.visualTracking) >= 0.75
  ) {
    reasons.push(
      `Strong visual tracking is a real advantage in ${sport.name} — reacting to a fast-moving object is central to the game.`,
    );
  }

  if (
    answers.decisionStyle === "react" &&
    sport.reactFast >= 4 &&
    dimMatch(child.reactFast, sport.reactFast) >= 0.75
  ) {
    reasons.push(
      `${name}'s instinct to react fast and trust their read suits ${sport.name}'s pace — there's rarely time to overthink.`,
    );
  } else if (
    answers.decisionStyle === "strategic" &&
    sport.reactFast <= 2 &&
    dimMatch(child.reactFast, sport.reactFast) >= 0.75
  ) {
    reasons.push(
      `${name}'s strategic thinking style is well-matched to ${sport.name}, where planning several moves ahead makes a real difference.`,
    );
  }

  if (answers.pressureResponse === "thrives" && sport.pressureTolerance >= 4) {
    reasons.push(
      `${name} thrives under the spotlight — ${sport.name} puts the individual in full view, with no team to share the moment.`,
    );
  }

  // Physical match reason
  const phys = physicalMatch(child, sport);
  if (phys >= 0.8 && answers.height && (sport.buildPreference !== "any" || sport.heightAdvantage !== "any")) {
    const avg = answers.age ? Math.min(175, 85 + answers.age * 5.5) : 140;
    const isTall = answers.height > avg * 1.07;
    const isShort = answers.height < avg * 0.93;
    const isStocky = answers.height && answers.weight
      ? answers.weight / ((answers.height / 100) ** 2) > 22
      : false;
    if (sport.heightAdvantage === "tall" && isTall) {
      reasons.push(
        `Being taller than most kids their age is a genuine structural advantage in ${sport.name}.`,
      );
    } else if (sport.heightAdvantage === "short" && isShort) {
      reasons.push(
        `A compact build is an asset in ${sport.name} — lower centre of gravity and quicker rotation are real advantages.`,
      );
    } else if (sport.buildPreference === "stocky" && isStocky) {
      reasons.push(
        `${name}'s strong, stocky build suits the physical demands of ${sport.name}.`,
      );
    }
  }

  // Eyesight reason
  if (answers.eyesight === "sharp" && sport.visionDemand >= 4) {
    reasons.push(
      `${name}'s sharp eyesight is a real asset in ${sport.name} — tracking fast-moving objects accurately is central to the sport.`,
    );
  } else if (answers.eyesight === "limited" && sport.visionDemand <= 2) {
    reasons.push(
      `${sport.name} places very little demand on eyesight — ${name} can compete on equal terms regardless of vision.`,
    );
  }

  // Agility & flexibility reason
  if (answers.agility === "high" && sport.agilityNeed >= 4 && dimMatch(child.agilityValue, sport.agilityNeed) >= 0.75) {
    reasons.push(
      `${name}'s natural agility and flexibility are a genuine advantage in ${sport.name}, which rewards quick footwork and range of movement.`,
    );
  } else if (answers.agility === "low" && sport.agilityNeed <= 2) {
    reasons.push(
      `${sport.name} doesn't require high agility — ${name} can succeed here through strength, strategy, and consistency.`,
    );
  }

  // Time availability reason
  if (answers.weeklyHours) {
    const childVal = answers.weeklyHours === "1-3" ? 2 : answers.weeklyHours === "4-7" ? 5 : answers.weeklyHours === "8-12" ? 10 : 15;
    if (childVal >= sport.minWeeklyHours) {
      reasons.push(
        `Your available training time comfortably covers what ${sport.name} requires — ${sport.minWeeklyHours}+ hours a week is enough to progress.`,
      );
    }
  }

  // Budget + location reason (always include as a practical anchor)
  if (answers.state && answers.budget) {
    reasons.push(
      `Your budget covers quality training in ${answers.state} — ${sport.name} is well-supported there at the ${sport.costRange} level.`,
    );
  } else if (answers.budget) {
    reasons.push(
      `Your budget aligns with what quality ${sport.name} training costs — ${sport.costRange} for a good academy.`,
    );
  }

  // Age window reason
  if (answers.age) {
    const [idealMin, idealMax] = sport.ageWindowIdeal;
    if (answers.age >= idealMin && answers.age <= idealMax) {
      reasons.push(
        `At ${answers.age}, ${name} is in the ideal window to start ${sport.name} — early enough to build a strong foundation.`,
      );
    }
  }

  // Synergy reasons — only fire when the compound actually scored
  if (RACKET_SPORT_NAMES.has(sport.name) && child.explosive >= 4 && child.agilityValue >= 4) {
    reasons.push(
      `${name}'s combination of explosive energy and high agility is a particularly powerful pairing for ${sport.name} — elite performance here demands exactly both.`,
    );
  }
  if (child.visualTracking >= 4 && child.eyesightValue >= 4 && sport.visionDemand >= 4) {
    reasons.push(
      `Sharp eyesight combined with strong visual tracking gives ${name} a compound edge in ${sport.name} — the sport rewards this pairing more than either trait alone.`,
    );
  }
  if (child.reactFast <= 2 && child.sustainedFocus >= 4 && sport.reactFast <= 2 && sport.sustainedFocus >= 4) {
    reasons.push(
      `${name}'s strategic thinking and deep focus are exactly what ${sport.name} rewards — patience and precision matter far more than reaction speed here.`,
    );
  }

  // Prior sport transfer reason
  const transfersFrom = PRIOR_SPORT_TRANSFERS[sport.name] ?? [];
  const matchingPrior = answers.priorSports.find((ps) => transfersFrom.includes(ps));
  if (matchingPrior) {
    reasons.push(
      `${name}'s experience in ${matchingPrior} transfers directly to ${sport.name} — the movement patterns and skills overlap more than most parents realise.`,
    );
  }

  // Return top 3 reasons (most specific first)
  return reasons.slice(0, 3);
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
  if (
    answers.age &&
    answers.age > sport.ageWindowCutoff &&
    (answers.ambition === "professional" || answers.ambition === "national")
  ) return false;

  // ── Biological gates ──────────────────────────────────────────────────────
  // Shooting: limited vision is a federation disqualifier at all levels
  if (sport.name === "Shooting" && answers.eyesight === "limited") return false;

  // Basketball: height lower bound — national/professional + age 13+
  if (
    sport.name === "Basketball" &&
    (answers.ambition === "national" || answers.ambition === "professional") &&
    answers.age && answers.age >= 13 && answers.height
  ) {
    const minH = answers.gender === "girl" ? 160 : 168;
    if (answers.height < minH) return false;
  }

  // Volleyball: height lower bound — national/professional + age 13+
  if (
    sport.name === "Volleyball" &&
    (answers.ambition === "national" || answers.ambition === "professional") &&
    answers.age && answers.age >= 13 && answers.height
  ) {
    const minH = answers.gender === "girl" ? 162 : 172;
    if (answers.height < minH) return false;
  }

  // Gymnastics: height upper bound — competitive+ + age 13+
  if (
    sport.name === "Gymnastics" &&
    answers.ambition !== "fun" &&
    answers.age && answers.age >= 13 && answers.height &&
    answers.height > 168
  ) return false;

  // Gymnastics: heavy build — competitive+ + age 13+
  if (
    sport.name === "Gymnastics" &&
    answers.ambition !== "fun" &&
    answers.age && answers.age >= 13 &&
    answers.height && answers.weight
  ) {
    const bmi = answers.weight / ((answers.height / 100) ** 2);
    if (bmi > 22) return false;
  }

  return true;
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

export function scoreSports(answers: WizardAnswers): SportResult[] {
  const ambitionKey =
    answers.ambition === "fun"
      ? "fun"
      : answers.ambition === "competitive"
        ? "competitive"
        : answers.ambition === "national"
          ? "national"
          : "professional";

  const weights = WEIGHTS[ambitionKey];
  const child = getChildDimensions(answers);

  const scored = SPORT_PROFILES.filter((sport) => passesHardGates(answers, sport)).map((sport) => {
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
    const synergyScore = computeSynergyBonus(child, sport);
    const priorScore = computePriorSportBonus(answers.priorSports, sport);

    const total = dims + physScore + envScore + ageScore + timeScore + synergyScore + priorScore;

    return { sport, rawScore: total };
  });

  if (scored.length === 0) return [];

  // Normalise to 0–100
  const max = Math.max(...scored.map((s) => s.rawScore));
  const normalised = scored
    .map((s) => ({ ...s, score: Math.round((s.rawScore / max) * 100) }))
    .sort((a, b) => b.score - a.score);

  // Pick top 2
  const top2 = normalised.slice(0, 2);

  // Third pick: wildcard from a different primary category
  const usedCategories = new Set(top2.map((s) => s.sport.category));
  const wildcard = normalised
    .slice(2)
    .find((s) => !usedCategories.has(s.sport.category));
  const third = wildcard ?? normalised[2];

  const top3 = [...top2, ...(third ? [third] : [])].slice(0, 3);

  const fitLabel = (score: number): FitLabel =>
    score >= 80 ? "Strong fit" : score >= 60 ? "Good fit" : "Worth exploring";

  return top3.map((s, i) => ({
    sport: s.sport,
    score: s.score,
    fitLabel: fitLabel(s.score),
    reasons: buildReasons(answers, s.sport, child),
    isWildcard: i === 2 && s === wildcard,
  }));
}
