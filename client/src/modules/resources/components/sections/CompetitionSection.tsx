// ─── Getting into competition ───────────────────────────────────────────────
//
// Which events, how to enter them, and who helps pay. The funding block matters
// most and is the reason this section is worth a URL of its own: the schemes
// carry `verifiedAsOf` dates and application routes, which is the one thing a
// map card can only ever gesture at.

import { CalendarClock, HandCoins, Lightbulb, Trophy } from "lucide-react";

import type { PathwayLevel } from "@/modules/sports/services/pathway";

import { BulletList, Callout, FactGrid, Panel, Section } from "../primitives";

export function hasCompetition(levels: PathwayLevel[]): boolean {
  return levels.some(
    (l) => l.competitions || l.trialInfo || l.governmentSchemes?.length,
  );
}

export function CompetitionSection({
  id,
  levels,
}: {
  id: string;
  levels: PathwayLevel[];
}) {
  if (!hasCompetition(levels)) return null;

  return (
    <Section
      id={id}
      title="Competing — and who pays for it"
      intro="The events at this level, how entry actually works, and the schemes that can cover part of the cost."
    >
      {levels.map((level) => {
        const trial = level.trialInfo;
        const schemes = level.governmentSchemes ?? [];
        return (
          <div key={level.level} className="space-y-4">
            {levels.length > 1 && (
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {level.label}
              </p>
            )}

            {level.competitions && (
              <Panel title="Where you compete" icon={<Trophy className="h-3.5 w-3.5" />}>
                <p className="text-sm leading-relaxed text-slate-700">
                  {level.competitions}
                </p>
              </Panel>
            )}

            {trial && (
              <Panel
                title="How entry works"
                icon={<CalendarClock className="h-3.5 w-3.5" />}
              >
                <FactGrid
                  facts={[
                    trial.typicalMonths && {
                      label: "When",
                      value: trial.typicalMonths,
                    },
                    trial.eligibilityAge && {
                      label: "Eligible age",
                      value: trial.eligibilityAge,
                    },
                  ]}
                />
                {trial.registrationProcess && (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-700">
                    {trial.registrationProcess}
                  </p>
                )}
                {trial.selectionCriteria?.length ? (
                  <div className="mt-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      What they select on
                    </p>
                    <BulletList items={trial.selectionCriteria} />
                  </div>
                ) : null}
                {trial.tips?.length ? (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Worth knowing
                    </p>
                    <BulletList items={trial.tips} tone="caution" />
                  </div>
                ) : null}
              </Panel>
            )}

            {/* Funding. The structured source of truth — the pathway map only
                carries a one-line teaser and links here. */}
            {schemes.length > 0 && (
              <Panel
                title="Who helps pay"
                icon={<HandCoins className="h-3.5 w-3.5" />}
                tone="good"
              >
                <div className="space-y-3">
                  {/* Indexed — generated names, so a repeat is possible and a
                      collapsed key would silently drop a scheme. */}
                  {schemes.map((scheme, si) => (
                    <div
                      key={`${si}-${scheme.name}`}
                      className="rounded-xl border border-emerald-200/70 bg-white p-3.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-extrabold text-slate-900">
                          {scheme.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {scheme.body}
                        </p>
                      </div>
                      <FactGrid
                        facts={[
                          scheme.benefit && {
                            label: "What you get",
                            value: scheme.benefit,
                          },
                          scheme.eligibility && {
                            label: "Who qualifies",
                            value: scheme.eligibility,
                          },
                        ]}
                      />
                      {scheme.howToApply && (
                        <p className="mt-3 text-sm leading-relaxed text-slate-700">
                          <span className="font-bold text-slate-800">
                            How to apply:{" "}
                          </span>
                          {scheme.howToApply}
                        </p>
                      )}
                      {scheme.verifiedAsOf && (
                        <p className="mt-2 text-[11px] font-medium text-slate-400">
                          Verified {scheme.verifiedAsOf} — confirm against the
                          scheme&apos;s own notification before you rely on it.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        );
      })}

      <Callout tone="caution">
        Entry rules, fees and scheme criteria change season to season. Treat
        everything here as a starting point and verify against the federation or
        scheme&apos;s own published notification before committing money.
      </Callout>
    </Section>
  );
}
