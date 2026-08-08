"use client";

// ─── The Journey tab ────────────────────────────────────────────────────────
//
// The pathway as numbered stages, and nothing else.
//
// This replaced a pan-and-zoom graph canvas. The canvas was the better picture
// of the whole structure and it lost anyway, for a reason no amount of gesture
// polish could fix: five tracks side by side is 1832px of diagram, a phone gives
// it 341px, and the view opened at 0.42× where a 19px heading rendered at 8px.
// A parent scrolling the page zoomed it out instead. Stages are what the
// handbooks were written in, what the resource pages already render, and what a
// parent can read with a thumb.
//
// Two sources feed the same reader. A sport with a written handbook gets its
// authored stages (`stages/tennis.ts`); every other sport gets stages built from
// its own pathway levels (`stages/derive.ts`), which are per-sport and
// per-state. Neither invents anything: a tab appears only where there is content
// behind it.

import { MacroLevel } from "@/modules/sports/config/macroLevels";
import { Archetype } from "@/modules/sports/config/sportArchetypes";
import { pathwayApi } from "@/modules/sports/services/pathway";
import { Info, ListOrdered, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { hasResourcePage, resourceHref, stageAnchor } from "@/modules/resources/config";

import { stageGuideFor } from "../../stages";
import type { ApiStageGuide } from "../../stages/apiFormat";
import { deriveStageGuide } from "../../stages/derive";
import { stageGuideFromApi } from "../../stages/fromApi";
import { RoadmapPersona } from "../../utils/persona";
import { GuideCallout } from "./GuideCallout";
import { StageGuideView } from "./StageGuideView";

interface PathwayStagesSectionProps {
  sportName: string;
  /**
   * Read by neither the reader nor its content today. It stays on the shape
   * because the per-stage resource link is state-scoped — the local academies
   * and schemes a family actually needs differ by state.
   */
  state?: string;
  /** Upstream grouping key. The macro levels arrive already grouped by it. */
  archetype?: Archetype;
  macroLevels: MacroLevel[];
  persona: RoadmapPersona | null;
  /** Raw level (1–5) the child currently sits on, 0 when unknown. */
  currentRawLevel: number;
  /**
   * Layer-2 personalisation, keyed by raw level. Still fetched upstream and
   * still not rendered — it needs a home on a stage or removing at the source.
   */
  personalNotes?: Record<number, string> | null;
  personalNotesLoading?: boolean;
  /** Keeps the outer explorer's stage index in sync for the other tabs. */
  onStageChange?: (macroIndex: number) => void;
  /** Opens the Opportunities tab. Unused since the funding note moved inline. */
  onExploreFunding?: () => void;
}

export function PathwayStagesSection({
  sportName,
  state,
  macroLevels,
  persona,
  currentRawLevel,
  onStageChange,
}: PathwayStagesSectionProps) {
  // ── Where the stages come from, best first ──
  //   1. An uploaded guide for this sport (and state, if one exists) — the
  //      hand-authored India content, and the only source that will grow.
  //   2. The bundled handbook, for sports written before uploads existed.
  //   3. Stages derived from the sport's own pathway levels, so every sport
  //      renders something.
  //
  // The fetch result is stored WITH the sport it was fetched for, and ignored
  // at render when they no longer match. That beats clearing the state as the
  // effect starts: clearing is a render-phase setState, and it would still show
  // the previous sport's guide for a frame before blanking it.
  const requestKey = `${sportName}|${state ?? ""}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    guide: ApiStageGuide | null;
  } | null>(null);

  useEffect(() => {
    if (!sportName) return;
    let cancelled = false;
    void pathwayApi
      .getStageGuide(sportName, state)
      .then((res) => {
        if (!cancelled) setLoaded({ key: requestKey, guide: res?.guide ?? null });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: requestKey, guide: null });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, sportName, state]);

  const uploaded = loaded?.key === requestKey ? loaded.guide : null;

  const fromUpload = useMemo(() => stageGuideFromApi(uploaded), [uploaded]);
  const bundled = useMemo(() => stageGuideFor(sportName), [sportName]);
  const derived = useMemo(
    () => deriveStageGuide(sportName, macroLevels),
    [sportName, macroLevels],
  );
  const guide = fromUpload ?? bundled ?? derived;
  const source: "uploaded" | "bundled" | "derived" = fromUpload
    ? "uploaded"
    : bundled
      ? "bundled"
      : "derived";
  const authored = source !== "derived";

  const hasGuide = hasResourcePage(sportName);
  const currentStage = guide?.stages.find((s) => s.rawLevel === currentRawLevel);
  const guideHref =
    hasGuide && currentStage?.rawLevel
      ? resourceHref(sportName, stageAnchor(currentStage.rawLevel))
      : null;

  if (!guide) return null;

  return (
    <div className="space-y-5">
      <div className="relative rounded-3xl border border-slate-200/70 bg-white px-5 py-5 shadow-md sm:px-6">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-t-3xl bg-gradient-to-r from-power-orange via-orange-400 to-amber-300"
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-3.5 w-3.5 text-power-orange" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-power-orange">
              The journey, stage by stage
            </p>
          </div>

          {/* Says plainly whether this sport has been researched stage by stage
              or assembled from its pathway data, so we never imply depth we
              don't have. */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              authored
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {authored ? (
              <>
                <Sparkles className="h-3 w-3" />
                {source === "uploaded" ? "Researched guide" : "Researched guide (bundled)"}
              </>
            ) : (
              <>
                <Info className="h-3 w-3" /> From your sport&apos;s pathway data
              </>
            )}
          </span>
        </div>

        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
          {guide.stages.length} stages, in the order a child moves through them
          {persona?.name ? ` — ${persona.name}'s is marked` : ""}. Use Next at the
          bottom of each stage, or jump straight to one from the list.
        </p>
      </div>

      {/* Remount on a sport change. Without it the reader keeps the stage and
          tab the LAST sport was left on — search a new sport and you land on
          "Resources" of stage six of a pathway you've never seen. */}
      <StageGuideView
        key={`${guide.sport}|${guide.stages.length}`}
        guide={guide}
        sportName={sportName}
        currentRawLevel={currentRawLevel}
        onStageChange={(rawLevel) => {
          if (!onStageChange) return;
          const idx = macroLevels.findIndex((m) =>
            m.rawLevelNumbers.includes(rawLevel),
          );
          if (idx >= 0) onStageChange(idx);
        }}
      />

      {hasGuide && (
        <GuideCallout
          href={guideHref ?? resourceHref(sportName)}
          sportName={sportName}
          stageLabel={guideHref ? currentStage?.title : undefined}
        />
      )}
    </div>
  );
}
