"use client";

import React from "react";
import api from "@/lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Zap, Users, Brain, Heart, Target, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PRIOR_SPORTS_OPTIONS } from "../data/sportProfiles";
import type { WizardAnswers } from "../types";
import { EMPTY_ANSWERS } from "../types";
import { scoreSports } from "../utils/scorer";
import { AgeGrid } from "./inputs/AgeGrid";
import { BinaryCards } from "./inputs/BinaryCards";
import { StateSelector } from "./inputs/StateSelector";
import { FourContextCards } from "./inputs/FourContextCards";
import { MultiSelectPills } from "./inputs/MultiSelectPills";
import { SpectrumSlider } from "./inputs/SpectrumSlider";
import { ThreeOptionCards } from "./inputs/ThreeOptionCards";
import { ResultsView } from "./results/ResultsView";
import { SectionTransition } from "./SectionTransition";
import type { SportResult } from "../types";
import type { PlayerProfile } from "@/modules/guidance/types";
import {
  buildDependentPayload,
  cmToFeetInches,
  prefillFromPlayer,
} from "../utils/dependentMapping";

// ─── Step sequence definition ─────────────────────────────────────────────────

type StepKind =
  | "welcome"
  | "name"
  | "question"
  | "transition"
  | "processing"
  | "results";

type Step =
  | { kind: "welcome" }
  | { kind: "name" }
  | { kind: "question"; questionKey: keyof WizardAnswers | "priorSports" }
  | { kind: "transition"; text: string; sub: string }
  | { kind: "processing" }
  | { kind: "results" };

const STEPS: Step[] = [
  { kind: "welcome" },
  { kind: "name" },
  { kind: "question", questionKey: "age" },
  { kind: "question", questionKey: "gender" },
  { kind: "question", questionKey: "state" },
  { kind: "question", questionKey: "priorSports" },
  { kind: "question", questionKey: "sportsInFamily" },
  { kind: "question", questionKey: "peerSports" },
  { kind: "question", questionKey: "informalSports" },
  { kind: "question", questionKey: "informalReaction" },
  { kind: "transition", text: "Good. Let's understand {name} physically.", sub: "7 quick questions." },
  { kind: "question", questionKey: "height" },
  { kind: "question", questionKey: "weight" },
  { kind: "question", questionKey: "energyType" },
  { kind: "question", questionKey: "motorType" },
  { kind: "question", questionKey: "visualTracking" },
  { kind: "question", questionKey: "eyesight" },
  { kind: "question", questionKey: "agility" },
  { kind: "transition", text: "Now the interesting part.", sub: "How {name} thinks and competes." },
  { kind: "question", questionKey: "teamIndividual" },
  { kind: "question", questionKey: "competitiveResponse" },
  { kind: "question", questionKey: "focusStyle" },
  { kind: "question", questionKey: "decisionStyle" },
  { kind: "question", questionKey: "pressureResponse" },
  { kind: "question", questionKey: "repetitionTolerance" },
  { kind: "transition", text: "Almost done.", sub: "A few practical questions for your family." },
  { kind: "question", questionKey: "contactComfort" },
  { kind: "question", questionKey: "environment" },
  { kind: "question", questionKey: "waterComfort" },
  { kind: "question", questionKey: "budget" },
  { kind: "question", questionKey: "ambition" },
  { kind: "question", questionKey: "futureFlexibility" },
  { kind: "question", questionKey: "weeklyHours" },
  { kind: "processing" },
  { kind: "results" },
];

const QUESTION_STEPS = STEPS.filter((s) => s.kind === "question");
const TOTAL_QUESTIONS = QUESTION_STEPS.length;

// ─── Left sidebar metadata ────────────────────────────────────────────────────

const SECTION_META: Record<string, { icon: React.ReactNode; title: string; desc: string }> = {
  Child: {
    icon: <User className="w-5 h-5" />,
    title: "About your child",
    desc: "Basic details that help us calibrate recommendations to their age, location, and background.",
  },
  Physical: {
    icon: <Zap className="w-5 h-5" />,
    title: "Physical profile",
    desc: "How they move, their energy pattern, and physical traits that align with different sports.",
  },
  Personality: {
    icon: <Brain className="w-5 h-5" />,
    title: "Mindset & competition",
    desc: "Decision-making style, focus pattern, and how they respond to pressure.",
  },
  Comfort: {
    icon: <Heart className="w-5 h-5" />,
    title: "Preferences & comfort",
    desc: "The environments they thrive in and activities they'd rather avoid.",
  },
  Practical: {
    icon: <Target className="w-5 h-5" />,
    title: "Goals & commitment",
    desc: "Your honest goals for this journey and realistic time and budget you can invest.",
  },
};

const SECTION_ORDER = ["Child", "Physical", "Personality", "Comfort", "Practical"];

function getProfileChips(answers: WizardAnswers): { label: string; value: string }[] {
  const chips: { label: string; value: string }[] = [];
  if (answers.age) chips.push({ label: "Age", value: `${answers.age} yrs` });
  if (answers.gender && answers.gender !== "prefer-not")
    chips.push({ label: "Gender", value: answers.gender === "boy" ? "Boy" : "Girl" });
  if (answers.state) chips.push({ label: "State", value: answers.state });
  if (answers.sportsInFamily.length > 0) chips.push({ label: "Family", value: "Sport runs in family" });
  if (answers.informalReaction === "kept-asking") chips.push({ label: "Exposure", value: "Already loves it" });
  if (answers.energyType)
    chips.push({ label: "Energy", value: answers.energyType === "explosive" ? "Explosive" : "Endurance" });
  if (answers.eyesight)
    chips.push({ label: "Vision", value: { sharp: "Sharp", corrected: "Corrected", limited: "Limited" }[answers.eyesight]! });
  if (answers.agility)
    chips.push({ label: "Agility", value: { high: "High", moderate: "Moderate", low: "Low" }[answers.agility]! });
  if (answers.teamIndividual !== null && answers.teamIndividual !== undefined) {
    const v = answers.teamIndividual;
    chips.push({ label: "Style", value: v <= 2 ? "Solo player" : v >= 4 ? "Team player" : "Balanced" });
  }
  if (answers.pressureResponse)
    chips.push({ label: "Pressure", value: { thrives: "Thrives", manages: "Manages", avoids: "Avoids" }[answers.pressureResponse]! });
  if (answers.environment)
    chips.push({ label: "Environment", value: { outdoor: "Outdoors", indoor: "Indoors", "no-preference": "Either" }[answers.environment]! });
  if (answers.ambition)
    chips.push({ label: "Goal", value: { fun: "Health & fun", competitive: "Competitive", national: "National", professional: "Pro career" }[answers.ambition]! });
  if (answers.budget)
    chips.push({ label: "Budget", value: { "under-3k": "< ₹3k/mo", "3k-7k": "₹3–7k/mo", "7k-15k": "₹7–15k/mo", "15k-plus": "₹15k+/mo" }[answers.budget]! });
  if (answers.weeklyHours)
    chips.push({ label: "Training", value: `${answers.weeklyHours} hrs/wk` });
  return chips;
}

