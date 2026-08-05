// ─── Are they ready? ────────────────────────────────────────────────────────
//
// Benchmarks with targets, plus the talent signals a coach reads. The two
// deliberately sit together: a benchmark is what you can measure yourself, a
// signal is what somebody experienced notices, and a parent asking "is my child
// good enough for this" needs both to avoid answering it from hope.

import { Brain, Gauge, HeartHandshake, Zap } from "lucide-react";

import type { PathwayLevel } from "@/modules/sports/services/pathway";

import { BulletList, Panel, Section } from "../primitives";

/** True when there is anything worth rendering — the page skips empty sections. */
export function hasReadiness(levels: PathwayLevel[]): boolean {
  return levels.some((l) => l.benchmarks || l.talentSignals);
}

export function ReadinessSection({
  id,
  levels,
}: {
  id: string;
  levels: PathwayLevel[];
}) {
  if (!hasReadiness(levels)) return null;

  return (
    <Section
      id={id}
      title="Is your child ready for the next step?"
      intro="What you can measure at home, and what an experienced coach is watching for."
    >
      {levels.map((level) => {
        const signals = level.talentSignals;
        return (
          <div key={level.level} className="space-y-4">
            {levels.length > 1 && (
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {level.label}
              </p>
            )}

            {level.benchmarks && (
              <Panel
                title="Benchmarks"
                icon={<Gauge className="h-3.5 w-3.5" />}
                tone="info"
              >
                <p className="mb-3 text-sm leading-relaxed text-slate-700">
                  {level.benchmarks.description}
                </p>
                <dl className="divide-y divide-sky-100">
                  {level.benchmarks.metrics.map((m, mi) => (
                    <div
                      key={`${mi}-${m.metric}`}
                      className="flex items-baseline justify-between gap-4 py-2"
                    >
                      <dt className="text-sm text-slate-600">{m.metric}</dt>
                      <dd className="shrink-0 text-sm font-bold text-slate-900">
                        {m.target}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            )}

            {signals && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {signals.physicalMarkers?.length ? (
                  <Panel title="Physical" icon={<Zap className="h-3.5 w-3.5" />}>
                    <BulletList items={signals.physicalMarkers} />
                  </Panel>
                ) : null}
                {signals.cognitiveMarkers?.length ? (
                  <Panel title="Decision-making" icon={<Brain className="h-3.5 w-3.5" />}>
                    <BulletList items={signals.cognitiveMarkers} />
                  </Panel>
                ) : null}
                {signals.behavioralMarkers?.length ? (
                  <Panel
                    title="Attitude"
                    icon={<HeartHandshake className="h-3.5 w-3.5" />}
                  >
                    <BulletList items={signals.behavioralMarkers} />
                  </Panel>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </Section>
  );
}
