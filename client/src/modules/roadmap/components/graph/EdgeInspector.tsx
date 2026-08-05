"use client";

// ─── Edge inspector ─────────────────────────────────────────────────────────
//
// The centrepiece of the redesign. Every transition is shown as TWO separate
// questions, side by side and visually equal:
//
//   "Can we enter?"     → the administrative gate
//   "Are we ready?"     → the competitive gate
//
// Presenting them as one thing is exactly what makes parents attempt an ATP
// draw at twelve. Splitting them means the answer to the first can be a
// cheerful "yes, nothing stops you" while the second says "five years away",
// and the parent draws their own conclusion without being lectured.

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DoorOpen,
  Gauge,
  KeyRound,
  X,
} from "lucide-react";

import { GraphEdge, GraphNode } from "../../graph/types";
import { EDGE_STYLES } from "./tokens";

interface EdgeInspectorProps {
  edge: GraphEdge;
  from: GraphNode | undefined;
  to: GraphNode | undefined;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}

export function EdgeInspector({
  edge,
  from,
  to,
  onClose,
  onSelectNode,
}: EdgeInspectorProps) {
  const style = EDGE_STYLES[edge.kind];

  return (
    <motion.div
      key={edge.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border-2 bg-white shadow-lg"
      style={{ borderColor: style.hex + "55" }}
    >
      {/* Header: kind + the transition it describes */}
      <div
        className="flex items-start gap-3 rounded-t-3xl border-b px-5 py-4"
        style={{ background: style.hex + "0d", borderColor: style.hex + "22" }}
      >
        <span className="mt-0.5 shrink-0">
          <svg width="34" height="14">
            <line
              x1="1"
              y1="7"
              x2="33"
              y2="7"
              stroke={style.hex}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: style.hex }}
          >
            {style.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-800">
            <button
              type="button"
              data-graph-interactive
              onClick={() => from && onSelectNode(from.id)}
              className="rounded-lg bg-white px-2 py-0.5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
            >
              {from?.label ?? "—"}
            </button>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <button
              type="button"
              data-graph-interactive
              onClick={() => to && onSelectNode(to.id)}
              className="rounded-lg bg-white px-2 py-0.5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
            >
              {to?.label ?? "—"}
            </button>
          </div>
        </div>
        <button
          type="button"
          data-graph-interactive
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-5">
        {/* ── The two gates, deliberately equal weight ── */}
        {(edge.eligibility || edge.readiness) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <DoorOpen className="h-3.5 w-3.5" />
                Can we enter?
              </p>
              <p className="text-xs leading-relaxed text-slate-700">
                {edge.eligibility ?? "No published entry restriction."}
              </p>
            </div>
            <div
              className="rounded-2xl border p-3.5"
              style={{
                borderColor:
                  edge.kind === "overreach" ? "#fecdd3" : "#e2e8f0",
                background:
                  edge.kind === "overreach" ? "#fff1f2" : "#f8fafc",
              }}
            >
              <p
                className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                style={{
                  color: edge.kind === "overreach" ? "#9f1239" : "#64748b",
                }}
              >
                <Gauge className="h-3.5 w-3.5" />
                Are we ready?
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{
                  color: edge.kind === "overreach" ? "#881337" : "#334155",
                }}
              >
                {edge.readiness ?? "Judged on results at the level below."}
              </p>
            </div>
          </div>
        )}

        {/* ── Fast-track unlock checklist ── */}
        {edge.unlocks && edge.unlocks.length > 0 && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-violet-700">
              <KeyRound className="h-3.5 w-3.5" />
              This shortcut unlocks if any one is true
            </p>
            <p className="mb-2.5 text-[11px] leading-relaxed text-violet-500">
              A genuinely strong child should skip ahead. Here is the evidence
              that earns it — no opinion involved.
            </p>
            <ul className="space-y-1.5">
              {edge.unlocks.map((u, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs font-semibold text-violet-900"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── The honest cost of jumping early ── */}
        {edge.warning && (
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              What actually happens if you try this now
            </p>
            <p className="text-xs leading-relaxed text-rose-900">
              {edge.warning}
            </p>
          </div>
        )}

        {edge.timeline && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Typically takes {edge.timeline}
          </div>
        )}
      </div>
    </motion.div>
  );
}
