"use client";

import { getCommunityAppUrl } from "@/lib/community/url";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { LoginRequiredModal } from "@/modules/guidance/components/chat/LoginRequiredModal";
import {

    FUNNEL_AND_EXIT_VALUE,
    MacroLevel,
    mergeAgeRanges,
} from "@/modules/sports/config/macroLevels";
import {
    PathwayLevel,
    ProgressionPlan,
    pathwayApi,
} from "@/modules/sports/services/pathway";
import { motion } from "framer-motion";
import {
    Activity,
    AlertTriangle,

    BarChart3,
    BookOpen,
    BrainCircuit,
    Calendar,
    CheckCircle,
    CheckCircle2,
    ChevronRight,
    Circle,
    ClipboardList,
    Clock,
    Compass,
    ExternalLink,
    FileText,
    GraduationCap,
    HeartHandshake,
    Landmark,
    Map,
    MapPin,
    Pin,
    Shield,
    Sparkles,
    Star,
    Target,
    TrendingUp,
    Trophy,
    UserCheck,
    Users,
    Wallet,
    Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
    COACHING_FEE_TIERS,
    pathwayLevels,
    SPRING_STIFF
} from '../config/constants';
import {
    buildDiscoveryUrl
} from '../utils';

// ─── Dynamic pathway detail ────────────────────────────────────────────────────

export function getParentalCommitment(rawLevel: number) {
  return (
    pathwayLevels.find((l) => l.level === rawLevel)?.parentalCommitment || {
      time: "Varies",
      financial: "Varies",
      travel: "Varies",
      role: "Supportive Parent",
    }
  );
}