// ─── Trial check-in ────────────────────────────────────────────────────────
// Schedules the 4-week "how did the trial go?" nudge for the top recommended
// sport. Fire-and-forget — a failure here shouldn't affect the save the
// parent already saw succeed.
function scheduleTrialCheckIn(
  dependentId: string | null,
  scored: SportResult[],
  childName: string,
): void {
  const top = scored[0];
  if (!top) return;
  const name = childName || "your child";
  const signals = [
    top.reasons[0],
    `Did ${name} ask to play again without being asked?`,
    "Was the cost and time commitment manageable for your family?",
  ].filter((s): s is string => !!s);

  api
    .post("/plan-checkins/find-sport-trial", {
      dependentId: dependentId || undefined,
      sport: top.sport.name,
      signals,
    })
    .catch(() => {});
}

// ─── Progress calculation (only question steps count) ─────────────────────────

function questionProgress(stepIndex: number): number {
  const questionsAnsweredSoFar = STEPS.slice(0, stepIndex).filter(
    (s) => s.kind === "question",
  ).length;
  return Math.round((questionsAnsweredSoFar / TOTAL_QUESTIONS) * 100);
}

// ─── Question screen renderer ─────────────────────────────────────────────────

function QuestionScreen({
  questionKey,
  answers,
  onAnswer,
  onNext,
}: {
  questionKey: keyof WizardAnswers | "priorSports";
  answers: WizardAnswers;
  onAnswer: (key: keyof WizardAnswers, value: WizardAnswers[keyof WizardAnswers]) => void;
  onNext: () => void;
}) {
  const name = answers.childName || "your child";
  const cap = name.charAt(0).toUpperCase() + name.slice(1);

  // Pronoun helpers — resolve to he/she when gender is known, singular "they"
  // otherwise (unanswered or "prefer not to say").
  const isPlural = answers.gender !== "boy" && answers.gender !== "girl";
  const pn = answers.gender === "boy" ? "he" : answers.gender === "girl" ? "she" : "they";
  const pnObj = answers.gender === "boy" ? "him" : answers.gender === "girl" ? "her" : "them";
  const pnContraction = isPlural ? "they're" : `${pn}'s`;
  const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // 3rd-person singular conjugation for "he"/"she"; base form for "they". Pass
  // an explicit singular form for irregulars (catch -> catches, miss -> misses).
  const v = (base: string, singular?: string) => (isPlural ? base : singular ?? `${base}s`);

  // Auto-advance helper for binary questions
  const autoAdvance = (key: keyof WizardAnswers, val: WizardAnswers[keyof WizardAnswers]) => {
    onAnswer(key, val);
    setTimeout(onNext, 200);
  };

  const section: Record<string, string> = {
    age: "Child", gender: "Child", state: "Child", priorSports: "Child",
    sportsInFamily: "Child", peerSports: "Child", informalSports: "Child", informalReaction: "Child",
    height: "Physical", weight: "Physical", energyType: "Physical",
    motorType: "Physical", visualTracking: "Physical",
    eyesight: "Physical", agility: "Physical",
    teamIndividual: "Personality", competitiveResponse: "Personality",
    focusStyle: "Personality", decisionStyle: "Personality",
    pressureResponse: "Personality", repetitionTolerance: "Personality",
    contactComfort: "Comfort", environment: "Comfort", waterComfort: "Comfort",
    budget: "Practical", ambition: "Practical", futureFlexibility: "Practical", weeklyHours: "Practical",
  };

  const renderInput = () => {
    switch (questionKey) {
      case "age":
        return (
          <AgeGrid
            value={answers.age}
            onChange={(v) => { onAnswer("age", v); setTimeout(onNext, 200); }}
          />
        );

      case "gender":
        return (
          <ThreeOptionCards
            options={[
              { value: "boy", label: "Boy" },
              { value: "girl", label: "Girl" },
              { value: "prefer-not", label: "Prefer not to say" },
            ]}
            value={answers.gender}
            onChange={(v) => { onAnswer("gender", v as WizardAnswers["gender"]); setTimeout(onNext, 200); }}
          />
        );

      case "state":
        return (
          <StateSelector
            value={answers.state}
            onChange={(s) => onAnswer("state", s)}
          />
        );

      case "priorSports":
        return (
          <MultiSelectPills
            options={PRIOR_SPORTS_OPTIONS}
            selected={answers.priorSports}
            onChange={(v) => onAnswer("priorSports", v)}
            noneLabel="None yet"
          />
        );

      case "sportsInFamily":
        return (
          <MultiSelectPills
            options={PRIOR_SPORTS_OPTIONS}
            selected={answers.sportsInFamily}
            onChange={(v) => onAnswer("sportsInFamily", v)}
            noneLabel="None of these"
          />
        );

      case "peerSports":
        return (
          <MultiSelectPills
            options={PRIOR_SPORTS_OPTIONS}
            selected={answers.peerSports}
            onChange={(v) => onAnswer("peerSports", v)}
            noneLabel="None of these"
          />
        );

      case "informalSports":
        return (
          <MultiSelectPills
            options={PRIOR_SPORTS_OPTIONS}
            selected={answers.informalSports}
            onChange={(v) => onAnswer("informalSports", v)}
            noneLabel="None of these"
          />
        );

      case "informalReaction":
        return (
          <BinaryCards
            options={[
              {
                value: "kept-asking",
                title: "Kept asking to play again",
                sub: `${cap} wanted to go back and do it more`,
              },
              {
                value: "lost-interest",
                title: "Lost interest quickly",
                sub: "Tried it, but didn't ask to continue",
              },
            ]}
            value={answers.informalReaction}
            onChange={(v) => autoAdvance("informalReaction", v as WizardAnswers["informalReaction"])}
          />
        );

      case "height": {
        const hDefault = answers.age ? Math.round(Math.min(175, 85 + answers.age * 5.5)) : 130;
        const hVal = answers.height ?? hDefault;
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => onAnswer("height", Math.max(80, hVal - 1))}
                className="w-12 h-12 rounded-full border-2 border-slate-200 text-slate-600 text-2xl font-light hover:border-power-orange hover:text-power-orange transition-colors flex items-center justify-center select-none"
              >
                −
              </button>
              <div className="text-center min-w-[120px]">
                <span className="text-6xl font-bold text-slate-900 tabular-nums">{hVal}</span>
                <span className="text-xl text-slate-400 ml-2">cm</span>
                <p className="text-sm text-slate-400 mt-1 tabular-nums">{cmToFeetInches(hVal)}</p>
              </div>
              <button
                type="button"
                onClick={() => onAnswer("height", Math.min(220, hVal + 1))}
                className="w-12 h-12 rounded-full border-2 border-slate-200 text-slate-600 text-2xl font-light hover:border-power-orange hover:text-power-orange transition-colors flex items-center justify-center select-none"
              >
                +
              </button>
            </div>
            <input
              type="range" min={80} max={220} step={1} value={hVal}
              onChange={(e) => onAnswer("height", parseInt(e.target.value))}
              className="w-full accent-power-orange"
            />
            <div className="flex justify-between text-xs text-slate-400 -mt-2">
              <span>80 cm · 2′ 7″</span>
              <span>220 cm · 7′ 3″</span>
            </div>
          </div>
        );
      }

      case "weight": {
        const wDefault = answers.age ? Math.round(Math.min(80, 12 + answers.age * 2.8)) : 35;
        const wVal = answers.weight ?? wDefault;
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => onAnswer("weight", Math.max(15, wVal - 1))}
                className="w-12 h-12 rounded-full border-2 border-slate-200 text-slate-600 text-2xl font-light hover:border-power-orange hover:text-power-orange transition-colors flex items-center justify-center select-none"
              >
                −
              </button>
              <div className="text-center min-w-[120px]">
                <span className="text-6xl font-bold text-slate-900 tabular-nums">{wVal}</span>
                <span className="text-xl text-slate-400 ml-2">kg</span>
              </div>
              <button
                type="button"
                onClick={() => onAnswer("weight", Math.min(120, wVal + 1))}
                className="w-12 h-12 rounded-full border-2 border-slate-200 text-slate-600 text-2xl font-light hover:border-power-orange hover:text-power-orange transition-colors flex items-center justify-center select-none"
              >
                +
              </button>
            </div>
            <input
              type="range" min={15} max={120} step={1} value={wVal}
              onChange={(e) => onAnswer("weight", parseInt(e.target.value))}
              className="w-full accent-power-orange"
            />
            <div className="flex justify-between text-xs text-slate-400 -mt-2">
              <span>15 kg</span>
              <span>120 kg</span>
            </div>
          </div>
        );
      }

      case "energyType":
        return (
          <BinaryCards
            options={[
              {
                value: "explosive",
                title: "Sprints hard, then needs a breather",
                sub: `${cap} goes flat out for a bit, gives everything — then sits out to recover`,
              },
              {
                value: "endurance",
                title: "Keeps going the whole time",
                sub: "Doesn't tire quickly — still going strong after everyone else has stopped",
              },
            ]}
            value={answers.energyType}
            onChange={(v) => autoAdvance("energyType", v as WizardAnswers["energyType"])}
          />
        );

      case "motorType":
        return (
          <BinaryCards
            options={[
              {
                value: "gross",
                title: "Loves running, jumping, throwing things",
                sub: "Whole-body movement — power and coordination, not precision",
              },
              {
                value: "fine",
                title: "Better at careful, steady-handed tasks",
                sub: "Stacking blocks, threading things, careful aim — precision over power",
              },
            ]}
            value={answers.motorType}
            onChange={(v) => autoAdvance("motorType", v as WizardAnswers["motorType"])}
          />
        );

      case "visualTracking":
        return (
          <ThreeOptionCards
            options={[
              { value: "strong", label: `${cap1(v("track"))} and ${v("react")} naturally` },
              { value: "moderate", label: `Sometimes ${v("catch", "catches")} it, sometimes ${v("miss", "misses")} — depends on the day` },
              { value: "weak", label: `Usually ${v("miss", "misses")} or ${v("react")} late to fast-moving objects` },
            ]}
            value={answers.visualTracking}
            onChange={(v) => { onAnswer("visualTracking", v as WizardAnswers["visualTracking"]); setTimeout(onNext, 200); }}
          />
        );

      case "teamIndividual":
        return (
          <SpectrumSlider
            value={answers.teamIndividual}
            onChange={(v) => onAnswer("teamIndividual", v)}
            leftLabel="Just me"
            rightLabel="Team, always"
            leftExamples="Tennis, Badminton, Chess"
            rightExamples="Football, Cricket, Kabaddi"
          />
        );

      case "competitiveResponse":
        return (
          <ThreeOptionCards
            options={[
              { value: "fired-up", label: `${cap1(v("get"))} fired up and ${v("want")} to play again immediately` },
              { value: "calm", label: `${cap1(v("accept"))} it calmly and ${v("move")} on without much fuss` },
              { value: "discouraged", label: `${cap1(v("get"))} quite upset and ${v("need")} time before wanting to try again` },
            ]}
            value={answers.competitiveResponse}
            onChange={(v) => { onAnswer("competitiveResponse", v as WizardAnswers["competitiveResponse"]); setTimeout(onNext, 200); }}
          />
        );

      case "focusStyle":
        return (
          <BinaryCards
            options={[
              {
                value: "bursts",
                title: "Focuses hard, then needs a break",
                sub: `${cap} is fully locked in for 20–30 minutes, then needs to get up and move`,
              },
              {
                value: "sustained",
                title: "Can stay with it for hours",
                sub: `Once ${name} is absorbed in something ${pn} ${v("like")}, ${pn} ${v("lose")} track of time`,
              },
            ]}
            value={answers.focusStyle}
            onChange={(v) => autoAdvance("focusStyle", v as WizardAnswers["focusStyle"])}
          />
        );

      case "decisionStyle":
        return (
          <BinaryCards
            options={[
              {
                value: "react",
                title: "Jumps in and figures it out by doing",
                sub: `${cap} acts on instinct first — thinking about it comes after`,
              },
              {
                value: "strategic",
                title: "Watches and plans before joining in",
                sub: `${cap} wants to understand the rules and think it through first`,
              },
            ]}
            value={answers.decisionStyle}
            onChange={(v) => autoAdvance("decisionStyle", v as WizardAnswers["decisionStyle"])}
          />
        );

      case "pressureResponse":
        return (
          <ThreeOptionCards
            options={[
              { value: "thrives", label: `${cap} performs even better when all eyes are on ${pnObj} — thrives under the spotlight` },
              { value: "manages", label: "Gets nervous but manages through it — performs reasonably well under pressure" },
              { value: "avoids", label: `${cap} strongly prefers not to be the centre of attention` },
            ]}
            value={answers.pressureResponse}
            onChange={(v) => { onAnswer("pressureResponse", v as WizardAnswers["pressureResponse"]); setTimeout(onNext, 200); }}
          />
        );

      case "repetitionTolerance":
        return (
          <BinaryCards
            options={[
              {
                value: "high",
                title: "Happy to repeat the same drill for months",
                sub: `${cap} doesn't get bored — repetition is how ${pn} ${v("get")} better`,
              },
              {
                value: "low",
                title: "Needs variety to stay motivated",
                sub: `The same drill every day would kill ${name}'s enthusiasm quickly`,
              },
            ]}
            value={answers.repetitionTolerance}
            onChange={(v) => autoAdvance("repetitionTolerance", v as WizardAnswers["repetitionTolerance"])}
          />
        );

      case "eyesight":
        return (
          <ThreeOptionCards
            options={[
              { value: "sharp", label: `${cap} has clear, sharp vision — no glasses or contacts needed` },
              { value: "corrected", label: `${cap} wears glasses or contact lenses` },
              { value: "limited", label: `${cap} has difficulty seeing clearly even with glasses` },
            ]}
            value={answers.eyesight}
            onChange={(v) => { onAnswer("eyesight", v as WizardAnswers["eyesight"]); setTimeout(onNext, 200); }}
          />
        );

      case "agility":
        return (
          <ThreeOptionCards
            options={[
              { value: "high", label: `Very agile — ${name} moves quickly, changes direction easily, and is naturally flexible` },
              { value: "moderate", label: "Average agility — moves well enough but not exceptional" },
              { value: "low", label: `${cap} is less agile — prefers steadier, less dynamic physical movement` },
            ]}
            value={answers.agility}
            onChange={(v) => { onAnswer("agility", v as WizardAnswers["agility"]); setTimeout(onNext, 200); }}
          />
        );

      case "contactComfort":
        return (
          <ThreeOptionCards
            options={[
              { value: "loves", label: `${cap} loves physical contact — wrestling, jostling, bumping into others` },
              { value: "neutral", label: "Neutral — doesn't mind physical contact either way" },
              { value: "avoids", label: `${cap} prefers to avoid physical contact` },
            ]}
            value={answers.contactComfort}
            onChange={(v) => { onAnswer("contactComfort", v as WizardAnswers["contactComfort"]); setTimeout(onNext, 200); }}
          />
        );

      case "environment":
        return (
          <ThreeOptionCards
            options={[
              { value: "outdoor", label: "Outdoors — parks, fields, open sky" },
              { value: "indoor", label: "Indoors — gyms, courts, air-conditioned spaces" },
              { value: "no-preference", label: "No strong preference either way" },
            ]}
            value={answers.environment}
            onChange={(v) => { onAnswer("environment", v as WizardAnswers["environment"]); setTimeout(onNext, 200); }}
          />
        );

      case "waterComfort":
        return (
          <ThreeOptionCards
            options={[
              { value: "comfortable", label: `${cap} is very comfortable in water — loves swimming or being in a pool` },
              { value: "neutral", label: "Okay with water — no strong feeling" },
              { value: "uncomfortable", label: `${cap} is uncomfortable or afraid of water` },
            ]}
            value={answers.waterComfort}
            onChange={(v) => { onAnswer("waterComfort", v as WizardAnswers["waterComfort"]); setTimeout(onNext, 200); }}
          />
        );

      case "budget":
        return (
          <FourContextCards
            options={[
              { value: "under-3k", label: "Under ₹3,000/month", context: "Covers: chess, kabaddi, athletics, football" },
              { value: "3k-7k", label: "₹3,000 – ₹7,000/month", context: "Covers: badminton, table tennis, basketball, cricket" },
              { value: "7k-15k", label: "₹7,000 – ₹15,000/month", context: "Covers: tennis, swimming, gymnastics basics" },
              { value: "15k-plus", label: "₹15,000+/month", context: "Covers: shooting, top academies, high-performance coaching" },
            ]}
            value={answers.budget}
            onChange={(v) => { onAnswer("budget", v as WizardAnswers["budget"]); setTimeout(onNext, 200); }}
          />
        );

      case "ambition":
        return (
          <FourContextCards
            options={[
              { value: "fun", label: "Health, confidence, and fun", context: "No pressure on results — sport as a positive life habit" },
              { value: "competitive", label: "District and state-level competition", context: "Serious about sport, but not chasing a professional career" },
              { value: "national", label: "National representation", context: "We are committed to the long journey this requires" },
              { value: "professional", label: "Professional athletic career", context: "This is a real goal we are actively working toward" },
            ]}
            value={answers.ambition}
            onChange={(v) => { onAnswer("ambition", v as WizardAnswers["ambition"]); setTimeout(onNext, 200); }}
          />
        );

      case "futureFlexibility":
        return (
          <ThreeOptionCards
            options={[
              { value: "all-in", label: "Yes — we'd go all in" },
              { value: "maybe", label: "Maybe, depends how far" },
              { value: "stay-local", label: "No — want to stay local and keep costs steady" },
            ]}
            value={answers.futureFlexibility}
            onChange={(v) => { onAnswer("futureFlexibility", v as WizardAnswers["futureFlexibility"]); setTimeout(onNext, 200); }}
          />
        );

      case "weeklyHours":
        return (
          <FourContextCards
            options={[
              { value: "1-3", label: "1–3 hours/week", context: "A couple of casual sessions — sport fits around everything else" },
              { value: "4-7", label: "4–7 hours/week", context: "Regular training — about 1 hour on most days" },
              { value: "8-12", label: "8–12 hours/week", context: "Serious commitment — two sessions on many days" },
              { value: "13-plus", label: "13+ hours/week", context: "Full dedication — sport is the main priority" },
            ]}
            value={answers.weeklyHours}
            onChange={(v) => { onAnswer("weeklyHours", v as WizardAnswers["weeklyHours"]); setTimeout(onNext, 200); }}
          />
        );

      default:
        return null;
    }
  };

  const questions: Partial<Record<string, string>> = {
    age: `How old is ${name}?`,
    gender: `Is ${name} a boy or a girl?`,
    state: "Which state are you based in?",
    priorSports: `Has ${name} tried any sport formally before?`,
    sportsInFamily: `Has anyone in ${name}'s immediate family played any of these sports seriously (school/college level or higher)?`,
    peerSports: `Do any of ${name}'s close friends play these sports seriously?`,
    informalSports: `Has ${name} played any of these sports casually — not lessons, just for fun (park, backyard, with friends)?`,
    informalReaction: `Did ${name} ask to keep playing, or lose interest quickly?`,
    height: `How tall is ${name}?`,
    weight: `How much does ${name} weigh?`,
    energyType: `In a game of tag or running around with friends, what does ${name} usually do?`,
    motorType: `Think of ${name} building something or playing catch — ${pnContraction} better at:`,
    visualTracking: `When something moves fast toward ${name} — a ball, a shuttle — ${pn}:`,
    teamIndividual: `At a birthday party with a group game, does ${name} want a partner or team, or go it alone?`,
    competitiveResponse: `When ${name} loses a game or competition, ${pn}:`,
    focusStyle: `Think of ${name} doing homework or a puzzle — ${pn} ${v("tend")} to:`,
    decisionStyle: `When ${name} plays a new game for the first time, ${pn} usually:`,
    pressureResponse: `When all attention is on ${name} — school event, family gathering:`,
    repetitionTolerance: `To get really good at something, is ${name} willing to:`,
    eyesight: `How is ${name}'s eyesight?`,
    agility: `How agile and flexible is ${name}?`,
    contactComfort: "How comfortable is your child with physical contact?",
    environment: "Given a free afternoon, does your child gravitate toward:",
    waterComfort: `How comfortable is ${name} in water?`,
    budget: "What can your family realistically invest in training each month?",
    ambition: "What is your honest goal for this sport journey?",
    futureFlexibility: `If ${name} shows real talent and wants to go further, would your family be open to relocating or significantly increasing investment?`,
    weeklyHours: `How many hours per week can ${name} dedicate to sport training?`,
  };

  const needsNextButton =
    questionKey === "state" ||
    questionKey === "height" ||
    questionKey === "weight" ||
    questionKey === "priorSports" ||
    questionKey === "sportsInFamily" ||
    questionKey === "peerSports" ||
    questionKey === "informalSports" ||
    questionKey === "teamIndividual";

  const canAdvance = () => {
    if (questionKey === "priorSports") return true;
    if (questionKey === "sportsInFamily") return true;
    if (questionKey === "peerSports") return true;
    if (questionKey === "informalSports") return true;
    if (questionKey === "state") return !!answers.state;
    if (questionKey === "height") return true; // default pre-filled from age
    if (questionKey === "weight") return true; // default pre-filled from age
    if (questionKey === "teamIndividual") return answers.teamIndividual !== null;
    return false;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
          {section[questionKey] ?? ""}
        </p>
        <h2 className="font-title text-xl font-bold text-slate-900 leading-snug">
          {questions[questionKey] ?? ""}
        </h2>
      </div>

      {renderInput()}

      {needsNextButton && (
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance()}
          className="w-full bg-power-orange text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-power-orange/90 transition-colors"
        >
          Continue
        </button>
      )}
    </div>
  );
}

