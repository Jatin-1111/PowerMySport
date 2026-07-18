"use client";

import {
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  RotateCcw,
  Target,
  TrendingUp,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
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
  const [pathwayOpen, setPathwayOpen] = useState(false);
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
      <div className="mx-5 mb-4 rounded-xl bg-slate-50 px-3.5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Cost to try: {result.sport.costRange}
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">{meta.watchFor(name)}</p>
      </div>

      {/* Pathway preview */}
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={() => setPathwayOpen((p) => !p)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors py-2 border-t border-slate-50"
        >
          <span>5-year pathway</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${pathwayOpen ? "rotate-180" : ""}`} />
        </button>

        {pathwayOpen && (
          <div className="mt-2 space-y-2">
            {[
              { year: "Year 1", label: "Academy foundation, technique basics" },
              { year: "Year 2–3", label: "District-level tournaments" },
              { year: "Year 4–5", label: "State circuit eligibility" },
            ].map((step, i) => (
              <div key={i} className="flex gap-2.5 items-center">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? "bg-power-orange" : "bg-slate-200"}`} />
                <p className="text-xs text-slate-500">
                  <span className="text-slate-400 mr-1.5">{step.year}</span>
                  {step.label}
                </p>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-50 flex justify-between text-xs text-slate-500">
              <span>Monthly investment</span>
              <span className="font-medium text-slate-700">{result.sport.costRange}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="px-5 pb-5">
        <p className="text-[10px] text-slate-400 text-center">
          {name} · {answers.state ?? "India"} · {result.sport.costRange}
        </p>
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
          Here&apos;s what we found for {name}
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

      {/* Bottom row: expert CTA + guest save */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Expert CTA */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <p className="font-semibold text-sm text-slate-900 mb-1">
            Not sure? Get a second opinion.
          </p>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">
            Our consultants work with parents across India — academies, costs, and realistic timelines for {name}&apos;s profile.
          </p>
          <div className="space-y-2.5">
            <a
              href="/experts"
              className="flex items-center justify-between w-full bg-slate-900 text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <span>Talk to our Expert</span>
              <span className="text-xs text-white/50">Paid · 1-on-1 →</span>
            </a>
            <a
              href="https://wa.me/918968582443"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full bg-[#25D366] text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[#1ebe5d] transition-colors"
            >
              <span>Talk to our Team</span>
              <span className="text-xs text-white/70">Free · WhatsApp →</span>
            </a>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">No hard sell. Just good advice.</p>
        </div>

        {/* Guest save CTA */}
        {!isLoggedIn ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
            <p className="font-semibold text-sm text-slate-900 mb-1">
              Save {name}&apos;s sport profile
            </p>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Create a free account to save this assessment, get personalised roadmaps, and track {name}&apos;s progress over time.
            </p>
            <a
              href="/register"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Create free account <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-turf-green/10 flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6 text-turf-green" />
            </div>
            <p className="font-semibold text-sm text-slate-900 mb-1">Profile saved</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {name}&apos;s sport profile is saved. You can retake anytime as they grow.
            </p>
          </div>
        )}
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