export function PathwayLevelDetail({
  macroLevel,
  sportName,
  state,
  nextMacroLevel,
}: {
  macroLevel: MacroLevel;
  sportName?: string;
  state?: string;
  nextMacroLevel?: MacroLevel;
}) {
  const sName = sportName && sportName !== "General" ? sportName : "";
  const communityUrl = getCommunityAppUrl();
  const { user } = useAuthStore();

  const [innerTab, setInnerTab] = useState("expect");
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [activeSubVariantId, setActiveSubVariantId] = useState<
    "national" | "international"
  >("national");
  type ProgressionFetchState = "idle" | "loading" | "error" | { plan: ProgressionPlan };
  const [progressionState, setProgressionState] = useState<ProgressionFetchState>("idle");
  const tabContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInnerTab("expect");
    setActiveSubVariantId("national");
    setProgressionState("idle");
  }, [macroLevel.id]);

  // Switching tabs should always start the parent at the top of the new
  // content — otherwise a scroll position left over from the previous tab
  // makes the new tab look blank/broken until they scroll back up.
  useEffect(() => {
    tabContentRef.current?.scrollTo({ top: 0 });
  }, [innerTab, activeSubVariantId]);

  // Lazily fetch the progression plan on first click of the Level Up Plan tab.
  useEffect(() => {
    if (innerTab !== "levelup" || !nextMacroLevel || !sName || !state) return;
    if (progressionState !== "idle") return;
    setProgressionState("loading");
    pathwayApi
      .getProgressionPlan(sName, state, macroLevel.representativeRawLevel)
      .then((plan) => setProgressionState(plan ? { plan } : "error"))
      .catch(() => setProgressionState("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [innerTab, progressionState]);

  // Beginner/Intermediate show all their raw level(s) merged with dividers;
  // Competitive is a genuine fork — only the selected sub-variant renders.
  const subVariant =
    macroLevel.subVariants?.find((v) => v.id === activeSubVariantId) ??
    macroLevel.subVariants?.[0];
  const displayLevels: PathwayLevel[] = macroLevel.subVariants
    ? macroLevel.rawLevels.filter((l) => l.level === subVariant?.rawLevel)
    : macroLevel.rawLevels;
  const isMerged = displayLevels.length > 1;
  const colors = macroLevel;
  const lLabel = subVariant ? subVariant.label : macroLevel.label;
  const representativeLevel =
    subVariant?.rawLevel ?? macroLevel.representativeRawLevel;

  const hasReady = displayLevels.some((l) => l.benchmarks || l.talentSignals);
  const hasCompeteInfo = displayLevels.some(
    (l) => l.trialInfo || l.competitions || l.governmentSchemes?.length,
  );
  const hasCoachSafety = displayLevels.some(
    (l) =>
      l.coachSelectionGuide ||
      l.localResources ||
      l.injuryRisks ||
      l.mentalSkillsFocus?.length ||
      l.academicIntegration ||
      l.proactiveDocuments?.length,
  );

  const innerTabs = [
    {
      id: "expect",
      label: "What to Expect",
      icon: <Target className="h-3 w-3" />,
    },
    ...(hasReady
      ? [
          {
            id: "ready",
            label: "Ready to Move Up?",
            icon: <TrendingUp className="h-3 w-3" />,
          },
        ]
      : []),
    ...(hasCompeteInfo
      ? [
          {
            id: "compete",
            label: "Getting Into Competition",
            icon: <Trophy className="h-3 w-3" />,
          },
        ]
      : []),
    ...(hasCoachSafety
      ? [
          {
            id: "coach",
            label: "Coach, Safety & Paperwork",
            icon: <Users className="h-3 w-3" />,
          },
        ]
      : []),
    ...(nextMacroLevel
      ? [
          {
            id: "levelup",
            label: "Level Up Plan",
            icon: <Zap className="h-3 w-3" />,
          },
        ]
      : []),
  ];

  // ── At-a-glance strip ──
  const leadLevel = displayLevels[displayLevels.length - 1];
  const ageRangeLabel = mergeAgeRanges(displayLevels.map((l) => l.ageRange));
  const guidanceHref = sName
    ? `/guidance?sport=${encodeURIComponent(sName)}&level=${representativeLevel}&mode=level-plan&levelLabel=${encodeURIComponent(lLabel)}${state ? `&state=${encodeURIComponent(state)}` : ""}`
    : "";

  return (
    <motion.div
      key={macroLevel.id}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={SPRING_STIFF}
      className={`relative flex flex-col rounded-3xl border-2 bg-gradient-to-br ${colors.bg} ${colors.border} shadow-xl`}
    >
      {/* ── National / International picker (Competitive only) ── */}
      {macroLevel.subVariants && (
        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2 px-5 sm:px-6 pt-4 pb-4 border-b border-white/60">
          {macroLevel.subVariants.map((v) => {
            const active = v.id === activeSubVariantId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveSubVariantId(v.id)}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  active
                    ? "bg-white border-current shadow-md " + v.accentText
                    : "border-slate-200 bg-white/50 hover:bg-white/80"
                }`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${active ? v.accentText : "text-slate-500"}`}
                >
                  {v.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  {v.blurb}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── At-a-glance strip ── */}
      <div className="shrink-0 flex flex-wrap gap-2 px-5 sm:px-6 pt-4 pb-4 border-b border-white/60">
        {leadLevel?.keyFocus && (
          <div className="flex items-center gap-1.5 rounded-lg border border-white/70 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">
            <Target className={`h-3.5 w-3.5 ${colors.text}`} />{" "}
            {leadLevel.keyFocus}
          </div>
        )}
        {ageRangeLabel && (
          <div className="flex items-center gap-1.5 rounded-lg border border-white/70 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">
            <Calendar className={`h-3.5 w-3.5 ${colors.text}`} />{" "}
            {ageRangeLabel}
          </div>
        )}
      </div>

      {/* ── Inner tab navigation ── */}
      {innerTabs.length > 1 && (
        <div className="shrink-0 px-5 sm:px-6 pt-3">
          <div className="flex gap-1 rounded-xl bg-white/70 p-1">
            {innerTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                onClick={() => setInnerTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition-all duration-200 ${
                  innerTab === t.id
                    ? `bg-white ${colors.text} shadow-sm`
                    : `text-slate-600 hover:text-slate-900 hover:bg-white/60`
                }`}
              >
                {t.icon}
                <span className="hidden lg:inline truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab content ── */}
      {/* Plain conditional swap, no enter/exit animation — an animated
          crossfade here can visibly stall mid-transition under any render
          delay, leaving faded stale content on screen; an instant swap
          can't get stuck. */}
      <div
        ref={tabContentRef}
        className="p-5 sm:p-6"
      >
        {/* ── What to Expect ── */}
        {innerTab === "expect" && (
          <div className="space-y-5">
            {/* Straight talk — honest about the pyramid narrowing, and what
                reaching or stopping at this tier is genuinely worth. General
                truths about competitive pyramids, not sport-specific stats
                we don't have real data for. */}
            <div className={`rounded-2xl border bg-white/90 p-4 sm:p-5 ${colors.border} shadow-sm space-y-3`}>
              <div className="flex items-start gap-2.5">
                <BarChart3 className={`h-4 w-4 shrink-0 mt-0.5 ${colors.text}`} />
                <p className="text-xs leading-relaxed text-slate-600">
                  {FUNNEL_AND_EXIT_VALUE[macroLevel.id].funnelNote}
                </p>
              </div>
              <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100">
                <Star className={`h-4 w-4 shrink-0 mt-0.5 ${colors.text}`} />
                <p className="text-xs leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-700">What this is worth: </span>
                  {FUNNEL_AND_EXIT_VALUE[macroLevel.id].exitValueNote}
                </p>
              </div>
            </div>
            {displayLevels.map((lvl, idx) => {
              const commitment =
                (lvl as any).parentalCommitment ||
                getParentalCommitment(lvl.level);
              return (
                <div
                  key={lvl.level}
                  className={
                    idx > 0
                      ? "pt-5 mt-5 border-t border-dashed border-slate-300"
                      : ""
                  }
                >
                  {isMerged && (
                    <p
                      className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${colors.text}`}
                    >
                      {lvl.label} Level
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-slate-600">
                    {lvl.description}
                  </p>

                  {/* Parent's Corner */}
                  <div
                    className={`mt-4 rounded-2xl border bg-white/90 p-4 sm:p-5 ${colors.border} shadow-sm`}
                  >
                    <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <HeartHandshake className={"h-4 w-4 " + colors.text} />
                      Parent's Corner
                    </h4>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {[
                        {
                          icon: <Clock className="h-3.5 w-3.5" />,
                          label: "Time",
                          value: commitment.time,
                        },
                        {
                          icon: <Wallet className="h-3.5 w-3.5" />,
                          label: "Budget",
                          value: commitment.financial,
                        },
                        {
                          icon: <Map className="h-3.5 w-3.5" />,
                          label: "Travel",
                          value: commitment.travel,
                        },
                        {
                          icon: <Compass className="h-3.5 w-3.5" />,
                          label: "Your Role",
                          value: commitment.role,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-start gap-2.5"
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${colors.gradient} text-white shadow-sm`}
                          >
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                              {item.label}
                            </p>
                            <p className="text-xs font-semibold text-slate-800 leading-snug">
                              {item.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key Objectives */}
                  <div className="mt-4">
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <TrendingUp className="h-3.5 w-3.5" /> Key Objectives
                    </h4>
                    <ul className="space-y-2">
                      {lvl.steps.map((step: string, i: number) => {
                        const discUrl = sName
                          ? buildDiscoveryUrl(step, sName)
                          : null;
                        return (
                          <li
                            key={i}
                            className="flex items-start gap-2.5 group"
                          >
                            <CheckCircle
                              className={
                                "mt-0.5 h-4 w-4 shrink-0 " + colors.text
                              }
                            />
                            <span className="flex-1 min-w-0 text-sm leading-relaxed text-slate-700">
                              {step}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Ready to Move Up? ── */}
        {innerTab === "ready" && hasReady && (
          <div className="space-y-5">
            {displayLevels.map((lvl, idx) =>
              !lvl.benchmarks && !lvl.talentSignals ? null : (
                <div
                  key={lvl.level}
                  className={
                    idx > 0
                      ? "pt-5 mt-5 border-t border-dashed border-slate-300 space-y-5"
                      : "space-y-5"
                  }
                >
                  {isMerged && (
                    <p
                      className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}
                    >
                      {lvl.label} Level
                    </p>
                  )}
                  {lvl.benchmarks && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                        <BarChart3 className="h-3.5 w-3.5" /> Performance
                        Benchmarks
                      </h4>
                      <p className="mb-3 text-sm text-slate-600 leading-relaxed">
                        {lvl.benchmarks.description}
                      </p>
                      {lvl.benchmarks.metrics?.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-400">
                                  Metric
                                </th>
                                <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-slate-400">
                                  Target
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {lvl.benchmarks.metrics.map(
                                (
                                  m: { metric: string; target: string },
                                  i: number,
                                ) => (
                                  <tr
                                    key={i}
                                    className="hover:bg-indigo-50/40 transition-colors"
                                  >
                                    <td className="px-3 py-2.5 font-semibold text-slate-700">
                                      {m.metric}
                                    </td>
                                    <td className="px-3 py-2.5 font-bold text-indigo-700">
                                      {m.target}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {lvl.talentSignals && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
                        <BrainCircuit className="h-3.5 w-3.5" /> Signs They're
                        Ready
                      </h4>
                      <div className="space-y-3">
                        {[
                          {
                            label: "Physical",
                            items: lvl.talentSignals.physicalMarkers,
                          },
                          {
                            label: "Cognitive",
                            items: lvl.talentSignals.cognitiveMarkers,
                          },
                          {
                            label: "Behavioral",
                            items: lvl.talentSignals.behavioralMarkers,
                          },
                        ].map(
                          (group) =>
                            group.items?.length > 0 && (
                              <div key={group.label}>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mb-1.5">
                                  {group.label}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.items.map((m: string, i: number) => (
                                    <span
                                      key={i}
                                      className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-800"
                                    >
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        )}

        {/* ── Getting Into Competition ── */}
        {innerTab === "compete" && hasCompeteInfo && (
          <div className="space-y-5">
            {displayLevels.map((lvl, idx) =>
              !lvl.trialInfo &&
              !lvl.competitions &&
              !lvl.governmentSchemes?.length ? null : (
                <div
                  key={lvl.level}
                  className={
                    idx > 0
                      ? "pt-5 mt-5 border-t border-dashed border-slate-300 space-y-5"
                      : "space-y-5"
                  }
                >
                  {isMerged && (
                    <p
                      className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}
                    >
                      {lvl.label} Level
                    </p>
                  )}
                  {lvl.competitions && (
                    <div className="rounded-lg border border-slate-200 bg-white/80 px-3.5 py-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Typical Competitions
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        {lvl.competitions}
                      </p>
                    </div>
                  )}
                  {lvl.trialInfo && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700">
                        <Calendar className="h-3.5 w-3.5" /> Trial & Selection
                        Calendar
                      </h4>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-lg bg-white/80 border border-sky-100 p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                            Typical Months
                          </p>
                          <p className="text-xs font-semibold text-sky-800">
                            {lvl.trialInfo.typicalMonths}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/80 border border-sky-100 p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                            Eligibility Age
                          </p>
                          <p className="text-xs font-semibold text-sky-800">
                            {lvl.trialInfo.eligibilityAge}
                          </p>
                        </div>
                      </div>
                      <div className="mb-3 rounded-lg bg-white/80 border border-sky-100 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                          Registration Process
                        </p>
                        <p className="text-xs text-slate-700">
                          {lvl.trialInfo.registrationProcess}
                        </p>
                      </div>
                      {lvl.trialInfo.selectionCriteria?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Selection Criteria
                          </p>
                          <ul className="space-y-1">
                            {lvl.trialInfo.selectionCriteria.map(
                              (c: string, i: number) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-xs text-slate-700"
                                >
                                  <CheckCircle
                                    className={
                                      "mt-0.5 h-3.5 w-3.5 shrink-0 " +
                                      colors.text
                                    }
                                  />
                                  {c}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                      {lvl.trialInfo.tips?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Tips to Crack the Trial
                          </p>
                          <ul className="space-y-1">
                            {lvl.trialInfo.tips.map((t: string, i: number) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-slate-700"
                              >
                                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {lvl.governmentSchemes &&
                    lvl.governmentSchemes.length > 0 && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
                          <Landmark className="h-3.5 w-3.5" /> Government
                          Schemes & Funding
                        </h4>
                        <div className="space-y-3">
                          {lvl.governmentSchemes.map((scheme, i: number) => (
                            <div
                              key={i}
                              className="rounded-xl border border-indigo-100 bg-white/90 p-3"
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <GraduationCap className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                                <p className="text-xs font-bold text-violet-900">
                                  {scheme.name}
                                </p>
                              </div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                {scheme.body}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                  <p className="font-bold text-slate-400 text-[9px] uppercase mb-0.5">
                                    Eligibility
                                  </p>
                                  <p className="text-slate-700">
                                    {scheme.eligibility}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-bold text-slate-400 text-[9px] uppercase mb-0.5">
                                    Benefit
                                  </p>
                                  <p className="text-slate-700">
                                    {scheme.benefit}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-bold text-slate-400 text-[9px] uppercase mb-0.5">
                                    How to Apply
                                  </p>
                                  <p className="text-slate-700">
                                    {scheme.howToApply}
                                  </p>
                                </div>
                              </div>
                              {scheme.verifiedAsOf && (
                                <p className="mt-2 text-[9px] text-slate-400">
                                  Data as of{" "}
                                  {new Date(
                                    scheme.verifiedAsOf,
                                  ).toLocaleDateString("en-IN", {
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ),
            )}
          </div>
        )}

        {/* ── Coach, Safety & Paperwork ── */}
        {innerTab === "coach" && hasCoachSafety && (
          <div className="space-y-5">
            {displayLevels.map((lvl, idx) => {
              const hasAnyForLevel =
                lvl.coachSelectionGuide ||
                lvl.localResources ||
                lvl.injuryRisks ||
                lvl.mentalSkillsFocus?.length ||
                lvl.academicIntegration ||
                lvl.proactiveDocuments?.length;
              if (!hasAnyForLevel) return null;
              return (
                <div
                  key={lvl.level}
                  className={
                    idx > 0
                      ? "pt-5 mt-5 border-t border-dashed border-slate-300 space-y-5"
                      : "space-y-5"
                  }
                >
                  {isMerged && (
                    <p
                      className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}
                    >
                      {lvl.label} Level
                    </p>
                  )}
                  {lvl.coachSelectionGuide && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <UserCheck className="h-3.5 w-3.5" /> Coach Selection
                        Guide
                      </h4>
                      <div className="space-y-3">
                        {lvl.coachSelectionGuide.mustHave?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1.5">
                              Must-Have Qualities
                            </p>
                            <ul className="space-y-1">
                              {lvl.coachSelectionGuide.mustHave.map(
                                (q: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-slate-700"
                                  >
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                    {q}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        {lvl.coachSelectionGuide.niceToHave?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                              Nice to Have
                            </p>
                            <ul className="space-y-1">
                              {lvl.coachSelectionGuide.niceToHave.map(
                                (q: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-slate-600"
                                  >
                                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                                    {q}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        {lvl.coachSelectionGuide.redFlags?.length > 0 && (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1.5">
                              Red Flags — Avoid This Coach
                            </p>
                            <ul className="space-y-1">
                              {lvl.coachSelectionGuide.redFlags.map(
                                (r: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-rose-700"
                                  >
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                                    {r}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        {lvl.coachSelectionGuide.questionsToAsk?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                              Questions to Ask Before Hiring
                            </p>
                            <ul className="space-y-1">
                              {lvl.coachSelectionGuide.questionsToAsk.map(
                                (q: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-slate-700"
                                  >
                                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                    <em>{q}</em>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {lvl.localResources &&
                  (lvl.localResources.academies?.length ||
                    lvl.localResources.facilities?.length ||
                    lvl.localResources.governingBodies?.length) ? (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <MapPin className="h-3.5 w-3.5" /> Local Resources
                      </h4>
                      <div className="space-y-3">
                        {lvl.localResources.academies &&
                          lvl.localResources.academies.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Academies
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {lvl.localResources.academies.map(
                                  (item: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
                                    >
                                      <Star className="h-3 w-3 text-amber-500" />{" "}
                                      {item}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                        {lvl.localResources.facilities &&
                          lvl.localResources.facilities.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Facilities
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {lvl.localResources.facilities.map(
                                  (item: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
                                    >
                                      <Pin className="h-3 w-3 text-emerald-600" />{" "}
                                      {item}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                        {lvl.localResources.governingBodies &&
                          lvl.localResources.governingBodies.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Governing Bodies
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {lvl.localResources.governingBodies.map(
                                  (item: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
                                    >
                                      <Shield className="h-3 w-3 text-indigo-500" />{" "}
                                      {item}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  ) : null}
                  {lvl.injuryRisks && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                        <Activity className="h-3.5 w-3.5" /> Health & Injury
                        Prevention
                      </h4>
                      <div className="space-y-3">
                        {lvl.injuryRisks.commonInjuries?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1.5">
                              Common Injuries
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {lvl.injuryRisks.commonInjuries.map(
                                (inj: string, i: number) => (
                                  <span
                                    key={i}
                                    className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                                  >
                                    {inj}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                        {lvl.injuryRisks.preventionTips?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                              Prevention Tips
                            </p>
                            <ul className="space-y-1">
                              {lvl.injuryRisks.preventionTips.map(
                                (t: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-slate-700"
                                  >
                                    <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                                    {t}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        {lvl.injuryRisks.warningSignsToWatch?.length > 0 && (
                          <div className="rounded-lg border border-rose-200 bg-white/80 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1.5">
                              Warning Signs — See a Doctor
                            </p>
                            <ul className="space-y-1">
                              {lvl.injuryRisks.warningSignsToWatch.map(
                                (s: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-rose-700"
                                  >
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                                    {s}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {lvl.mentalSkillsFocus &&
                    lvl.mentalSkillsFocus.length > 0 && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
                          <BrainCircuit className="h-3.5 w-3.5" /> Mental Skills
                          to Build
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {lvl.mentalSkillsFocus.map((s: string, i: number) => (
                            <span
                              key={i}
                              className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-800"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  {lvl.academicIntegration && (
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                        <BookOpen className="h-3.5 w-3.5" /> Balancing Sport &
                        Academics
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {lvl.academicIntegration}
                      </p>
                    </div>
                  )}
                  {lvl.proactiveDocuments &&
                    lvl.proactiveDocuments.length > 0 && (
                      <div>
                        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                          <FileText className="h-3.5 w-3.5 text-slate-500" />{" "}
                          Document Vault — Prepare Now
                        </h4>
                        <ul className="space-y-2">
                          {lvl.proactiveDocuments.map(
                            (doc: string, i: number) => (
                              <li
                                key={i}
                                className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white/80 px-3 py-2.5 text-sm font-semibold text-slate-700"
                              >
                                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {doc}
                              </li>
                            ),
                          )}
                        </ul>
                        <p className="mt-3 text-[11px] text-slate-400 italic">
                          Collect these documents early to avoid last-minute
                          scrambling at trials and registrations.
                        </p>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      {/* ── Level Up Plan ── */}
      {innerTab === "levelup" && nextMacroLevel && (
        <div className="space-y-4">
          {progressionState === "loading" && (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 rounded-lg bg-slate-200" />
              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="h-4 w-full rounded bg-slate-200" />
                <div className="h-4 w-3/4 rounded bg-slate-200" />
              </div>
              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-4 w-full rounded bg-slate-200" />
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-slate-200 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-2/3 rounded bg-slate-200" />
                      <div className="h-3 w-full rounded bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <div key={n} className="h-7 w-32 rounded-full bg-slate-200" />
                ))}
              </div>
            </div>
          )}

          {progressionState === "error" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center space-y-2">
              <AlertTriangle className="h-6 w-6 text-rose-400 mx-auto" />
              <p className="text-sm font-semibold text-rose-700">Couldn't load the Level Up Plan</p>
              <p className="text-xs text-rose-500">Please try again in a moment.</p>
              <button
                type="button"
                onClick={() => setProgressionState("idle")}
                className="mt-1 rounded-lg border border-rose-300 bg-white px-4 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
              >
                Try Again
              </button>
            </div>
          )}

          {typeof progressionState === "object" && "plan" in progressionState && (() => {
            const { plan } = progressionState;
            return (
              <div className="space-y-4">
                {/* Header + timeline */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
                    Your Path to {nextMacroLevel.label}
                  </h4>
                  {plan.typicalTimeline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                      <Clock className="h-3 w-3" />
                      {plan.typicalTimeline}
                    </span>
                  )}
                </div>

                {/* The Gap */}
                {plan.gap && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                    <h5 className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      The Biggest Challenge
                    </h5>
                    <p className="text-sm leading-relaxed text-slate-700">{plan.gap}</p>
                  </div>
                )}

                {/* Prerequisites */}
                {plan.prerequisites?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <h5 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      What Your Child Must Be Able to Do First
                    </h5>
                    <ul className="space-y-1.5">
                      {plan.prerequisites.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Milestones */}
                {plan.milestones?.length > 0 && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                    <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                      <Map className="h-3.5 w-3.5" />
                      Your Step-by-Step Plan
                    </h5>
                    <div className="space-y-3">
                      {plan.milestones.map((ms, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{ms.title}</p>
                            <p className="text-xs text-slate-600 leading-relaxed">{ms.description}</p>
                            {ms.timeframe && (
                              <span className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600">
                                <Clock className="h-3 w-3" />
                                {ms.timeframe}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Competitions */}
                {plan.targetCompetitions?.length > 0 && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                    <h5 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-700">
                      <Trophy className="h-3.5 w-3.5" />
                      Stepping-Stone Competitions to Enter
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {plan.targetCompetitions.map((comp, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800">
                          <Trophy className="h-3 w-3 text-sky-500" />
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coach Signals */}
                {plan.coachSignals?.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <h5 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                      <UserCheck className="h-3.5 w-3.5" />
                      What to Look for in Your Coach
                    </h5>
                    <ul className="space-y-1.5">
                      {plan.coachSignals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                          {signal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Common Mistakes */}
                {plan.commonMistakes?.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-white/80 p-4">
                    <h5 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-rose-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Mistakes to Avoid
                    </h5>
                    <ul className="space-y-1.5">
                      {plan.commonMistakes.map((mistake, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-rose-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
                          {mistake}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            );
          })()}
        </div>
      )}
      </div>

      {/* ── Footer CTAs ── */}
      <div className="shrink-0 border-t border-slate-100 p-4 pb-24 sm:p-5 sm:pb-24 lg:pb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`${communityUrl}/discover?tab=COMMUNITIES${sName ? `&sport=${encodeURIComponent(sName)}&level=${encodeURIComponent(lLabel)}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 bg-gradient-to-r ${colors.gradient}`}
          >
            <Users className="h-4 w-4" /> Find Communities
          </Link>
          {sName &&
            (user ? (
              <Link
                href={guidanceHref}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-power-orange/30 bg-power-orange/5 px-4 py-3 text-sm font-semibold text-power-orange hover:bg-power-orange/10 transition text-center"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>
                  Get personalised plan
                  <span className="hidden xl:inline"> for this level</span>
                </span>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-power-orange/30 bg-power-orange/5 px-4 py-3 text-sm font-semibold text-power-orange hover:bg-power-orange/10 transition text-center"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>
                    Get personalised plan
                    <span className="hidden xl:inline"> for this level</span>
                  </span>
                </button>
                <LoginRequiredModal
                  isOpen={loginModalOpen}
                  onClose={() => setLoginModalOpen(false)}
                  sport={sName}
                  redirectPath={guidanceHref}
                  variant="plan"
                />
              </>
            ))}
        </div>

      </div>
    </motion.div>
  );
}

