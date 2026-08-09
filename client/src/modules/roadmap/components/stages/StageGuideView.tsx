"use client";

// ─── Nine-stage guide ───────────────────────────────────────────────────────
//
// One stage at a time: a numbered rail down the side, the stage itself in the
// panel, and Previous/Next at the foot. It is the shape the handbooks were
// written in, and the shape a parent already knows from every course, form and
// checkout they have ever used — which is the whole argument for it. Nobody has
// to be taught how to press Next.
//
// The rail is the wayfinding the canvas never had. Nine labelled stages with the
// ages on them answer "where are we, how much is left, and what comes after this"
// without the parent having to hold the map in their head.

import { getCommunityAppUrl } from "@/lib/community/url";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircleQuestion,
  Pin,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { hasResourcePage, resourceHref, stageAnchor } from "@/modules/resources/config";

import {
  STAGE_TAB_LABELS,
  STAGE_TAB_ORDER,
  type GuideStage,
  type StageGuide,
  type StageTabId,
} from "../../stages/types";
import { StageBlocks } from "./StageBlocks";

/**
 * One colour per stage, so the rail reads as a sequence of distinct places
 * rather than nine identical rows. Deliberately not the lane palette: lanes mean
 * "which track", and here every stage is on the same journey.
 */
const STAGE_COLORS = [
  "#16a34a",
  "#ea580c",
  "#d97706",
  "#7c3aed",
  "#2563eb",
  "#0d9488",
  "#db2777",
  "#0891b2",
  "#65a30d",
];

const colorFor = (i: number) => STAGE_COLORS[i % STAGE_COLORS.length];

interface StageGuideViewProps {
  guide: StageGuide;
  sportName: string;
  /** Raw level (1–5) the child sits on, 0 when unknown. Marks "You are here". */
  currentRawLevel: number;
  /** Keeps the outer explorer's stage index in sync for the other tabs. */
  onStageChange?: (rawLevel: number) => void;
}

function StageListItem({
  stage,
  index,
  active,
  isCurrent,
  onSelect,
}: {
  stage: GuideStage;
  index: number;
  active: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const hex = colorFor(index);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "step" : undefined}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? "bg-slate-900 shadow-sm"
          : "hover:bg-slate-100"
      }`}
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black text-white"
        style={{ background: hex }}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[14px] font-bold leading-tight ${
            active ? "text-white" : "text-slate-800"
          }`}
        >
          {stage.title}
          {stage.ageLabel && (
            <span className={active ? "text-slate-300" : "text-slate-500"}>
              {" "}
              ({stage.ageLabel})
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 block text-[12.5px] leading-snug ${
            active ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {stage.listNote}
        </span>
        {isCurrent && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400 px-1.5 py-px text-[10px] font-black uppercase tracking-wide text-amber-950">
            <Pin className="h-2.5 w-2.5" /> You are here
          </span>
        )}
      </span>
      {active && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />}
    </button>
  );
}

