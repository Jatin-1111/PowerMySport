"use client";

import {
  ArrowDown,
  Check,
  CheckCircle,
  ClipboardList,
  ListChecks,
  RotateCcw,
  Target,
  TrendingUp,
  Shuffle,
  Sparkles,
} from "lucide-react";
import type { SportFitResult, SportResult, WizardAnswers } from "../../types";
import { JourneyPipeline } from "../JourneyPipeline";
import { ChooseSportButton } from "./ChooseSportButton";
import { SportFitCard } from "./SportFitCard";
import { WhatsNextPanel } from "./WhatsNextPanel";

// ─── Portfolio roles ────────────────────────────────────────────────────────
// Not a similarity ranking (1st/2nd/3rd best) — three different jobs. Best-fit
// is the safest bet on the data; stretch is the higher-ceiling, more-demanding
// pick; easy-start is the cheapest, lowest-commitment way to test interest.

type PortfolioRole = "bestFit" | "stretch" | "easyStart";

const PORTFOLIO_META: Record<
  PortfolioRole,
  {
    icon: typeof Target;
    label: string;
    watchFor: (name: string) => string;
    accentBorder: string;
    badgeBg: string;
    iconBg: string;
    shadow: string;
  }
> = {
  bestFit: {
    icon: Target,
    label: "Best fit",
    watchFor: (name) => `Try it first — watch for ${name} asking to go back without being asked.`,
    accentBorder: "border-t-power-orange",
    badgeBg: "bg-power-orange/10 text-power-orange",
    iconBg: "bg-power-orange/10 text-power-orange",
    shadow: "shadow-md shadow-slate-200/60",
  },
  stretch: {
    icon: TrendingUp,
    label: "Stretch pick",
    watchFor: (name) => `Asks more of ${name} — a good sign is wanting more even after the hard parts.`,
    accentBorder: "border-t-indigo-400",
    badgeBg: "bg-indigo-50 text-indigo-600",
    iconBg: "bg-indigo-50 text-indigo-500",
    shadow: "shadow-sm",
  },
  easyStart: {
    icon: Shuffle,
    label: "Easy start",
    watchFor: () => "Cheapest, lowest-commitment way to test real interest before going further.",
    accentBorder: "border-t-emerald-400",
    badgeBg: "bg-emerald-50 text-emerald-600",
    iconBg: "bg-emerald-50 text-emerald-500",
    shadow: "shadow-sm",
  },
};

// Rough demand ordering from data already on the sport profile — no scoring
// changes, just deciding which of the two non-best-fit picks reads as the
// pricier/more time-hungry "stretch" vs the cheaper "easy start".
const BUDGET_RANK: Record<string, number> = {
  "under-3k": 0,
  "3k-7k": 1,
  "7k-15k": 2,
  "15k-plus": 3,
};

function demandScore(result: SportResult): number {
  return BUDGET_RANK[result.sport.minBudgetTier] * 10 + result.sport.minWeeklyHours;
}

/** Assigns portfolio roles to the top-3 results without touching the scorer. */
function buildPortfolio(
  results: SportResult[],
): Array<{ result: SportResult; role: PortfolioRole }> {
  if (results.length === 0) return [];
  const [bestFit, ...rest] = results;
  const sortedRest = [...rest].sort((a, b) => demandScore(b) - demandScore(a));
  const [stretch, easyStart] = sortedRest;

  const out: Array<{ result: SportResult; role: PortfolioRole }> = [
    { result: bestFit, role: "bestFit" },
  ];
  if (stretch) out.push({ result: stretch, role: "stretch" });
  if (easyStart) out.push({ result: easyStart, role: "easyStart" });
  return out;
}

// The grid has to track how many cards actually survived the shortlist filter —
// a fixed 3-column track left a dead empty column whenever the parent had
// already shortlisted one of our own picks.
const PORTFOLIO_GRID: Record<number, string> = {
  1: "sm:grid-cols-1 sm:max-w-md",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};

