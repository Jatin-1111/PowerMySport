"use client";

// ─── Legend ─────────────────────────────────────────────────────────────────
//
// Not decoration. The four line styles carry the argument this whole redesign
// is built to make — that "you can enter" and "you're ready" are different
// questions — so the parent has to be told what a dashed red line means before
// they can read the map.

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { EdgeKind } from "../../graph/types";
import { EDGE_STYLES } from "./tokens";

const ORDER: EdgeKind[] = ["primary", "bypass", "overreach", "offramp"];

export function GraphLegend({ derived }: { derived: boolean }) {
  // Open by default. The four line styles carry the argument the map is built to
  // make, and a parent who has to discover the key before the diagram means
  // anything has already been failed by it.
  const [open, setOpen] = useState(true);

  return (
    <div className="border-t border-slate-100 bg-slate-50/70">
      <button
        type="button"
        data-graph-interactive
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left sm:px-5"
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          How to read this map
        </span>
        <span className="flex flex-1 items-center gap-2.5">
          {ORDER.map((k) => (
            <svg key={k} width="26" height="8" className="shrink-0">
              <line
                x1="1"
                y1="4"
                x2="25"
                y2="4"
                stroke={EDGE_STYLES[k].hex}
                strokeWidth={EDGE_STYLES[k].width}
                strokeDasharray={EDGE_STYLES[k].dash}
                strokeLinecap="round"
              />
            </svg>
          ))}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid gap-2.5 px-4 pb-4 sm:grid-cols-2 sm:px-5">
          {ORDER.map((k) => {
            const s = EDGE_STYLES[k];
            return (
              <div key={k} className="flex items-start gap-2.5">
                <svg width="34" height="14" className="mt-0.5 shrink-0">
                  <line
                    x1="1"
                    y1="7"
                    x2="33"
                    y2="7"
                    stroke={s.hex}
                    strokeWidth={s.width}
                    strokeDasharray={s.dash}
                    strokeLinecap="round"
                  />
                </svg>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  <span className="font-bold" style={{ color: s.hex }}>
                    {s.name}
                  </span>{" "}
                  — {s.meaning}
                </p>
              </div>
            );
          })}

          <p className="text-[11px] leading-relaxed text-slate-400 sm:col-span-2">
            Cost and age bands are indicative estimates for planning, not quotes.
            {derived
              ? " This sport uses our generic structure — the named circuits and gate conditions haven't been researched sport-by-sport yet."
              : " Verify entry rules against the federation's own published criteria before you commit money."}
          </p>
        </div>
      )}
    </div>
  );
}
