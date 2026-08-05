// ─── One stage of the pathway ───────────────────────────────────────────────
//
// A macro stage rendered as a card: a numbered header, an at-a-glance strip, then
// four sections. This is what the removed PathwayLevelDetail's five inner tabs
// became — sections with real ids on a real URL, so a map node can link straight
// to the rung it describes and a parent can send the link to their spouse.
//
// The at-a-glance strip is the addition that matters most for a reader who is
// scanning rather than reading. Age, how long it takes and what it costs are the
// three questions asked about every stage, and answering them in the header means
// a parent can decide whether this stage is even relevant to them before reading
// a paragraph.

import {
  getCombinedFeeRange,
  MacroLevel,
  mergeAgeRanges,
} from "@/modules/sports/config/macroLevels";

import { stageAnchor } from "../config";
import type { StageExtras } from "../content/types";
import { CoachAndCareSection } from "./sections/CoachAndCareSection";
import { CompetitionSection } from "./sections/CompetitionSection";
import { ReadinessSection } from "./sections/ReadinessSection";
import { StageExtrasSection } from "./sections/StageExtrasSection";
import { WhatToExpectSection } from "./sections/WhatToExpectSection";

export function StageArticle({
  macro,
  index,
  total,
  state,
  extras,
}: {
  macro: MacroLevel;
  index: number;
  total: number;
  state: string;
  /** Hand-authored practicalities for this stage, when the sport has a guide. */
  extras?: StageExtras;
}) {
  const levels = macro.rawLevels;
  const anchor = stageAnchor(macro.representativeRawLevel);
  const ageRange = mergeAgeRanges(levels.map((l) => l.ageRange));
  const feeRange = getCombinedFeeRange(macro.rawLevelNumbers);

  const glance = [
    ageRange && { label: "Typical age", value: ageRange },
    macro.durationNote && { label: "How long", value: macro.durationNote },
    feeRange && { label: "Rough cost", value: feeRange },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <article
      id={anchor}
      className="scroll-mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-power-orange text-lg font-black text-white shadow-sm"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Stage {index + 1} of {total} · {macro.scopeTag}
            </p>
            <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
              {macro.label}
            </h2>
          </div>
        </div>

        {glance.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {glance.map((g) => (
              <div
                key={g.label}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <dt className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {g.label}
                </dt>
                <dd className="mt-0.5 text-[13px] font-bold leading-snug text-slate-800">
                  {g.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      <div className="space-y-9 px-5 py-6 sm:px-7 sm:py-8">
        <WhatToExpectSection
          id={`${anchor}-about`}
          levels={levels}
          funnelNote={macro.funnelNote}
          exitValueNote={macro.exitValueNote}
        />
        <ReadinessSection id={`${anchor}-ready`} levels={levels} />
        <CompetitionSection id={`${anchor}-competition`} levels={levels} />
        <CoachAndCareSection id={`${anchor}-coach`} levels={levels} state={state} />

        {/* Authored last: the generated sections describe the tier, these say what
            to actually do about it. */}
        {extras && <StageExtrasSection anchor={anchor} extras={extras} />}
      </div>
    </article>
  );
}