// ─── Key findings summary ─────────────────────────────────────────────────────
// A short, deterministic readout of the assessment answers themselves (distinct
// from the per-sport `reasons`, which explain why a specific sport was picked).
// Surfaced once, above the three cards, so parents see what shaped every pick
// before reading the individual justifications.

const BUDGET_LABEL: Record<NonNullable<WizardAnswers["budget"]>, string> = {
  "under-3k": "under ₹3k/month",
  "3k-7k": "₹3-7k/month",
  "7k-15k": "₹7-15k/month",
  "15k-plus": "₹15k+/month",
};

const HOURS_LABEL: Record<NonNullable<WizardAnswers["weeklyHours"]>, string> = {
  "1-3": "1-3 hours a week",
  "4-7": "4-7 hours a week",
  "8-12": "8-12 hours a week",
  "13-plus": "13+ hours a week",
};

const AMBITION_LABEL: Record<NonNullable<WizardAnswers["ambition"]>, string> = {
  fun: "Health & fun",
  competitive: "Competitive",
  national: "National",
  career: "Career in sport",
  professional: "Pro career", // legacy — no longer offered, still stored on older rows
};

// Pronoun helpers — resolve to he/she when gender is known, singular "they"
// only when the parent didn't specify (same fallback rule as the wizard's
// own question prompts).
function pronounsFor(gender: WizardAnswers["gender"]) {
  if (gender === "boy") return { poss: "his", obj: "him" };
  if (gender === "girl") return { poss: "her", obj: "her" };
  return { poss: "their", obj: "them" };
}

function buildKeyFindings(answers: WizardAnswers): string[] {
  const name = answers.childName || "Your child";
  const { poss, obj } = pronounsFor(answers.gender);
  const findings: string[] = [];

  if (answers.energyType === "explosive") {
    findings.push(`${name} has explosive, fast-twitch energy — built for short bursts of power, not long grinding effort.`);
  } else if (answers.energyType === "endurance") {
    findings.push(`${name} has real endurance — built to keep going, not for short bursts.`);
  }

  // The slider runs 1 = "Just me" → 5 = "Team, always" (see SpectrumSlider),
  // so 4–5 is the team end and 1–2 is the solo end.
  if (answers.teamIndividual !== null) {
    if (answers.teamIndividual >= 4) {
      findings.push(`Prefers team environments — plays better with shared effort and shared momentum.`);
    } else if (answers.teamIndividual <= 2) {
      findings.push(`Prefers individual competition — wants the result to rest on ${poss} own performance alone.`);
    }
  }

  if (answers.pressureResponse === "thrives") {
    findings.push(`${name} gets better under pressure — big moments bring out ${poss} best, not ${poss} worst.`);
  } else if (answers.pressureResponse === "avoids") {
    findings.push(`${name} plays better without pressure — high-stakes moments work against ${obj}, not for ${obj}.`);
  }

  if (answers.agility === "high") {
    findings.push(`High agility and flexibility — a real edge in any sport built on quick footwork.`);
  } else if (answers.agility === "low") {
    findings.push(`Agility isn't the strength here — strategy and consistency matter more than raw speed.`);
  }

  if (answers.decisionStyle === "react") {
    findings.push(`${name} reacts fast and trusts instinct — built for sports with no time to think.`);
  } else if (answers.decisionStyle === "strategic") {
    findings.push(`${name} thinks ahead instead of reacting — built for sports that reward planning.`);
  }

  if (answers.budget && answers.weeklyHours) {
    findings.push(`${BUDGET_LABEL[answers.budget]} and ${HOURS_LABEL[answers.weeklyHours]} set the real limit on what's realistic below.`);
  }

  return findings.slice(0, 5);
}

// ─── Report context chips ────────────────────────────────────────────────────
// The wizard's left sidebar (which carried these) is hidden on the results
// step, so the constraints every score was measured against would otherwise
// vanish exactly when the parent starts questioning the numbers.