// ─── Processing screen ────────────────────────────────────────────────────────

function ProcessingScreen({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center space-y-4"
    >
      <div className="w-12 h-12 rounded-full border-2 border-power-orange border-t-transparent animate-spin" />
      <p className="font-title text-xl font-bold text-slate-900">
        Building {name || "your child"}&apos;s sport profile...
      </p>
      <p className="text-sm text-slate-400 max-w-xs">
        Matching what you&apos;ve shared with sport requirements, training pathways, and what&apos;s
        available in your city.
      </p>
    </motion.div>
  );
}

// ─── Main wizard shell ────────────────────────────────────────────────────────

export function WizardShell() {
  const { user, token } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<WizardAnswers>({ ...EMPTY_ANSWERS });
  const [results, setResults] = useState<SportResult[]>([]);
  const [nameInput, setNameInput] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  // Holds wizard data to auto-import once we confirm the user has no children yet
  const pendingImport = useRef<{ answers: WizardAnswers; scored: SportResult[] } | null>(null);

  // Child profile selection
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedForName, setSavedForName] = useState<string | undefined>(undefined);

  // Restore wizard session from localStorage on mount (works for both guests and
  // newly-registered users who filled the wizard before signing up).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pms_wizard_results");
      if (!raw) return;
      const saved = JSON.parse(raw) as { answers: WizardAnswers; savedAt: string };
      if (Date.now() - new Date(saved.savedAt).getTime() > 24 * 60 * 60 * 1000) return;
      if (!saved.answers) return;

      setAnswers(saved.answers);
      if (saved.answers.childName) setNameInput(saved.answers.childName);
      const scored = scoreSports(saved.answers);
      if (scored.length === 0) return;
      setResults(scored);
      setStepIndex(STEPS.length - 1);

      // Logged-in user: defer the child profile creation until after the
      // players fetch confirms they have no existing children (newly registered).
      if (token) {
        pendingImport.current = { answers: saved.answers, scored };
        setSavedStatus("saving");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch full player profiles on mount (for pre-fill with wizard fields).
  // Also handles the post-registration auto-import: if the user has no children
  // yet and pendingImport holds their guest wizard session, create the child now.
  useEffect(() => {
    if (!token) return;
    api
      .get<{ success: boolean; data: PlayerProfile[] }>("/auth/players")
      .then((res) => {
        if (!res.data.success || !Array.isArray(res.data.data)) return;
        const dependents = res.data.data.filter((p) => p.type === "DEPENDENT");
        setPlayers(dependents);

        if (dependents.length === 0 && pendingImport.current) {
          // Newly registered user — create child profile from their guest session
          const { answers: a, scored } = pendingImport.current;
          pendingImport.current = null;
          const childName = a.childName?.trim() || "My Child";
          api
            .post<{ success: boolean; data: { _id: string } }>(
              "/auth/dependents",
              buildDependentPayload(a, scored, childName),
            )
            .then((r) => {
              if (r.data?.data?._id) setSelectedDependentId(r.data.data._id);
              setSavedForName(childName);
              setSavedStatus("saved");
              try { localStorage.removeItem("pms_wizard_results"); } catch {}
            })
            .catch(() => setSavedStatus("error"));
        } else {
          // Existing parent — discard any pending import (they already have children)
          pendingImport.current = null;
          if (savedStatus === "saving") setSavedStatus("idle");
          // Auto-select the only dependent for pre-fill
          if (dependents.length === 1) {
            setSelectedDependentId(dependents[0]._id);
            applyPlayer(dependents[0]);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function applyPlayer(player: PlayerProfile) {
    const prefilled = prefillFromPlayer(player);
    const firstName = player.name?.split(" ")[0] ?? "";
    if (firstName) {
      setNameInput(firstName);
      prefilled.childName = firstName;
    }
    setAnswers((prev) => ({ ...prev, ...prefilled }));
  }

  function selectDependent(player: PlayerProfile) {
    if (selectedDependentId === player._id) {
      // Deselect — reset to empty
      setSelectedDependentId(null);
      setAnswers({ ...EMPTY_ANSWERS });
      setNameInput("");
    } else {
      setSelectedDependentId(player._id);
      applyPlayer(player);
    }
  }

  const currentStep = STEPS[stepIndex];
  const progress = questionProgress(stepIndex);
  const showProgress = currentStep.kind !== "welcome" && currentStep.kind !== "results";
  const showBack = stepIndex > 0 && currentStep.kind !== "processing" && currentStep.kind !== "results";
  const isFullScreen = currentStep.kind === "welcome" || currentStep.kind === "results" || currentStep.kind === "processing";

  // Derive current section for the left panel
  const currentSection: string = (() => {
    if (currentStep.kind === "question") {
      const sectionMap: Record<string, string> = {
        age: "Child", gender: "Child", state: "Child", priorSports: "Child",
        sportsInFamily: "Child", peerSports: "Child", informalSports: "Child", informalReaction: "Child",
        height: "Physical", weight: "Physical", energyType: "Physical",
        motorType: "Physical", visualTracking: "Physical", eyesight: "Physical", agility: "Physical",
        teamIndividual: "Personality", competitiveResponse: "Personality",
        focusStyle: "Personality", decisionStyle: "Personality",
        pressureResponse: "Personality", repetitionTolerance: "Personality",
        contactComfort: "Comfort", environment: "Comfort", waterComfort: "Comfort",
        budget: "Practical", ambition: "Practical", futureFlexibility: "Practical", weeklyHours: "Practical",
      };
      return sectionMap[currentStep.questionKey] ?? "";
    }
    if (currentStep.kind === "name") return "Child";
    if (currentStep.kind === "transition") {
      // Pick section based on which transition (before Physical, Personality, Practical)
      const textSnippet = currentStep.text;
      if (textSnippet.includes("physically")) return "Physical";
      if (textSnippet.includes("interesting")) return "Personality";
      return "Practical";
    }
    return "";
  })();

  const profileChips = getProfileChips(answers);
  const sectionMeta = SECTION_META[currentSection];

  const goNext = () => {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const setAnswer = <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const retake = () => {
    setAnswers({ ...EMPTY_ANSWERS });
    setNameInput("");
    setResults([]);
    setSavedStatus("idle");
    setStepIndex(0);
  };

  // Auto-advance transitions after 1.5s; run scoring on processing screen
  useEffect(() => {
    if (currentStep.kind === "transition") {
      const timer = setTimeout(goNext, 1500);
      return () => clearTimeout(timer);
    }
    if (currentStep.kind === "processing") {
      const timer = setTimeout(async () => {
        const scored = scoreSports(answers);
        setResults(scored);

        // Save to profile if logged in with a selected dependent (update)
        if (token && selectedDependentId) {
          setSavedStatus("saving");
          const displayName = players.find((p) => p._id === selectedDependentId)?.name.split(" ")[0] ?? answers.childName;
          try {
            await api.put(`/auth/dependents/${selectedDependentId}`, buildDependentPayload(answers, scored));
            setSavedForName(displayName || undefined);
            setSavedStatus("saved");
            scheduleTrialCheckIn(selectedDependentId, scored, displayName || answers.childName);
          } catch {
            setSavedStatus("error");
          }
        } else if (token && !selectedDependentId) {
          // Logged-in parent with no child selected — create a new child profile
          setSavedStatus("saving");
          const childName = answers.childName?.trim() || "My Child";
          try {
            const res = await api.post<{ success: boolean; data: { _id: string } }>(
              "/auth/dependents",
              buildDependentPayload(answers, scored, childName),
            );
            if (res.data?.data?._id) setSelectedDependentId(res.data.data._id);
            setSavedForName(childName);
            setSavedStatus("saved");
            scheduleTrialCheckIn(res.data?.data?._id ?? null, scored, childName);
          } catch {
            setSavedStatus("error");
          }
        } else if (!token) {
          // Guest: save to localStorage so the results survive a soft reload
          try {
            localStorage.setItem(
              "pms_wizard_results",
              JSON.stringify({
                answers,
                results: scored
                  .slice(0, 3)
                  .map((r) => ({ sport: r.sport.name, fitLabel: r.fitLabel, score: r.score })),
                savedAt: new Date().toISOString(),
              }),
            );
          } catch {}
        }

        goNext();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [stepIndex]);

  // Focus name input when on name screen
  useEffect(() => {
    if (currentStep.kind === "name") nameRef.current?.focus();
  }, [stepIndex]);

  // informalReaction is only meaningful if informalSports had at least one
  // selection — auto-skip it otherwise, same idiom as the transition auto-advance.
  useEffect(() => {
    if (
      currentStep.kind === "question" &&
      currentStep.questionKey === "informalReaction" &&
      answers.informalSports.length === 0
    ) {
      goNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const transitionText = (text: string) =>
    text.replace("{name}", answers.childName || "your child");

  const selectedPlayer = players.find((p) => p._id === selectedDependentId);

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── Left sidebar (desktop only, hidden on full-screen steps) ── */}
      {/* Outer wrapper carries the dark background and stretches to match the
          right panel's height (which can exceed one viewport, e.g. long
          multi-select lists); the inner aside stays pinned via sticky. */}
      {!isFullScreen && (
        <div className="hidden lg:block w-[320px] xl:w-[360px] bg-slate-900 shrink-0">
        <aside className="flex flex-col sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
          {/* Brand */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-widest text-power-orange mb-0.5">
              PowerMySport
            </p>
            <p className="text-sm text-slate-400">Sport Assessment</p>
          </div>

          {/* Section context */}
          <div className="flex-1 px-8 py-7 overflow-y-auto">
            {sectionMeta && (
              <div key={currentSection} className="animate-in fade-in duration-300">
                {/* Section progress dots */}
                <div className="flex gap-1.5 mb-6">
                  {SECTION_ORDER.map((s) => (
                    <div
                      key={s}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        s === currentSection
                          ? "bg-power-orange w-6"
                          : SECTION_ORDER.indexOf(s) < SECTION_ORDER.indexOf(currentSection)
                          ? "bg-slate-600 w-3"
                          : "bg-slate-800 w-3"
                      }`}
                    />
                  ))}
                </div>

                {/* Icon */}
                <div className="w-11 h-11 rounded-2xl bg-power-orange/15 text-power-orange flex items-center justify-center mb-5">
                  {sectionMeta.icon}
                </div>

                <h2 className="font-title text-xl font-bold text-white mb-2 leading-snug">
                  {sectionMeta.title}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {sectionMeta.desc}
                </p>
              </div>
            )}

            {/* Profile chips — grow as answers fill in */}
            {profileChips.length > 0 && (
              <div className="mt-8">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Profile so far
                </p>
                <div className="flex flex-wrap gap-2">
                  {profileChips.map((chip) => (
                    <div
                      key={chip.label}
                      className="flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1"
                    >
                      <span className="text-[10px] text-slate-500">{chip.label}</span>
                      <span className="text-[11px] font-semibold text-slate-200">{chip.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Progress at bottom */}
          <div className="px-8 py-6 border-t border-slate-800">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Progress</span>
              <span className="text-slate-300 font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-power-orange rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.5 }}
              />
            </div>
          </div>
        </aside>
        </div>
      )}

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile progress bar */}
        {showProgress && (
          <div className="lg:hidden h-1 bg-slate-100 w-full shrink-0">
            <motion.div
              className="h-full bg-power-orange"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
        )}

        {/* Desktop progress bar — only when no sidebar (full-screen steps) */}
        {showProgress && isFullScreen && (
          <div className="hidden lg:block h-1 bg-slate-100 w-full shrink-0">
            <motion.div
              className="h-full bg-power-orange"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
        )}

        {/* Back button */}
        {showBack && (
          <div className="flex items-center px-5 pt-4 lg:px-10 shrink-0">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 px-5 py-8 lg:py-10 w-full mx-auto ${isFullScreen ? "max-w-5xl lg:px-10 xl:px-14" : "max-w-2xl lg:px-10 xl:px-16 lg:mx-0"}`}>
          <div
            key={stepIndex}
            className={`animate-in fade-in duration-200 ${direction >= 0 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}
          >
            {currentStep.kind === "welcome" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="py-4"
              >
                <div className="relative flex flex-col overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_28px_70px_-28px_rgba(15,23,42,0.22)] lg:flex-row">
                  {/* ── Left panel — branded showcase ── */}
                  <div className="flex flex-col gap-7 bg-slate-900 p-7 xl:p-9 lg:w-[52%] lg:shrink-0 xl:w-[55%]">
                    {/* Brand eyebrow */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-power-orange/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-power-orange">
                        <span className="h-1.5 w-1.5 rounded-full bg-power-orange animate-pulse" />
                        Sport Assessment
                      </span>
                    </div>

                    {/* Headline */}
                    <div>
                      <h1 className="font-title text-2xl xl:text-3xl font-bold text-white leading-tight mb-3">
                        Find the right sport<br />for your child.
                      </h1>
                      <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                        We analyse {TOTAL_QUESTIONS} data points — the same things a top sports consultant would want to know.
                      </p>
                    </div>

                    {/* Trust stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: TOTAL_QUESTIONS.toString(), label: "Questions" },
                        { value: "5", label: "Categories" },
                        { value: "~10", label: "Minutes" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-center">
                          <p className="font-title text-2xl font-bold text-white mb-0.5">{stat.value}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Category list */}
                    <div className="flex flex-col gap-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">
                        What we evaluate
                      </p>
                      <motion.div
                        initial="hidden"
                        animate="show"
                        variants={{
                          hidden: { opacity: 0 },
                          show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
                        }}
                        className="grid grid-cols-2 gap-2"
                      >
                        {SECTION_ORDER.map((key, idx) => {
                          const sec = SECTION_META[key];
                          const gradients = [
                            "from-orange-500 to-amber-400",
                            "from-blue-500 to-cyan-400",
                            "from-violet-500 to-purple-400",
                            "from-rose-500 to-pink-400",
                            "from-emerald-500 to-teal-400",
                          ];
                          const isLast = idx === SECTION_ORDER.length - 1;
                          return (
                            <motion.div
                              key={key}
                              variants={{
                                hidden: { opacity: 0, y: 10 },
                                show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                              }}
                              className={`flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.04] p-3 transition-colors duration-200 hover:bg-white/[0.07] cursor-default${isLast ? " col-span-2" : ""}`}
                            >
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradients[idx]} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                                {React.cloneElement(sec.icon as React.ReactElement<{ className?: string }>, { className: "w-4 h-4" })}
                              </div>
                              <p className="text-[12px] font-semibold text-white leading-tight truncate">{sec.title}</p>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </div>
                  </div>

                  {/* ── Right panel — CTA ── */}
                  <div className="relative flex flex-1 flex-col justify-center gap-7 overflow-hidden p-7 xl:p-9">
                    {/* Ambient glow — echoes the left panel's dark treatment without repeating it */}
                    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-power-orange/[0.06] blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-sky-400/[0.06] blur-3xl" />

                    <div className="relative">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Personalised recommendation
                      </p>
                      <h2 className="font-title text-2xl font-bold text-slate-900 leading-snug mb-3">
                        Ready to find the perfect match?
                      </h2>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Answer honestly — there are no right or wrong answers. The more accurate you are, the better the match.
                      </p>
                    </div>

                    {/* How it works mini steps */}
                    <div className="relative flex flex-col gap-3">
                      {[
                        { step: "1", text: "Tell us about your child" },
                        { step: "2", text: "We score across 5 dimensions" },
                        { step: "3", text: "Get your personalised sport report" },
                      ].map((item) => (
                        <div key={item.step} className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-power-orange/10 text-power-orange text-[12px] font-bold flex items-center justify-center shrink-0">
                            {item.step}
                          </span>
                          <p className="text-[13px] text-slate-600 font-medium">{item.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Child picker */}
                    {players.length > 0 && (
                      <div className="relative">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
                          Who is this for?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {players.map((p) => (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => selectDependent(p)}
                              className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all duration-200 ${
                                selectedDependentId === p._id
                                  ? "border-power-orange bg-power-orange text-white shadow-sm"
                                  : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                              }`}
                            >
                              {p.name.split(" ")[0]}
                              {selectedDependentId === p._id && p.wizardCompletedAt && (
                                <span className="ml-1.5 text-[10px] opacity-75">· retake</span>
                              )}
                            </button>
                          ))}
                          {players.length > 0 && selectedDependentId && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDependentId(null);
                                setAnswers({ ...EMPTY_ANSWERS });
                                setNameInput("");
                              }}
                              className="px-4 py-2 rounded-full border-2 border-slate-200 text-sm font-medium text-slate-500 hover:border-slate-300 bg-white transition-all duration-200"
                            >
                              Someone new
                            </button>
                          )}
                        </div>
                        {selectedDependentId && selectedPlayer?.wizardCompletedAt && (
                          <p className="text-xs text-slate-400 mt-2">
                            Answers pre-filled from previous assessment — update anything that&apos;s changed.
                          </p>
                        )}
                      </div>
                    )}

                    {/* CTA */}
                    <div className="relative flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={goNext}
                        className="group relative w-full overflow-hidden rounded-2xl bg-power-orange px-8 py-4 text-[15px] font-bold text-white shadow-[0_4px_24px_-4px_rgba(234,88,12,0.5)] hover:shadow-[0_8px_32px_-4px_rgba(234,88,12,0.6)] hover:bg-orange-600 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <span>
                          {selectedDependentId
                            ? `Start for ${selectedPlayer?.name.split(" ")[0]}`
                            : "Start the assessment"}
                        </span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                      </button>
                      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Free</span>
                        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> No account needed</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~10 min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep.kind === "name" && (
              <div className="space-y-6 py-4">
                <div>
                  <h2 className="font-title text-2xl font-bold text-slate-900 mb-2">
                    Let&apos;s start. What&apos;s your child&apos;s name?
                  </h2>
                  <p className="text-sm text-slate-400">
                    Just so we can make this feel personal, not generic.
                  </p>
                </div>
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="e.g. Aryan"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameInput.trim()) {
                      setAnswer("childName", nameInput.trim());
                      goNext();
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 text-base placeholder:text-slate-300 focus:outline-none focus:border-power-orange focus:ring-2 focus:ring-power-orange/15"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAnswer("childName", nameInput.trim());
                    goNext();
                  }}
                  className="w-full bg-power-orange text-white rounded-xl py-3 text-sm font-semibold hover:bg-power-orange/90 transition-colors"
                >
                  {nameInput.trim() ? `Continue with ${nameInput.trim()}` : "Skip"}
                </button>
              </div>
            )}

            {currentStep.kind === "transition" && (
              <SectionTransition
                text={transitionText(currentStep.text)}
                sub={transitionText(currentStep.sub)}
              />
            )}

            {currentStep.kind === "question" && (
              <QuestionScreen
                questionKey={currentStep.questionKey}
                answers={answers}
                onAnswer={setAnswer}
                onNext={goNext}
              />
            )}

            {currentStep.kind === "processing" && (
              <ProcessingScreen name={answers.childName} />
            )}

            {currentStep.kind === "results" && (
              <ResultsView
                results={results}
                answers={answers}
                onRetake={retake}
                savedStatus={savedStatus}
                isLoggedIn={!!token}
                savedForName={savedForName}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
