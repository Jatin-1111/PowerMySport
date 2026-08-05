// ─── What this stage is ─────────────────────────────────────────────────────
//
// The orientation section: what the stage is, what you do in it, and the honest
// read on how far it narrows. Always renders — every stage has at least a
// description, so this is the one section that can't be conditional.

import { BarChart3, ListChecks, Star } from "lucide-react";

import type { PathwayLevel } from "@/modules/sports/services/pathway";

import { BulletList, Callout, Panel, Section } from "../primitives";

export function WhatToExpectSection({
  id,
  levels,
  funnelNote,
  exitValueNote,
}: {
  id: string;
  /** The raw levels this stage covers — usually one, sometimes two merged. */
  levels: PathwayLevel[];
  /** Archetype copy on how the stage narrows. */
  funnelNote?: string;
  /** Archetype copy on what reaching or stopping here is worth. */
  exitValueNote?: string;
}) {
  return (
    <Section
      id={id}
      title="What happens at this stage"
      intro="What your child actually does here, and how many children get past it."
    >
      {levels.map((level) => (
        <div key={level.level} className="space-y-4">
          {levels.length > 1 && (
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              {level.label}
            </p>
          )}

          <p className="text-sm leading-relaxed text-slate-700">
            {level.description}
          </p>

          {level.keyFocus && (
            <Callout tone="info" title="The focus here">
              {level.keyFocus}
            </Callout>
          )}

          {level.steps.length > 0 && (
            <Panel
              title="What you actually do"
              icon={<ListChecks className="h-3.5 w-3.5" />}
            >
              <BulletList items={level.steps} numbered />
            </Panel>
          )}

          {level.governingBody && (
            <p className="text-xs text-slate-500">
              <span className="font-bold text-slate-600">Who runs it: </span>
              {level.governingBody}
            </p>
          )}
        </div>
      ))}

      {/* The two lines that keep the page honest: most children stop somewhere,
          and stopping is worth something. Kept together and last so the reader
          meets the optimism and the arithmetic in the same breath. */}
      {(funnelNote || exitValueNote) && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          {funnelNote && (
            <div className="flex gap-2.5">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-sm leading-relaxed text-slate-600">{funnelNote}</p>
            </div>
          )}
          {exitValueNote && (
            <div className="flex gap-2.5 border-t border-slate-200 pt-3">
              <Star className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-sm leading-relaxed text-slate-600">
                <span className="font-bold text-slate-700">
                  What this is worth:{" "}
                </span>
                {exitValueNote}
              </p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