function buildContextChips(answers: WizardAnswers): Array<{ label: string; value: string }> {
  const chips: Array<{ label: string; value: string }> = [];
  if (answers.age !== null) chips.push({ label: "Age", value: `${answers.age} yrs` });
  if (answers.state) chips.push({ label: "State", value: answers.state });
  if (answers.budget) chips.push({ label: "Budget", value: BUDGET_LABEL[answers.budget] });
  if (answers.weeklyHours)
    chips.push({ label: "Training", value: `${answers.weeklyHours} hrs/wk` });
  if (answers.ambition) chips.push({ label: "Goal", value: AMBITION_LABEL[answers.ambition] });
  return chips;
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  iconClass,
  title,
  sub,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-title text-base font-bold leading-tight text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

function SportCard({
  result,
  answers,
  role,
  chosen,
  saving,
  onChoose,
}: {
  result: SportResult;
  answers: WizardAnswers;
  role: PortfolioRole;
  chosen: boolean;
  saving: boolean;
  onChoose: (sport: string) => void;
}) {
  const name = answers.childName || "Your child";
  const meta = PORTFOLIO_META[role];
  const RoleIcon = meta.icon;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 border-t-4 bg-white ${
        chosen ? "border-turf-green shadow-md shadow-turf-green/10" : `border-slate-100 ${meta.accentBorder} ${meta.shadow}`
      }`}
    >
      {/* Role badge */}
      <div className="border-b border-slate-50 px-5 pb-4 pt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeBg}`}
          >
            <RoleIcon className="h-3 w-3" />
            <span>{meta.label}</span>
          </div>
          <span className="text-xs font-medium text-slate-400">{result.fitLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.iconBg}`}
          >
            <span className="text-xl font-bold">{result.sport.name[0]}</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-title text-xl font-bold leading-tight text-slate-900">
              {result.sport.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">{result.sport.tagline}</p>
          </div>
        </div>
      </div>

      {/* Reasons — specific to this child's answers */}
      <div className="flex-1 space-y-2.5 px-5 py-4">
        {result.reasons.slice(0, 3).map((reason, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-turf-green/10">
              <Check className="h-2.5 w-2.5 text-turf-green" />
            </div>
            <p className="text-xs leading-relaxed text-slate-600">{reason}</p>
          </div>
        ))}
      </div>

      {/* What to watch for in a trial */}
      <div className="mx-5 mb-4 rounded-xl bg-slate-50 px-3.5 py-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Cost to try: {result.sport.costRange}
        </p>
        <p className="text-xs leading-relaxed text-slate-600">{meta.watchFor(name)}</p>
      </div>

      {/* The decision — available on our picks too, not just their shortlist */}
      <div className="px-5 pb-5">
        <ChooseSportButton
          sportName={result.sport.name}
          chosen={chosen}
          saving={saving}
          onChoose={onChoose}
          tone="subtle"
        />
      </div>
    </div>
  );
}

// ─── Shortlist summary ───────────────────────────────────────────────────────
// One deterministic sentence over the parent's own picks, so the page leads
// with a verdict instead of making them compare three numbers themselves.

function shortlistSummary(fits: SportFitResult[], name: string): string {
  const best = [...fits].sort((a, b) => b.score - a.score)[0];
  if (!best) return "";
  const blocked = fits.filter((f) => f.hasBlocker);

  if (fits.length === 1) {
    return best.hasBlocker
      ? `${best.sport.name} scores ${best.score}/100 for ${name}, but there's something to sort out first — it's in the right-hand column below.`
      : `${best.sport.name} scores ${best.score}/100 for ${name}. Here's exactly what's behind that number.`;
  }

  const lead = `Of the ${fits.length} you picked, ${best.sport.name} lines up best for ${name} at ${best.score}/100.`;
  if (blocked.length === 0) return `${lead} Every one of them has something that fits and something that doesn't — both are below.`;
  if (blocked.length === fits.length) return `${lead} All of them have something to sort out first — see the right-hand column on each.`;
  return `${lead} ${blocked.length === 1 ? `${blocked[0].sport.name} has` : `${blocked.length} of them have`} something to sort out first.`;
}