export function StageGuideView({
  guide,
  sportName,
  currentRawLevel,
  onStageChange,
}: StageGuideViewProps) {
  const [index, setIndex] = useState(() => {
    // Open on the stage the child is actually on, when we know it.
    if (!currentRawLevel) return 0;
    const at = guide.stages.findIndex((s) => s.rawLevel === currentRawLevel);
    return at >= 0 ? at : 0;
  });
  const [tab, setTab] = useState<StageTabId>("overview");
  const panelRef = useRef<HTMLDivElement | null>(null);

  const total = guide.stages.length;
  // Belt and braces alongside the remount in PathwayStagesSection: a stale index
  // pointing past a shorter sport's stage list would read `undefined.tabs` and
  // take the whole page down.
  const stage = guide.stages[Math.min(index, total - 1)] ?? guide.stages[0];

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setIndex(next);
      setTab("overview");
      const rawLevel = guide.stages[next].rawLevel;
      if (rawLevel && onStageChange) onStageChange(rawLevel);
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [guide.stages, onStageChange, total],
  );

  const tabs = useMemo(
    () =>
      STAGE_TAB_ORDER.filter((id) => stage.tabs.some((t) => t.id === id)).map(
        (id) => ({ id, label: STAGE_TAB_LABELS[id] }),
      ),
    [stage],
  );

  const activeTab =
    stage.tabs.find((t) => t.id === tab) ?? stage.tabs[0];

  const guideHref =
    guide.resourceSlug && hasResourcePage(sportName)
      ? stage.rawLevel
        ? resourceHref(sportName, stageAnchor(stage.rawLevel))
        : resourceHref(sportName)
      : null;

  const stageList = (
    <div className="space-y-1">
      {guide.stages.map((s, i) => (
        <StageListItem
          key={s.id}
          stage={s}
          index={i}
          active={i === index}
          isCurrent={!!currentRawLevel && s.rawLevel === currentRawLevel}
          onSelect={() => go(i)}
        />
      ))}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-5">
      {/* ── The rail ──
             A dropdown below lg, where 290px of stage titles would eat the
             screen the stage itself needs. */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <details className="group rounded-2xl border border-slate-200 bg-white p-2 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-[13px] font-bold text-slate-700 [&::-webkit-details-marker]:hidden">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white"
              style={{ background: colorFor(index) }}
            >
              {index + 1}
            </span>
            Stage {index + 1} of {total} · {stage.title}
            <ChevronRight className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-2 border-t border-slate-100 pt-2">{stageList}</div>
        </details>

        <div className="hidden rounded-2xl border border-slate-200 bg-white p-2 lg:block">
          <p className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
            {total} stages
          </p>
          {stageList}
        </div>
      </aside>

      {/* ── The stage ──
             self-start, or the grid stretches the panel to the rail's height and
             a short tab (Resources on an early stage) renders a bordered white
             box with hundreds of empty pixels under the content. */}
      <div
        ref={panelRef}
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:self-start"
      >
        <header className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className="inline-block rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-widest text-white"
                style={{ background: colorFor(index) }}
              >
                Stage {index + 1}
              </span>
              <h3 className="mt-2 text-[22px] font-extrabold leading-tight tracking-[-0.01em] text-slate-900 sm:text-[26px]">
                {stage.title}
              </h3>
              <p className="mt-1 text-[14.5px] leading-snug text-slate-500">
                {stage.subtitle}
              </p>
            </div>

            {stage.ageRange && (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                <Users className="h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Age range
                  </p>
                  <p className="text-[15px] font-extrabold text-emerald-900">
                    {stage.ageRange}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 sm:px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={activeTab?.id === t.id}
              className={`relative shrink-0 px-3 py-3 text-[13.5px] font-bold transition ${
                activeTab?.id === t.id
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {activeTab?.id === t.id && (
                <span
                  className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full"
                  style={{ background: colorFor(index) }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-5 sm:px-6">
          {/* The overview pairs the prose with the ticked topic list, the way the
              rest of the stage is summarised before it's read. */}
          {activeTab?.id === "overview" ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-5">
                <StageBlocks blocks={activeTab.blocks} />
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5">
                  <p className="text-[13px] font-black uppercase tracking-widest text-emerald-700">
                    Goal of this stage
                  </p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-slate-700">
                    {stage.goal}
                  </p>
                </div>
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 lg:self-start">
                <p className="text-[14px] font-extrabold text-slate-900">
                  At a Glance
                </p>
                <ul className="mt-2.5 space-y-2">
                  {stage.atAGlance.map((topic) => (
                    <li key={topic} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                        strokeWidth={3}
                      />
                      <span className="text-[13.5px] leading-snug text-slate-600">
                        {topic}
                      </span>
                    </li>
                  ))}
                </ul>
                {tabs.some((t) => t.id === "topics") && (
                  <button
                    type="button"
                    onClick={() => setTab("topics")}
                    className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    View all topics
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </aside>
            </div>
          ) : (
            activeTab && <StageBlocks blocks={activeTab.blocks} />
          )}
        </div>

        {/* ── Where to go with a question ──
               Every tile here leads somewhere that exists. The mockup's "Watch
               Guide" tile is deliberately absent: there is no video, and a tile
               that does nothing is worse than a tile that isn't there. */}
        <div className="grid gap-2 border-t border-slate-100 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {guideHref && (
            <Link
              href={guideHref}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4 shrink-0 text-power-orange" />
              <span>
                <span className="block text-[13.5px] font-bold text-slate-800">
                  Full guide
                </span>
                <span className="block text-[12px] text-slate-500">
                  Detailed stage notes
                </span>
              </span>
            </Link>
          )}
          {/* No "Parent checklist" tile. It only did setTab("resources") — a
              tile duplicating a tab sitting visibly above it — and the label
              promised a checklist while the Resources tab is mostly funding and
              academics. Next to "Full guide" it also read as a second link to
              the same place. */}
          <Link
            href="/experts"
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <MessageCircleQuestion className="h-4 w-4 shrink-0 text-indigo-600" />
            <span>
              <span className="block text-[13.5px] font-bold text-slate-800">
                Ask an expert
              </span>
              <span className="block text-[12px] text-slate-500">Get guidance</span>
            </span>
          </Link>
          <a
            href={getCommunityAppUrl()}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <Users className="h-4 w-4 shrink-0 text-sky-600" />
            <span>
              <span className="block text-[13.5px] font-bold text-slate-800">
                Parent community
              </span>
              <span className="block text-[12px] text-slate-500">
                Connect &amp; discuss
              </span>
            </span>
          </a>
        </div>

        {/* ── Previous / Next ── */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-600 transition enabled:hover:border-slate-400 enabled:hover:text-slate-900 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous stage</span>
            <span className="sm:hidden">Back</span>
          </button>

          {index < total - 1 ? (
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="flex min-w-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-[13px] font-bold text-white transition hover:bg-slate-800"
            >
              <span className="truncate">
                Next: {guide.stages[index + 1].title}
                {guide.stages[index + 1].ageLabel
                  ? ` (${guide.stages[index + 1].ageLabel})`
                  : ""}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          ) : (
            <span className="text-[13px] font-bold text-slate-400">
              End of the pathway
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
