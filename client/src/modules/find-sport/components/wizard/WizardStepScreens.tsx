import { X } from "lucide-react";
import { motion } from "framer-motion";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { PRIOR_SPORTS_OPTIONS } from "../../data/sportProfiles";
import type { WizardAnswers } from "../../types";
import { MAX_CONSIDERED_SPORTS } from "../../types";
import { BinaryCards } from "../inputs/BinaryCards";
import { StateSelector } from "../inputs/StateSelector";
import { FourContextCards } from "../inputs/FourContextCards";
import { MultiSelectPills } from "../inputs/MultiSelectPills";
import { SpectrumSlider } from "../inputs/SpectrumSlider";
import { ThreeOptionCards } from "../inputs/ThreeOptionCards";
import { cmToFeetInches } from "../../utils/dependentMapping";
import { DOB_BOUNDS } from "./wizardSteps";

// ─── Question screen renderer ─────────────────────────────────────────────────

export function QuestionScreen({
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
  const v = (base: string, singular?: string) => (isPlural ? base : (singular ?? `${base}s`));

  // Auto-advance helper for binary questions
  const autoAdvance = (key: keyof WizardAnswers, val: WizardAnswers[keyof WizardAnswers]) => {
    onAnswer(key, val);
    setTimeout(onNext, 200);
  };

  const section: Record<string, string> = {
    dob: "Child",
    gender: "Child",
    state: "Child",
    priorSports: "Child",
    consideringSports: "Child",
    height: "Physical",
    weight: "Physical",
    energyType: "Physical",
    motorType: "Physical",
    visualTracking: "Physical",
    eyesight: "Physical",
    agility: "Physical",
    teamIndividual: "Personality",
    competitiveResponse: "Personality",
    focusStyle: "Personality",
    decisionStyle: "Personality",
    pressureResponse: "Personality",
    repetitionTolerance: "Personality",
    contactComfort: "Comfort",
    environment: "Comfort",
    waterComfort: "Comfort",
    medicalConditions: "Comfort",
    budget: "Practical",
    ambition: "Practical",
    weeklyHours: "Practical",
  };

  const renderInput = () => {
    switch (questionKey) {
      case "dob":
        return (
          <div className="space-y-3">
            <input
              type="date"
              value={answers.dob ?? ""}
              min={DOB_BOUNDS.min}
              max={DOB_BOUNDS.max}
              onChange={(e) => {
                const val = e.target.value || null;
                onAnswer("dob", val);
                onAnswer("age", getDependentAge(val));
              }}
              className="focus:border-power-orange focus:ring-power-orange/15 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2"
            />
            {answers.dob && answers.age !== null && (
              <p className="text-sm text-slate-400">
                That makes {cap} {answers.age} years old.
              </p>
            )}
          </div>
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
            onChange={(v) => {
              onAnswer("gender", v as WizardAnswers["gender"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "state":
        return <StateSelector value={answers.state} onChange={(s) => onAnswer("state", s)} />;

      case "priorSports":
        return (
          <MultiSelectPills
            options={PRIOR_SPORTS_OPTIONS}
            selected={answers.priorSports}
            onChange={(v) => onAnswer("priorSports", v)}
            noneLabel="None yet"
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
                className="hover:border-power-orange hover:text-power-orange flex h-12 w-12 select-none items-center justify-center rounded-full border-2 border-slate-200 text-2xl font-light text-slate-600 transition-colors"
              >
                −
              </button>
              <div className="min-w-[120px] text-center">
                <span className="text-6xl font-bold tabular-nums text-slate-900">{hVal}</span>
                <span className="ml-2 text-xl text-slate-400">cm</span>
                <p className="mt-1 text-sm tabular-nums text-slate-400">{cmToFeetInches(hVal)}</p>
              </div>
              <button
                type="button"
                onClick={() => onAnswer("height", Math.min(220, hVal + 1))}
                className="hover:border-power-orange hover:text-power-orange flex h-12 w-12 select-none items-center justify-center rounded-full border-2 border-slate-200 text-2xl font-light text-slate-600 transition-colors"
              >
                +
              </button>
            </div>
            <input
              type="range"
              min={80}
              max={220}
              step={1}
              value={hVal}
              onChange={(e) => onAnswer("height", parseInt(e.target.value))}
              className="accent-power-orange w-full"
            />
            <div className="-mt-2 flex justify-between text-xs text-slate-400">
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
                className="hover:border-power-orange hover:text-power-orange flex h-12 w-12 select-none items-center justify-center rounded-full border-2 border-slate-200 text-2xl font-light text-slate-600 transition-colors"
              >
                −
              </button>
              <div className="min-w-[120px] text-center">
                <span className="text-6xl font-bold tabular-nums text-slate-900">{wVal}</span>
                <span className="ml-2 text-xl text-slate-400">kg</span>
              </div>
              <button
                type="button"
                onClick={() => onAnswer("weight", Math.min(120, wVal + 1))}
                className="hover:border-power-orange hover:text-power-orange flex h-12 w-12 select-none items-center justify-center rounded-full border-2 border-slate-200 text-2xl font-light text-slate-600 transition-colors"
              >
                +
              </button>
            </div>
            <input
              type="range"
              min={15}
              max={120}
              step={1}
              value={wVal}
              onChange={(e) => onAnswer("weight", parseInt(e.target.value))}
              className="accent-power-orange w-full"
            />
            <div className="-mt-2 flex justify-between text-xs text-slate-400">
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
              {
                value: "moderate",
                label: `Sometimes ${v("catch", "catches")} it, sometimes ${v("miss", "misses")} — depends on the day`,
              },
              {
                value: "weak",
                label: `Usually ${v("miss", "misses")} or ${v("react")} late to fast-moving objects`,
              },
            ]}
            value={answers.visualTracking}
            onChange={(v) => {
              onAnswer("visualTracking", v as WizardAnswers["visualTracking"]);
              setTimeout(onNext, 200);
            }}
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
            rightExamples="Football, Cricket, Hockey"
          />
        );

      case "competitiveResponse":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "fired-up",
                label: `${cap1(v("get"))} fired up and ${v("want")} to play again immediately`,
              },
              {
                value: "calm",
                label: `${cap1(v("accept"))} it calmly and ${v("move")} on without much fuss`,
              },
              {
                value: "discouraged",
                label: `${cap1(v("get"))} quite upset and ${v("need")} time before wanting to try again`,
              },
            ]}
            value={answers.competitiveResponse}
            onChange={(v) => {
              onAnswer("competitiveResponse", v as WizardAnswers["competitiveResponse"]);
              setTimeout(onNext, 200);
            }}
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
              {
                value: "thrives",
                label: `${cap} performs even better when all eyes are on ${pnObj} — thrives under the spotlight`,
              },
              {
                value: "manages",
                label:
                  "Gets nervous but manages through it — performs reasonably well under pressure",
              },
              {
                value: "avoids",
                label: `${cap} strongly prefers not to be the centre of attention`,
              },
            ]}
            value={answers.pressureResponse}
            onChange={(v) => {
              onAnswer("pressureResponse", v as WizardAnswers["pressureResponse"]);
              setTimeout(onNext, 200);
            }}
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
            onChange={(v) =>
              autoAdvance("repetitionTolerance", v as WizardAnswers["repetitionTolerance"])
            }
          />
        );

      case "eyesight":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "sharp",
                label: `${cap} has clear, sharp vision — no glasses or contacts needed`,
              },
              { value: "corrected", label: `${cap} wears glasses or contact lenses` },
              { value: "limited", label: `${cap} has difficulty seeing clearly even with glasses` },
            ]}
            value={answers.eyesight}
            onChange={(v) => {
              onAnswer("eyesight", v as WizardAnswers["eyesight"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "agility":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "high",
                label: `Very agile — ${name} moves quickly, changes direction easily, and is naturally flexible`,
              },
              {
                value: "moderate",
                label: "Average agility — moves well enough but not exceptional",
              },
              {
                value: "low",
                label: `${cap} is less agile — prefers steadier, less dynamic physical movement`,
              },
            ]}
            value={answers.agility}
            onChange={(v) => {
              onAnswer("agility", v as WizardAnswers["agility"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "contactComfort":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "loves",
                label: `${cap} loves physical contact — wrestling, jostling, bumping into others`,
              },
              { value: "neutral", label: "Neutral — doesn't mind physical contact either way" },
              { value: "avoids", label: `${cap} prefers to avoid physical contact` },
            ]}
            value={answers.contactComfort}
            onChange={(v) => {
              onAnswer("contactComfort", v as WizardAnswers["contactComfort"]);
              setTimeout(onNext, 200);
            }}
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
            onChange={(v) => {
              onAnswer("environment", v as WizardAnswers["environment"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "waterComfort":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "comfortable",
                label: `${cap} is very comfortable in water — loves swimming or being in a pool`,
              },
              { value: "neutral", label: "Okay with water — no strong feeling" },
              { value: "uncomfortable", label: `${cap} is uncomfortable or afraid of water` },
            ]}
            value={answers.waterComfort}
            onChange={(v) => {
              onAnswer("waterComfort", v as WizardAnswers["waterComfort"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "medicalConditions":
        return (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="e.g., Asthma — press Enter to add"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val && !answers.medicalConditions.includes(val)) {
                    onAnswer("medicalConditions", [...answers.medicalConditions, val]);
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
              className="focus:border-power-orange focus:ring-power-orange/15 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2"
            />
            {answers.medicalConditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {answers.medicalConditions.map((cond) => (
                  <span
                    key={cond}
                    className="flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"
                  >
                    {cond}
                    <button
                      type="button"
                      onClick={() =>
                        onAnswer(
                          "medicalConditions",
                          answers.medicalConditions.filter((c) => c !== cond)
                        )
                      }
                      className="ml-0.5 text-orange-400 hover:text-orange-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case "budget":
        return (
          <FourContextCards
            options={[
              {
                value: "under-3k",
                label: "Under ₹3,000/month",
                context: "Covers: cricket, football, chess, hockey",
              },
              {
                value: "3k-7k",
                label: "₹3,000 – ₹7,000/month",
                context: "Covers: badminton, swimming, plus everything above",
              },
              {
                value: "7k-15k",
                label: "₹7,000 – ₹15,000/month",
                context: "Covers: tennis — every sport in our list",
              },
              {
                value: "15k-plus",
                label: "₹15,000+/month",
                context: "Every sport covered — room for premium academies and coaching",
              },
            ]}
            value={answers.budget}
            onChange={(v) => {
              onAnswer("budget", v as WizardAnswers["budget"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "ambition":
        return (
          <FourContextCards
            options={[
              {
                value: "fun",
                label: "Health, confidence, and fun",
                context: "No pressure on results — sport as a positive life habit",
              },
              {
                value: "competitive",
                label: "District and state-level competition",
                context: "Serious about sport, but not chasing it as a livelihood",
              },
              {
                value: "national",
                label: "National representation",
                context: "We are committed to the long journey this requires",
              },
              {
                value: "career",
                label: "Building a career in sport",
                context: "A sports-quota job, a college place, or turning pro",
              },
            ]}
            value={answers.ambition}
            onChange={(v) => {
              onAnswer("ambition", v as WizardAnswers["ambition"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "weeklyHours":
        return (
          <FourContextCards
            options={[
              {
                value: "1-3",
                label: "1–3 hours/week",
                context: "A couple of casual sessions — sport fits around everything else",
              },
              {
                value: "4-7",
                label: "4–7 hours/week",
                context: "Regular training — about 1 hour on most days",
              },
              {
                value: "8-12",
                label: "8–12 hours/week",
                context: "Serious commitment — two sessions on many days",
              },
              {
                value: "13-plus",
                label: "13+ hours/week",
                context: "Full dedication — sport is the main priority",
              },
            ]}
            value={answers.weeklyHours}
            onChange={(v) => {
              onAnswer("weeklyHours", v as WizardAnswers["weeklyHours"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "consideringSports":
        return (
          <MultiSelectPills
            options={PRIOR_SPORTS_OPTIONS}
            selected={answers.consideringSports}
            onChange={(v) => onAnswer("consideringSports", v)}
            noneLabel="No — help me decide"
            max={MAX_CONSIDERED_SPORTS}
          />
        );

      default:
        return null;
    }
  };

  const questions: Partial<Record<string, string>> = {
    dob: `What is ${name}'s date of birth?`,
    gender: `Is ${name} a boy or a girl?`,
    state: "Which state are you based in?",
    priorSports: `Has ${name} tried any sport formally before?`,
    consideringSports: `Are there sports you're already considering for ${name}?`,
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
    medicalConditions: `Does ${name} have any medical conditions or physical limitations we should know about?`,
    budget: "What can your family realistically invest in training each month?",
    ambition: "What is your honest goal for this sport journey?",
    weeklyHours: `How many hours per week can ${name} dedicate to sport training?`,
  };

  const questionSubs: Partial<Record<string, string>> = {
    consideringSports: `Pick up to ${MAX_CONSIDERED_SPORTS}, or skip and let us suggest. We'll score each one honestly against everything you tell us next — where ${name} fits, and where ${pn} ${isPlural ? "don't" : "doesn't"}.`,
  };

  const needsNextButton =
    questionKey === "dob" ||
    questionKey === "state" ||
    questionKey === "height" ||
    questionKey === "weight" ||
    questionKey === "priorSports" ||
    questionKey === "medicalConditions" ||
    questionKey === "consideringSports" ||
    questionKey === "teamIndividual";

  const canAdvance = () => {
    if (questionKey === "dob") return !!answers.dob && answers.age !== null;
    if (questionKey === "priorSports") return true;
    if (questionKey === "consideringSports") return true;
    if (questionKey === "medicalConditions") return true;
    if (questionKey === "state") return !!answers.state;
    if (questionKey === "height") return true; // default pre-filled from age
    if (questionKey === "weight") return true; // default pre-filled from age
    if (questionKey === "teamIndividual") return answers.teamIndividual !== null;
    return false;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          {section[questionKey] ?? ""}
        </p>
        <h2 className="font-title text-xl font-bold leading-snug text-slate-900">
          {questions[questionKey] ?? ""}
        </h2>
        {questionSubs[questionKey] && (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{questionSubs[questionKey]}</p>
        )}
      </div>

      {renderInput()}

      {needsNextButton && (
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance()}
          className="bg-power-orange hover:bg-power-orange/90 w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      )}
    </div>
  );
}

// ─── Processing screen ────────────────────────────────────────────────────────

export function ProcessingScreen({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center space-y-4 py-20 text-center"
    >
      <div className="border-power-orange h-12 w-12 animate-spin rounded-full border-2 border-t-transparent" />
      <p className="font-title text-xl font-bold text-slate-900">
        Building {name || "your child"}&apos;s sport profile...
      </p>
      <p className="max-w-xs text-sm text-slate-400">
        Matching what you&apos;ve shared with sport requirements, training pathways, and what&apos;s
        available in your city.
      </p>
    </motion.div>
  );
}