function scrollToNextStep() {
  document.getElementById("next-step")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ResultsView({
  results,
  chosenFits = [],
  answers,
  onRetake,
  savedStatus = "idle",
  isLoggedIn = false,
  savedForName,
  dependentId,
  chosenSport = null,
  choosingSport = false,
  onChooseSport,
}: {
  results: SportResult[];
  /** The parent's own shortlist, scored — leads the page when non-empty. */
  chosenFits?: SportFitResult[];
  answers: WizardAnswers;
  onRetake: () => void;
  savedStatus?: "idle" | "saving" | "saved" | "error";
  isLoggedIn?: boolean;
  savedForName?: string;
  dependentId?: string;
  /** The sport the parent committed to, once they've said so. */
  chosenSport?: string | null;
  choosingSport?: boolean;
  onChooseSport?: (sport: string) => void;
}) {
  const name = answers.childName || "Your child";
  const hasShortlist = chosenFits.length > 0;

  // Our own recommendations still run — but a sport the parent already
  // shortlisted is covered in full above, so repeating it as a "suggestion"
  // would just be the same sport twice with a thinner writeup.
  const chosenIds = new Set(chosenFits.map((f) => f.sport.id));
  const topResults = results.slice(0, 3);
  const portfolio = buildPortfolio(topResults).filter(({ result }) => !chosenIds.has(result.sport.id));

  const keyFindings = buildKeyFindings(answers);
  const contextChips = buildContextChips(answers);
  const isUnderTen = answers.age !== null && answers.age <= 10;

  // Cards run best-scoring first. The scorer deliberately keeps the parent's own
  // selection order, but that order means nothing to them once every card is
  // headed by a score — a 77 sitting above an 84 just reads as broken sorting.
  const orderedFits = [...chosenFits].sort((a, b) => b.score - a.score);

  // Everything downstream (trial booking, WhatsApp copy, the 4-week check-in)
  // hangs off one sport. An explicit choice outranks everything: until the
  // parent makes one we fall back to the strongest of their own picks, then to
  // our top recommendation — but those are inferences, and this isn't.
  const topFit = orderedFits[0];
  const inferredSport = topFit?.sport.name ?? topResults[0]?.sport.name;
  const primarySportName = chosenSport ?? inferredSport;
  const headlineSport = primarySportName;
  const chooseProps = (sport: string) => ({
    chosen: chosenSport === sport,
    saving: choosingSport,
    onChoose: onChooseSport ?? (() => {}),
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 pb-12 duration-300">
      {/* ── Report header ──
          The verdict, the constraints it was measured against, and the way
          forward all land above the fold instead of the parent having to read
          three long cards before finding either. */}
      <header className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Assessment complete
              </p>
              {savedStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                  <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Saving to {savedForName ?? "profile"}…
                </span>
              )}
              {savedStatus === "saved" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                  <CheckCircle className="h-3 w-3 shrink-0" />
                  Saved to {savedForName ?? "profile"}&apos;s profile
                </span>
              )}
              {savedStatus === "error" && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  Couldn&apos;t save automatically — results are still shown below
                </span>
              )}
            </div>

            <h1 className="font-title text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              {hasShortlist
                ? `How ${name} fits the sports you're considering`
                : `${name}'s personalised sports roadmap`}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
              {hasShortlist
                ? shortlistSummary(chosenFits, name)
                : "Three different picks, not a ranking — a safe best-fit, a stretch worth trying, and an economical way to start."}
            </p>
          </div>

          {/* Headline verdict — the one number (or the one sport) plus the way
              forward, so the CTA isn't only reachable after a long scroll. */}
          {headlineSport && (
            <div className="w-full shrink-0 rounded-2xl bg-slate-900 p-5 lg:w-[268px]">
              <p
                className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                  chosenSport ? "text-turf-green" : "text-power-orange"
                }`}
              >
                {chosenSport ? "You're starting with" : topFit ? "Strongest fit" : "Best fit"}
              </p>
              <p className="font-title mt-1 text-2xl font-bold leading-tight text-white">
                {headlineSport}
              </p>

              {/* The score belongs to our verdict — once the parent has made
                  their own call, leading with our number undercuts it. */}
              {topFit && !chosenSport && (
                <div className="mt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-title text-3xl font-bold tabular-nums leading-none text-white">
                      {topFit.score}
                    </span>
                    <span className="text-xs font-medium text-slate-500">/ 100</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {topFit.hasBlocker ? "Needs a fix" : topFit.fitLabel}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-power-orange transition-all duration-700"
                      style={{ width: `${topFit.score}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={scrollToNextStep}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-power-orange px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-orange-600"
              >
                Book a trial class
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Constraints every score was measured against */}
        {contextChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3 sm:px-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Scored against
            </span>
            {contextChips.map((chip) => (
              <span key={chip.label} className="flex items-baseline gap-1.5 text-xs">
                <span className="text-slate-400">{chip.label}</span>
                <span className="font-semibold text-slate-700">{chip.value}</span>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Under-10 multi-sport framing — don't push specialisation this young */}
      {isUnderTen && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <p className="text-sm leading-relaxed text-indigo-900">
            At {answers.age}, we wouldn&apos;t pick just one yet — playing 2-3 of these together builds broader athleticism than specialising early. Treat the ones below as sports to rotate between, not a single choice to commit to.
          </p>
        </div>
      )}

      {/* Key findings from the assessment */}
      {keyFindings.length > 0 && (
        <section className="mb-10 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeader
            icon={<ListChecks className="h-4 w-4 text-indigo-500" />}
            iconClass="bg-indigo-50"
            title="Key findings from the assessment"
            sub={
              hasShortlist
                ? "What every score below is measured against"
                : `What shaped ${name}'s recommendations below`
            }
          />
          {/* Two tracks on desktop — as a single column this list ran the full
              page width at ~90 characters a line and pushed the cards down. */}
          <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
            {keyFindings.map((finding, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <Check className="h-2.5 w-2.5 text-indigo-500" />
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{finding}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── The parent's own shortlist, scored ── */}
      {hasShortlist && (
        <section className="mb-10">
          <SectionHeader
            icon={<ClipboardList className="h-4 w-4 text-power-orange" />}
            iconClass="bg-power-orange/10"
            title="Sports you're considering"
            sub="Scored on the same engine we use for our own recommendations — best fit first"
          />

          <div className="space-y-5">
            {orderedFits.map((fit, i) => (
              <SportFitCard
                key={fit.sport.id}
                fit={fit}
                answers={answers}
                eyebrow={
                  orderedFits.length > 1 && i === 0 ? "Best of your picks" : "Your shortlist"
                }
                {...chooseProps(fit.sport.name)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Our own recommendations ── */}
      {portfolio.length > 0 && (
        <section className="mb-10">
          {hasShortlist && (
            <SectionHeader
              icon={<Sparkles className="h-4 w-4 text-slate-500" />}
              iconClass="bg-slate-100"
              title="Also worth a look"
              sub={`Sports you didn't pick that ${name}'s answers point toward`}
            />
          )}

          <div className={`grid grid-cols-1 items-stretch gap-5 ${PORTFOLIO_GRID[portfolio.length] ?? "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {portfolio.map(({ result, role }) => (
              <SportCard
                key={result.sport.id}
                result={result}
                answers={answers}
                role={role}
                {...chooseProps(result.sport.name)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Next step — book a trial class */}
      {/* scroll-mt clears the fixed 65px site nav — without it the card's own
          header lands underneath the bar when the hero CTA jumps here. */}
      <div id="next-step" className="scroll-mt-20">
        <JourneyPipeline childName={name} topSport={primarySportName} onRetake={onRetake} />
      </div>

      {/* CTA section — screening and expert session as optional add-ons */}
      <WhatsNextPanel
        childName={name}
        topSport={primarySportName}
        dependentId={dependentId}
        isLoggedIn={isLoggedIn}
      />

      {/* Retake */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-600"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retake the assessment
        </button>
      </div>
    </div>
  );
}
