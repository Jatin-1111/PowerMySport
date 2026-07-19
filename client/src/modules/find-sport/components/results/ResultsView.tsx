"use client";

import {
  ArrowRight,
  Check,
  CheckCircle,
  RotateCcw,
  Target,
  TrendingUp,
  Shuffle,
  Sparkles,
  Users,
} from "lucide-react";
import type { SportResult, WizardAnswers } from "../../types";
// import { JourneyPipeline } from "../JourneyPipeline"; // SCREENING_DISABLED

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
    scale: string;
  }
> = {
  bestFit: {
    icon: Target,
    label: "Best fit",
    watchFor: (name) => `Try it first — watch for ${name} asking to go back without being asked.`,
    accentBorder: "border-t-power-orange",
    badgeBg: "bg-power-orange/10 text-power-orange",
    iconBg: "bg-power-orange/10 text-power-orange",
    shadow: "shadow-lg shadow-slate-200/60",
    scale: "md:scale-[1.02] md:z-10",
  },
  stretch: {
    icon: TrendingUp,
    label: "Stretch pick",
    watchFor: (name) => `Asks more of ${name} — a good sign is wanting more even after the hard parts.`,
    accentBorder: "border-t-indigo-400",
    badgeBg: "bg-indigo-50 text-indigo-600",
    iconBg: "bg-indigo-50 text-indigo-500",
    shadow: "shadow-sm",
    scale: "",
  },
  easyStart: {
    icon: Shuffle,
    label: "Easy start",
    watchFor: () => "Cheapest, lowest-commitment way to test real interest before going further.",
    accentBorder: "border-t-emerald-400",
    badgeBg: "bg-emerald-50 text-emerald-600",
    iconBg: "bg-emerald-50 text-emerald-500",
    shadow: "shadow-sm",
    scale: "",
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

function SportCard({
  result,
  answers,
  role,
}: {
  result: SportResult;
  answers: WizardAnswers;
  role: PortfolioRole;
}) {
  const name = answers.childName || "Your child";
  const meta = PORTFOLIO_META[role];
  const RoleIcon = meta.icon;

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-white border-2 border-slate-100 border-t-4 ${meta.accentBorder} ${meta.shadow} ${meta.scale} transition-transform`}
    >
      {/* Role badge */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-50">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badgeBg}`}>
            <RoleIcon className="w-3 h-3" />
            <span>{meta.label}</span>
          </div>
          <span className="text-xs font-medium text-slate-400">{result.fitLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
            <span className="text-xl font-bold">{result.sport.name[0]}</span>
          </div>
          <div>
            <h2 className="font-title text-xl font-bold text-slate-900 leading-tight">
              {result.sport.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{result.sport.tagline}</p>
          </div>
        </div>
      </div>

      {/* Reasons — specific to this child's answers */}
      <div className="px-5 py-4 flex-1 space-y-2.5">
        {result.reasons.slice(0, 3).map((reason, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <div className="w-4 h-4 rounded-full bg-turf-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-2.5 h-2.5 text-turf-green" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{reason}</p>
          </div>
        ))}
      </div>

      {/* What to watch for in a trial */}
      <div className="mx-5 mb-5 rounded-xl bg-slate-50 px-3.5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Cost to try: {result.sport.costRange}
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">{meta.watchFor(name)}</p>
      </div>
    </div>
  );
}

export function ResultsView({
  results,
  answers,
  onRetake,
  savedStatus = "idle",
  isLoggedIn = false,
  savedForName,
}: {
  results: SportResult[];
  answers: WizardAnswers;
  onRetake: () => void;
  savedStatus?: "idle" | "saving" | "saved" | "error";
  isLoggedIn?: boolean;
  savedForName?: string;
}) {
  const name = answers.childName || "Your child";
  const topResults = results.slice(0, 3);
  const portfolio = buildPortfolio(topResults);
  const isUnderTen = answers.age !== null && answers.age <= 10;

  return (
    <div className="pb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Assessment complete
        </p>
        <h1 className="font-title text-3xl font-bold text-slate-900 mb-2">
          Your Child&apos;s Personalised Sports Roadmap
        </h1>
        <p className="text-sm text-slate-500">
          Three different picks, not a ranking — a safe best-fit, a stretch worth trying, and a cheap way to start.
        </p>
      </div>

      {/* Under-10 multi-sport framing — don't push specialisation this young */}
      {isUnderTen && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5 mb-6">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-900 leading-relaxed">
            At {answers.age}, we wouldn&apos;t pick just one yet — playing 2-3 of these together builds broader athleticism than specialising early. Treat the three below as sports to rotate between, not a single choice to commit to.
          </p>
        </div>
      )}

      {/* Save status */}
      {savedStatus === "saving" && (
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl mb-6">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin flex-shrink-0" />
          Saving to {savedForName ?? "profile"}…
        </div>
      )}
      {savedStatus === "saved" && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-2.5 rounded-xl mb-6">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Saved to {savedForName ?? "profile"}&apos;s profile
        </div>
      )}
      {savedStatus === "error" && (
        <div className="text-sm text-amber-700 bg-amber-50 px-4 py-2.5 rounded-xl mb-6">
          Couldn&apos;t save automatically — your results are still shown below.
        </div>
      )}

      {/* Sport cards — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 md:items-stretch">
        {portfolio.map(({ result, role }) => (
          <SportCard key={result.sport.id} result={result} answers={answers} role={role} />
        ))}
      </div>

      {/* Journey pipeline — SCREENING_DISABLED
      <JourneyPipeline
        childName={name}
        topSport={topResults[0]?.sport.name}
      />
      */}

      {/* What's next — unified dark panel */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 mb-8">
        {/* Ambient glow accents */}
        <div className="pointer-events-none absolute -top-28 -right-20 w-72 h-72 rounded-full bg-power-orange/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 w-72 h-72 rounded-full bg-violet-500/[0.07] blur-3xl" />

        {/* Panel header */}
        <div className="relative px-6 sm:px-8 pt-7 pb-6 border-b border-white/[0.06]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40 mb-2">
            What&apos;s next
          </p>
          <h3 className="font-title text-xl font-bold text-white">
            Three ways to keep {name}&apos;s momentum going
          </h3>
        </div>

        {/* Columns */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
          {/* Expert */}
          <div className="group flex flex-col p-6 sm:p-7 transition-colors duration-300 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-power-orange/15 ring-1 ring-power-orange/20 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105">
              <Sparkles className="w-[18px] h-[18px] text-power-orange" />
            </div>
            <p className="font-semibold text-[15px] text-white mb-1.5">
              Get a second opinion
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">
              Our consultants work with parents across India — academies, costs, and realistic timelines for {name}&apos;s profile.
            </p>
            <a
              href="/experts"
              className="group/cta flex items-center justify-center gap-2 w-full bg-white text-slate-900 rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:bg-slate-100 hover:shadow-lg hover:shadow-black/20"
            >
              Talk to our Expert
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
            </a>
            <a
              href="https://wa.me/918968582443"
              target="_blank"
              rel="noopener noreferrer"
              className="group/wa flex items-center justify-center gap-1.5 mt-3.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              or chat free on WhatsApp
              <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover/wa:translate-x-0.5" />
            </a>
          </div>

          {/* Community */}
          <div className="group flex flex-col p-6 sm:p-7 transition-colors duration-300 hover:bg-white/[0.03]">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 ring-1 ring-violet-400/20 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105">
              <Users className="w-[18px] h-[18px] text-violet-400" />
            </div>
            <p className="font-semibold text-[15px] text-white mb-1.5">
              Join the community
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">
              Parents navigating the same journey — academy reviews, training tips, and real experiences from across India.
            </p>
            <a
              href="/community"
              className="group/cta flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-semibold border border-white/15 text-white transition-all duration-200 hover:bg-white hover:border-white hover:text-slate-900"
            >
              Explore Community
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
            </a>
            <p className="text-[11px] text-white/30 text-center mt-3.5">Free to join. Always.</p>
          </div>

          {/* Save profile */}
          {!isLoggedIn ? (
            <div className="group flex flex-col p-6 sm:p-7 transition-colors duration-300 hover:bg-white/[0.03]">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 ring-1 ring-sky-400/20 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105">
                <CheckCircle className="w-[18px] h-[18px] text-sky-400" />
              </div>
              <p className="font-semibold text-[15px] text-white mb-1.5">
                Save {name}&apos;s profile
              </p>
              <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">
                Keep this assessment, get personalised roadmaps, and track {name}&apos;s progress as they grow.
              </p>
              <a
                href="/register"
                className="group/cta flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-semibold border border-white/15 text-white transition-all duration-200 hover:bg-white hover:border-white hover:text-slate-900"
              >
                Create free account
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
              </a>
              <p className="text-[11px] text-white/30 text-center mt-3.5">Takes less than a minute.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 sm:p-7">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-[18px] h-[18px] text-emerald-400" />
              </div>
              <p className="font-semibold text-[15px] text-white mb-1.5">Profile saved</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                {name}&apos;s sport profile is saved. Retake anytime as they grow.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Retake */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retake the assessment
        </button>
      </div>
    </div>
  );
}
