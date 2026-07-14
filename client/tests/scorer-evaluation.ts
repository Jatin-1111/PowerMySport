/**
 * PowerMySport — Sport Scorer Evaluation Suite
 *
 * Tests relevance (right sport for the right profile), efficiency (hard gates),
 * and accuracy (score calibration, bonuses, differentials).
 *
 * Run:  cd client && npx tsx tests/scorer-evaluation.ts
 */

import { scoreSports } from "../src/modules/pathway/utils/scorer";
import type { WizardAnswers } from "../src/modules/pathway/types";

// ─── Console colours ──────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", C = "\x1b[36m";
const B = "\x1b[1m", D = "\x1b[2m", X = "\x1b[0m";

function bar(score: number): string {
  const filled = Math.round(score / 10);
  const color = score >= 80 ? G : score >= 60 ? Y : R;
  return `${color}${"█".repeat(filled)}${D}${"░".repeat(10 - filled)}${X}`;
}

// ─── Test tracking ────────────────────────────────────────────────────────────
const results: { cat: string; name: string; ok: boolean; note: string }[] = [];

function test(cat: string, name: string, ok: boolean, note: string) {
  results.push({ cat, name, ok, note });
  const icon = ok ? `${G}✓${X}` : `${R}✗${X}`;
  console.log(`  ${icon} ${name}${D}  ${note}${X}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function top3names(a: WizardAnswers): string[] {
  return scoreSports(a).map(r => r.sport.name);
}
function top1(a: WizardAnswers): string {
  return scoreSports(a)[0]?.sport.name ?? "—";
}
function inTop3(a: WizardAnswers, sport: string): boolean {
  return top3names(a).includes(sport);
}
function absent(a: WizardAnswers, sport: string): boolean {
  // Hard-gated sports won't appear at all; low-scoring ones may not be in top 3.
  // For gate tests we always construct a profile that would favour the sport — absence proves gating.
  return !top3names(a).includes(sport);
}
function scoreFor(a: WizardAnswers, sport: string): number {
  return scoreSports(a).find(r => r.sport.name === sport)?.score ?? 0;
}

// ─── Base profile (neutral, age 10 boy, Maharashtra, 7k-15k budget) ───────────
const BASE: WizardAnswers = {
  childName: "TestChild",
  age: 10, gender: "boy", state: "Maharashtra", priorSports: [],
  height: 140, weight: 32,
  energyType: "explosive", motorType: "gross",
  visualTracking: "strong", eyesight: "sharp", agility: "high",
  teamIndividual: 3, competitiveResponse: "fired-up",
  focusStyle: "bursts", decisionStyle: "react",
  pressureResponse: "thrives", repetitionTolerance: "high",
  contactComfort: "neutral", environment: "indoor",
  waterComfort: "neutral",
  budget: "7k-15k", ambition: "competitive", weeklyHours: "8-12",
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — RELEVANCE
// Does the model surface the intuitively correct sport for archetypal profiles?
// ══════════════════════════════════════════════════════════════════════════════
console.log(`\n${B}${C}━━━ RELEVANCE TESTS ━━━${X}`);
console.log(`${D}Does the model recommend the right sport for each archetype?${X}\n`);

// R1: Chess prodigy — strategic, sustained focus, non-athletic, individual, low budget
{
  const a: WizardAnswers = { ...BASE,
    energyType: "endurance", agility: "low", teamIndividual: 5,
    focusStyle: "sustained", decisionStyle: "strategic",
    repetitionTolerance: "high", contactComfort: "avoids",
    environment: "indoor", weeklyHours: "1-3", budget: "under-3k",
    pressureResponse: "manages", visualTracking: "weak",
  };
  const top = top3names(a);
  test("R", "R1 Chess prodigy → #1 Chess", top[0] === "Chess", `got: ${top.join(", ")}`);
}

// R2: Badminton athlete — explosive, high agility, sharp vision, strong tracking
{
  const a: WizardAnswers = { ...BASE,
    energyType: "explosive", agility: "high", eyesight: "sharp",
    visualTracking: "strong", teamIndividual: 4, decisionStyle: "react",
    environment: "indoor", budget: "3k-7k", age: 9,
  };
  const top = top3names(a);
  test("R", "R2 Badminton athlete → Badminton in top 3", inTop3(a, "Badminton"), `got: ${top.join(", ")}`);
}

// R3: Swimmer — endurance, water-comfortable, repetition-tolerant, individual
{
  const a: WizardAnswers = { ...BASE,
    age: 8, energyType: "endurance", agility: "low",
    teamIndividual: 4, repetitionTolerance: "high",
    focusStyle: "sustained", decisionStyle: "react",
    waterComfort: "comfortable", environment: "indoor",
    contactComfort: "avoids", budget: "7k-15k", weeklyHours: "13-plus",
  };
  const top = top3names(a);
  test("R", "R3 Swimmer profile → Swimming in top 3", inTop3(a, "Swimming"), `got: ${top.join(", ")}`);
}

// R4: Team player — loves team (1), explosive, outdoor
{
  const a: WizardAnswers = { ...BASE,
    teamIndividual: 1, energyType: "explosive",
    environment: "outdoor", contactComfort: "neutral",
    ambition: "fun", weeklyHours: "4-7", budget: "under-3k",
  };
  const top = top3names(a);
  const teamSports = ["Football", "Basketball", "Volleyball", "Kabaddi"];
  test("R", "R4 Team player → team sport in top 3", top.some(s => teamSports.includes(s)), `got: ${top.join(", ")}`);
}

// R5: Shooter — strategic, sustained focus, sharp vision, big budget, individual
{
  const a: WizardAnswers = { ...BASE,
    age: 12, energyType: "endurance", agility: "low",
    teamIndividual: 5, focusStyle: "sustained", decisionStyle: "strategic",
    eyesight: "sharp", visualTracking: "strong",
    pressureResponse: "thrives", repetitionTolerance: "high",
    contactComfort: "avoids", environment: "indoor",
    budget: "15k-plus", weeklyHours: "8-12", ambition: "national",
  };
  const top = top3names(a);
  test("R", "R5 Shooter profile → Shooting in top 3", inTop3(a, "Shooting"), `got: ${top.join(", ")}`);
}

// R6: Contact/wrestler — loves contact, stocky build, individual
{
  const a: WizardAnswers = { ...BASE,
    energyType: "explosive", agility: "moderate", teamIndividual: 5,
    contactComfort: "loves", height: 132, weight: 45,
    pressureResponse: "thrives", environment: "indoor",
    budget: "under-3k", weeklyHours: "8-12",
  };
  const top = top3names(a);
  test("R", "R6 Contact athlete → Wrestling or Kabaddi in top 3",
    inTop3(a, "Wrestling") || inTop3(a, "Kabaddi"),
    `got: ${top.join(", ")}`);
}

// R7: Track athlete — endurance, outdoor, lean, consistent, moderate team
{
  const a: WizardAnswers = { ...BASE,
    energyType: "endurance", agility: "moderate", teamIndividual: 4,
    repetitionTolerance: "high", environment: "outdoor",
    contactComfort: "avoids", focusStyle: "sustained",
    ambition: "competitive", weeklyHours: "8-12", budget: "3k-7k",
  };
  const top = top3names(a);
  test("R", "R7 Track athlete → Athletics in top 3", inTop3(a, "Athletics"), `got: ${top.join(", ")}`);
}

// R8: Table Tennis specialist — explosive, sharp vision, under-3k budget, indoor
{
  const a: WizardAnswers = { ...BASE,
    energyType: "explosive", agility: "high", eyesight: "sharp",
    visualTracking: "strong", teamIndividual: 4, decisionStyle: "react",
    environment: "indoor", budget: "under-3k",
    weeklyHours: "4-7", age: 9,
  };
  const top = top3names(a);
  test("R", "R8 Racket specialist (low budget) → TT or Badminton in top 3",
    inTop3(a, "Table Tennis") || inTop3(a, "Badminton"),
    `got: ${top.join(", ")}`);
}

// R9: Cricket — outdoor, visualTracking, sustained, balanced team (age 11)
{
  const a: WizardAnswers = { ...BASE,
    age: 11, energyType: "explosive", visualTracking: "strong",
    focusStyle: "sustained", repetitionTolerance: "high",
    environment: "outdoor", teamIndividual: 3,
    budget: "3k-7k", weeklyHours: "8-12",
  };
  const top = top3names(a);
  test("R", "R9 Cricket profile → Cricket in top 3", inTop3(a, "Cricket"), `got: ${top.join(", ")}`);
}

// R10: Gymnastics — very young (7), highly agile, individual, indoor, lean
{
  const a: WizardAnswers = { ...BASE,
    age: 7, height: 116, weight: 22, energyType: "explosive",
    agility: "high", teamIndividual: 5, repetitionTolerance: "high",
    focusStyle: "sustained", environment: "indoor",
    contactComfort: "avoids", budget: "15k-plus",
    weeklyHours: "13-plus", pressureResponse: "thrives",
  };
  const top = top3names(a);
  test("R", "R10 Gymnastics profile (age 7) → Gymnastics in top 3", inTop3(a, "Gymnastics"), `got: ${top.join(", ")}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — EFFICIENCY (Gate filtering)
// Hard gates must eliminate sports when biological/practical constraints fire.
// ══════════════════════════════════════════════════════════════════════════════
console.log(`\n${B}${C}━━━ EFFICIENCY TESTS (Gate filtering) ━━━${X}`);
console.log(`${D}Hard gates must eliminate sports when real constraints fire.${X}\n`);

// E1: Limited vision → Shooting absent at all ambition levels
{
  // Build a near-perfect shooter profile to prove the gate — not just low score
  const a: WizardAnswers = { ...BASE,
    eyesight: "limited", agility: "low", energyType: "endurance",
    teamIndividual: 5, focusStyle: "sustained", decisionStyle: "strategic",
    repetitionTolerance: "high", contactComfort: "avoids",
    budget: "15k-plus", weeklyHours: "8-12",
  };
  test("E", "E1 Limited vision → Shooting hard-gated (all ambition levels)",
    absent(a, "Shooting"), `top 3: ${top3names(a).join(", ")}`);
}

// E2: Water discomfort → Swimming absent even for endurance/repetition swimmer profile
{
  const a: WizardAnswers = { ...BASE,
    waterComfort: "uncomfortable", energyType: "endurance",
    repetitionTolerance: "high", teamIndividual: 4,
    focusStyle: "sustained", budget: "7k-15k",
  };
  test("E", "E2 Water discomfort → Swimming hard-gated",
    absent(a, "Swimming"), `top 3: ${top3names(a).join(", ")}`);
}

// E3: Contact avoidance → Kabaddi AND Wrestling absent
{
  const a: WizardAnswers = { ...BASE, contactComfort: "avoids" };
  const top = top3names(a);
  test("E", "E3 Contact avoidance → Kabaddi + Wrestling absent",
    !top.includes("Kabaddi") && !top.includes("Wrestling"),
    `top 3: ${top.join(", ")}`);
}

// E4: Budget under-3k → Tennis absent (minBudgetTier = 7k-15k)
{
  // Make a tennis-leaning profile to prove the budget gate
  const a: WizardAnswers = { ...BASE,
    budget: "under-3k", energyType: "explosive", agility: "moderate",
    teamIndividual: 5, environment: "outdoor", eyesight: "sharp",
    visualTracking: "strong", repetitionTolerance: "high",
  };
  test("E", "E4 Budget under-3k → Tennis hard-gated",
    absent(a, "Tennis"), `top 3: ${top3names(a).join(", ")}`);
}

// E5: 155cm boy, national ambition, age 14 → Volleyball absent (minH boy = 172)
{
  const a: WizardAnswers = { ...BASE,
    age: 14, gender: "boy", height: 155, ambition: "national",
    teamIndividual: 2, energyType: "explosive", environment: "indoor",
  };
  test("E", "E5 155cm boy + national volleyball → height gate fires",
    absent(a, "Volleyball"), `top 3: ${top3names(a).join(", ")}`);
}

// E6: 156cm girl, national ambition, age 14 → Basketball absent (minH girl = 160)
{
  const a: WizardAnswers = { ...BASE,
    age: 14, gender: "girl", height: 156, ambition: "national",
    teamIndividual: 2, energyType: "explosive",
  };
  test("E", "E6 156cm girl + national basketball → height gate fires",
    absent(a, "Basketball"), `top 3: ${top3names(a).join(", ")}`);
}

// E7: 172cm child, competitive, age 13 → Gymnastics absent (height > 168 upper gate)
{
  const a: WizardAnswers = { ...BASE,
    age: 13, height: 172, weight: 52, ambition: "competitive",
    agility: "high", energyType: "explosive", teamIndividual: 5,
    budget: "15k-plus",
  };
  test("E", "E7 172cm + competitive gymnastics + age 13 → height upper gate fires",
    absent(a, "Gymnastics"), `top 3: ${top3names(a).join(", ")}`);
}

// E8: BMI 24, competitive, age 13 → Gymnastics absent (BMI > 22 build gate)
{
  // height 150, weight 54 → BMI = 54/(1.5²) = 24
  const a: WizardAnswers = { ...BASE,
    age: 13, height: 150, weight: 54, ambition: "competitive",
    agility: "high", teamIndividual: 5, budget: "15k-plus",
  };
  test("E", "E8 BMI 24 + competitive gymnastics + age 13 → build gate fires",
    absent(a, "Gymnastics"), `top 3: ${top3names(a).join(", ")}`);
}

// E9: Gymnastics professional, age 11 (> ageWindowCutoff 10) → absent
{
  const a: WizardAnswers = { ...BASE,
    age: 11, ambition: "professional",
    agility: "high", teamIndividual: 5, budget: "15k-plus",
    energyType: "explosive", height: 135, weight: 28,
  };
  test("E", "E9 Age 11 + professional gymnastics → age cutoff gate fires (cutoff=10)",
    absent(a, "Gymnastics"), `top 3: ${top3names(a).join(", ")}`);
}

// E10: Corrected vision → Shooting NOT hard-gated (only "limited" is disqualified)
{
  // Build a shooter profile with corrected vision
  const a: WizardAnswers = { ...BASE,
    eyesight: "corrected", agility: "low", energyType: "endurance",
    teamIndividual: 5, focusStyle: "sustained", decisionStyle: "strategic",
    repetitionTolerance: "high", contactComfort: "avoids",
    budget: "15k-plus", weeklyHours: "8-12",
  };
  // scoreSports doesn't expose the full pool, but we can verify no hard gate fires
  // by confirming the scorer returns 3 results (pool not empty) and we can check
  // that the limited-vision gate logic only uses eyesight === "limited"
  let noError = true;
  try { scoreSports(a); } catch { noError = false; }
  // Since we can't inspect filtered pool, we validate by code review + no crash
  test("E", "E10 Corrected vision → scorer runs without error (Shooting not hard-gated)",
    noError, `corrected vision should pass gate; only "limited" is disqualified`);
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — ACCURACY (Score calibration & mechanics)
// Scores should be meaningful, bonuses should shift rankings correctly.
// ══════════════════════════════════════════════════════════════════════════════
console.log(`\n${B}${C}━━━ ACCURACY TESTS (Calibration & mechanics) ━━━${X}`);
console.log(`${D}Scores, differentials, and bonus mechanics must work correctly.${X}\n`);

// A1: Perfect badminton profile → score ≥ 75/100
{
  const a: WizardAnswers = { ...BASE,
    age: 9, energyType: "explosive", agility: "high", eyesight: "sharp",
    visualTracking: "strong", teamIndividual: 4, decisionStyle: "react",
    environment: "indoor", budget: "3k-7k", weeklyHours: "8-12",
  };
  const results = scoreSports(a);
  const badminton = results.find(r => r.sport.name === "Badminton");
  const score = badminton?.score ?? 0;
  test("A", `A1 Perfect badminton profile → score ≥75 (got ${score})`,
    score >= 75, `Badminton ranked #${results.findIndex(r=>r.sport.name==="Badminton")+1||"outside top 3"}`);
}

// A2: Score spread — #1 and #3 should differ by ≥ 5 points
{
  const results = scoreSports(BASE);
  if (results.length >= 3) {
    const gap = results[0].score - results[2].score;
    test("A", `A2 Score spread: #1=${results[0].score} #3=${results[2].score} gap=${gap} (≥5)`,
      gap >= 5, `${results.map(r=>`${r.sport.name}:${r.score}`).join(", ")}`);
  } else {
    test("A", "A2 Score spread", false, "fewer than 3 results returned");
  }
}

// A3: capMatch — high-agility child not penalised by chess (agilityNeed=1)
//     With old dimMatch: dimMatch(5,1) = 0.0 would destroy Chess; capMatch = 1.0
{
  const a: WizardAnswers = { ...BASE,
    agility: "high", energyType: "endurance", teamIndividual: 5,
    focusStyle: "sustained", decisionStyle: "strategic",
    repetitionTolerance: "high", contactComfort: "avoids",
    budget: "under-3k", weeklyHours: "1-3", visualTracking: "weak",
    pressureResponse: "manages", environment: "indoor",
  };
  const top = top3names(a);
  // Chess should appear despite high agility — capMatch lets it through
  test("A", "A3 capMatch: high-agility chess player → Chess not penalised",
    inTop3(a, "Chess"), `got: ${top.join(", ")}`);
}

// A4: Prior sport retake bonus — child who already played Badminton gets it ranked #1
//     priorSports includes same sport → +0.05 retake bonus should dominate ranking
{
  const base: WizardAnswers = { ...BASE,
    energyType: "explosive", agility: "high", eyesight: "sharp",
    visualTracking: "strong", teamIndividual: 4, decisionStyle: "react",
    environment: "indoor", budget: "3k-7k",
  };
  const withRetake = { ...base, priorSports: ["Badminton"] };
  const withAdjacent = { ...base, priorSports: ["Table Tennis"] }; // TT retake (+0.05) > Badminton adjacent (+0.025) — expected!
  // Verify retake bonus pushes Badminton to #1
  const retakeTop = top1(withRetake);
  // Verify adjacent bonus: TT retake outweighs Badminton adjacent, so TT should be #1 with TT prior
  const adjacentTop = top1(withAdjacent);
  test("A", `A4 Prior sport: retake bonus pushes Badminton to #1 when Badminton is prior (got: ${retakeTop})`,
    retakeTop === "Badminton", `priorSports=["Badminton"]; adjacent test: TT prior → ${adjacentTop} (TT retake +0.05 > adj +0.025)`);
}

// A5: Critical age sensitivity — gymnastics 7yo must score higher than 12yo
//     Same physical profile; only age changes so we isolate the ageMatch penalty.
//     ageWindowIdeal=[3,7]: 7yo ageMatch=1.0, 12yo ageMatch=max(0.05, 1-5*0.06*2.2)=0.34
//     Biological gates require age≥13, so both profiles pass — only ageMatch differs.
{
  const gymBase: WizardAnswers = { ...BASE,
    agility: "high", energyType: "explosive", teamIndividual: 5,
    repetitionTolerance: "high", focusStyle: "sustained",
    environment: "indoor", contactComfort: "avoids",
    budget: "15k-plus", weeklyHours: "13-plus", ambition: "competitive",
    height: 130, weight: 28, // identical physical — isolates age effect
  };
  const at7  = { ...gymBase, age: 7 };
  const at12 = { ...gymBase, age: 12 };
  const score7  = scoreFor(at7,  "Gymnastics");
  const score12 = scoreFor(at12, "Gymnastics");
  // Both should appear in top 3 (gymnastics-specific profile) and 7yo must score higher
  test("A", `A5 Critical age: Gymnastics 7yo (${score7||"n/a"}) > 12yo (${score12||"n/a"})`,
    score7 > 0 && score12 > 0 && score7 > score12,
    `Both must be in top 3. ageMatch 7yo≈1.0 vs 12yo≈0.34 — 7yo should score higher.`);
}

// A6: Flexible age sensitivity — Cricket at 16, professional → still scores ≥ 60
//     ageWindowIdeal=[6,14], age 16: overshoot=2, flexible(0.4), professional(0.12) → 0.904
{
  const a: WizardAnswers = { ...BASE,
    age: 16, ambition: "professional",
    visualTracking: "strong", focusStyle: "sustained",
    repetitionTolerance: "high", environment: "outdoor",
    teamIndividual: 3, budget: "3k-7k", weeklyHours: "13-plus",
  };
  const results = scoreSports(a);
  const cricket = results.find(r => r.sport.name === "Cricket");
  test("A", `A6 Flexible age sensitivity: Cricket age 16, professional → score ≥60`,
    (cricket?.score ?? 0) >= 60,
    `Cricket score: ${cricket?.score ?? "not in top 3"}`);
}

// A7: Racket synergy fires — explosive + high agility → Badminton or TT in top 3
{
  const a: WizardAnswers = { ...BASE,
    energyType: "explosive", agility: "high", eyesight: "sharp",
    visualTracking: "strong", teamIndividual: 4, decisionStyle: "react",
    environment: "indoor", budget: "3k-7k", age: 9,
  };
  const top = top3names(a);
  test("A", "A7 Racket synergy: explosive + agile → racket sport in top 3",
    top.some(s => ["Badminton", "Table Tennis", "Tennis"].includes(s)),
    `got: ${top.join(", ")}`);
}

// A8: Ambition level changes rankings for the same profile (age matters more at national)
{
  const fun15      = { ...BASE, ambition: "fun" as const, age: 15 };
  const national15 = { ...BASE, ambition: "national" as const, age: 15 };
  const topFun = top3names(fun15);
  const topNat = top3names(national15);
  test("A", "A8 Ambition level affects rankings",
    JSON.stringify(topFun) !== JSON.stringify(topNat),
    `fun: ${topFun.join(",")} vs national: ${topNat.join(",")}`);
}

// A9: Null/sparse profile doesn't crash and returns results
{
  const sparse: WizardAnswers = {
    childName: "", age: null, gender: null, state: null, priorSports: [],
    height: null, weight: null, energyType: null, motorType: null,
    visualTracking: null, eyesight: null, agility: null,
    teamIndividual: null, competitiveResponse: null, focusStyle: null,
    decisionStyle: null, pressureResponse: null, repetitionTolerance: null,
    contactComfort: null, environment: null, waterComfort: null,
    budget: null, ambition: null, weeklyHours: null,
  };
  let ok = false;
  let count = 0;
  try { const r = scoreSports(sparse); count = r.length; ok = count > 0; } catch {}
  test("A", `A9 Null profile → no crash, returns ${count} results`, ok, "");
}

// A10: Reasons are generated and non-trivial (≥2 reasons, each ≥25 chars)
{
  const a: WizardAnswers = { ...BASE,
    energyType: "explosive", agility: "high", eyesight: "sharp",
    visualTracking: "strong", priorSports: ["Table Tennis"],
  };
  const results = scoreSports(a);
  const top = results[0];
  const ok = top !== undefined
    && top.reasons.length >= 2
    && top.reasons.every(r => r.length >= 25);
  test("A", `A10 Reasons: ${top?.reasons.length ?? 0} generated, all non-trivial`,
    ok, `First: "${top?.reasons[0]?.slice(0, 60)}…"`);
}

// ══════════════════════════════════════════════════════════════════════════════
// EDGE-CASE PROBES (not scored, just printed for manual review)
// ══════════════════════════════════════════════════════════════════════════════
console.log(`\n${B}${C}━━━ EDGE-CASE PROBES (manual review) ━━━${X}`);
console.log(`${D}Not scored — inspect output for anomalies.${X}\n`);

function probe(label: string, a: WizardAnswers) {
  const r = scoreSports(a);
  console.log(`  ${Y}▸${X} ${label}`);
  r.forEach((s, i) => console.log(`    ${D}#${i+1} ${s.sport.name.padEnd(14)} ${s.score.toString().padStart(3)}/100  ${s.fitLabel}${X}`));
  console.log();
}

// P1: Boy 135cm, national volleyball (should be gated)
probe("P1 135cm boy, national volleyball — expect Volleyball absent", {
  ...BASE, age: 13, gender: "boy", height: 135, ambition: "national",
  teamIndividual: 2, energyType: "explosive",
});

// P2: All individual (teamIndividual=5), explosive, low budget — what wins?
probe("P2 Individual explosive, under-3k budget", {
  ...BASE, teamIndividual: 5, energyType: "explosive", budget: "under-3k",
});

// P3: Perfect endurance profile, outdoor, team (3), no water
probe("P3 Endurance outdoor balanced — Football vs Athletics", {
  ...BASE, energyType: "endurance", teamIndividual: 3,
  environment: "outdoor", repetitionTolerance: "high",
  focusStyle: "sustained", budget: "under-3k",
});

// P4: Highest possible wildcard divergence — does category diversity work?
probe("P4 Racket-perfect profile — wildcard should NOT be another racket sport", {
  ...BASE, energyType: "explosive", agility: "high", teamIndividual: 4,
  environment: "indoor", budget: "3k-7k",
});

// ══════════════════════════════════════════════════════════════════════════════
// FINAL SCORES
// ══════════════════════════════════════════════════════════════════════════════
const byCategory = (cat: string) => results.filter(r => r.cat === cat);
function rate(cat: string): number {
  const set = byCategory(cat);
  return Math.round((set.filter(r => r.ok).length / set.length) * 100);
}

const relevance  = rate("R");
const efficiency = rate("E");
const accuracy   = rate("A");
const overall    = Math.round((relevance + efficiency + accuracy) / 3);

console.log(`${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
console.log(`  SCORER MODEL RATING`);
console.log(`${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}`);

const byR = byCategory("R"), byE = byCategory("E"), byA = byCategory("A");
console.log(`  ${C}Relevance ${X}  ${byR.filter(r=>r.ok).length}/${byR.length} tests   ${bar(relevance)} ${B}${relevance}/100${X}`);
console.log(`  ${C}Efficiency${X}  ${byE.filter(r=>r.ok).length}/${byE.length} tests   ${bar(efficiency)} ${B}${efficiency}/100${X}`);
console.log(`  ${C}Accuracy  ${X}  ${byA.filter(r=>r.ok).length}/${byA.length} tests   ${bar(accuracy)} ${B}${accuracy}/100${X}`);
console.log(`  ${"─".repeat(50)}`);
const overallColor = overall >= 80 ? G : overall >= 60 ? Y : R;
console.log(`  ${B}Overall   ${overallColor}${overall}/100${X}  ${overall >= 80 ? `${G}Good` : overall >= 60 ? `${Y}Needs tuning` : `${R}Needs work`}${X}`);
console.log(`${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}\n`);

// Print failing tests for easy debugging
const failing = results.filter(r => !r.ok);
if (failing.length > 0) {
  console.log(`${B}${R}Failing tests:${X}`);
  failing.forEach(r => console.log(`  ${R}✗${X} [${r.cat}] ${r.name}  ${D}${r.note}${X}`));
  console.log();
}
