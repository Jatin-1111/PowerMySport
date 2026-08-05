// ─── Sport resource article ─────────────────────────────────────────────────
//
// The page shell: a full-bleed hero, then a two-column body with a pinned rail on
// the left and the article on the right.
//
// The article is generated content (per-sport, per-state, from the pathway API)
// interleaved with authored content (per-sport, from the handbook). The generated
// half answers "what is this tier and how do you enter it"; the authored half
// answers everything a parent actually asks first — is this right for my child,
// what racquet, how many sessions, what do I say afterwards, what if they don't
// make it. A sport without an authored guide renders the generated half alone.
//
// Server-rendered end to end, zero client JavaScript: the rail is `position:
// sticky` with plain anchors, and the state control is a GET form.

import {
  getArchetypeForSport,
  groupLevelsIntoMacro,
  mergeAgeRanges,
} from "@/modules/sports/config/macroLevels";
import type { SportPathway } from "@/modules/sports/services/pathway";

import { stageAnchor } from "../config";
import { guideFor } from "../content";
import { ResourceHero } from "./ResourceHero";
import { ResourceSidebar, type SidebarStage } from "./ResourceSidebar";
import { CareersSection } from "./sections/CareersSection";
import { DecideSection } from "./sections/DecideSection";
import { StageArticle } from "./StageArticle";

const DECIDE_ID = "should-we";
const CAREERS_ID = "beyond-playing";

export function SportResourceArticle({
  pathway,
  sportSlug,
  sportName,
  state,
  stateWasChosen,
}: {
  pathway: SportPathway;
  sportSlug: string;
  sportName: string;
  state: string;
  /** False when `state` is the default rather than the reader's own pick. */
  stateWasChosen?: boolean;
}) {
  const { archetype } = getArchetypeForSport(sportName);
  const stages = groupLevelsIntoMacro(pathway.levels, archetype).filter(
    (m) => m.rawLevels.length > 0,
  );
  const guide = guideFor(sportSlug);

  const stageAges = stages.map((m) =>
    mergeAgeRanges(m.rawLevels.map((l) => l.ageRange)),
  );

  const railItems: SidebarStage[] = [
    ...(guide
      ? [{ anchor: DECIDE_ID, label: "Is this right for us?", hint: "Start here" }]
      : []),
    ...stages.map((m, i) => ({
      anchor: stageAnchor(m.representativeRawLevel),
      label: m.label,
      hint: stageAges[i],
      numbered: true,
    })),
    ...(guide
      ? [{ anchor: CAREERS_ID, label: "Beyond playing", hint: "Careers in the sport" }]
      : []),
  ];

  // The whole journey's age span, from the first stage's floor to the last one's
  // ceiling — the answer to "how many years is this", which is usually a parent's
  // very first question.
  const ageSpan = spanAcross(stageAges[0], stageAges[stageAges.length - 1]);

  const heroStats = [
    { label: "Stages", value: String(stages.length) },
    ageSpan && { label: "Ages covered", value: ageSpan },
    { label: "Local detail", value: state },
    pathway.tournaments?.length
      ? { label: "Tournaments listed", value: String(pathway.tournaments.length) }
      : undefined,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="bg-slate-50/60">
      <ResourceHero
        sportName={sportName}
        state={state}
        overview={pathway.overview}
        stats={heroStats}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
          <ResourceSidebar
            sportSlug={sportSlug}
            state={state}
            stages={railItems}
            stageCount={stages.length}
          />

          <main className="min-w-0 space-y-6">
            {/* Said plainly and once: the reader is looking at one state's guide,
                and if they didn't pick it they need to know which before they act
                on an academy list or a fee range. */}
            {!stateWasChosen && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-amber-900">
                Local academies, fees and state schemes below are for{" "}
                <strong>{state}</strong>. Pick your own state in the panel{" "}
                <span className="lg:hidden">above</span>
                <span className="hidden lg:inline">on the left</span> before acting
                on anything specific.
              </p>
            )}

            {guide && (
              <DecideSection
                id={DECIDE_ID}
                sportName={sportName}
                decide={guide.decide}
              />
            )}

            {stages.map((macro, i) => (
              <StageArticle
                key={macro.id}
                macro={macro}
                index={i}
                total={stages.length}
                state={state}
                extras={guide?.stages[macro.representativeRawLevel]}
              />
            ))}

            {guide && (
              <CareersSection
                id={CAREERS_ID}
                sportName={sportName}
                careers={guide.careers}
              />
            )}

            <footer className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-500">
              Costs, entry rules and scheme criteria change season to season.
              Verify anything you plan to spend money on against the federation or
              scheme&apos;s own published notification.
              {pathway.lastRefreshedAt && (
                <>
                  {" "}
                  Last refreshed{" "}
                  {new Date(pathway.lastRefreshedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  .
                </>
              )}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * "5 – 10 years" + "14 – 18 years" → "5–18 years".
 *
 * Returns the first band unchanged when the ends can't be parsed — the age strings
 * come from a generator, so the shape isn't guaranteed and a wrong span would be
 * worse than a narrower true one.
 */
function spanAcross(first?: string, last?: string): string | undefined {
  if (!first) return undefined;
  const low = first.match(/\d+/)?.[0];
  const high = last?.match(/\d+(?!.*\d)/)?.[0];
  if (!low || !high || Number(high) <= Number(low)) return first;
  return `${low}–${high} years`;
}
