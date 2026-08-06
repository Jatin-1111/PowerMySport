"use client";

// ─── Stage content blocks ───────────────────────────────────────────────────
//
// Stage content is data, not markup, so a new sport's handbook can be added as a
// content file without anyone writing a component. Four block kinds cover
// everything the tennis handbook actually contains — prose, a list, labelled
// rows, and a callout — and a fifth would need a fifth thing to say.

import { AlertTriangle, Check, HandCoins, Target, X } from "lucide-react";

import type { StageBlock } from "../../stages/types";

const CALLOUT_TONES = {
  goal: {
    icon: Target,
    wrap: "border-emerald-200 bg-emerald-50/70",
    iconClass: "text-emerald-600",
    title: "text-emerald-900",
  },
  warn: {
    icon: AlertTriangle,
    wrap: "border-rose-200 bg-rose-50/70",
    iconClass: "text-rose-600",
    title: "text-rose-900",
  },
  money: {
    icon: HandCoins,
    wrap: "border-amber-200 bg-amber-50/70",
    iconClass: "text-amber-600",
    title: "text-amber-900",
  },
} as const;

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-[13px] font-black uppercase tracking-widest text-slate-400">
      {children}
    </h4>
  );
}

export function StageBlocks({ blocks }: { blocks: StageBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.kind === "prose") {
          return (
            <p key={i} className="text-[15px] leading-relaxed text-slate-600">
              {block.text}
            </p>
          );
        }

        if (block.kind === "list") {
          const cross = block.tone === "cross";
          const check = block.tone === "check";
          return (
            <div key={i}>
              {block.title && <BlockTitle>{block.title}</BlockTitle>}
              <ul className="space-y-2">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        cross
                          ? "bg-rose-100 text-rose-600"
                          : check
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {cross ? (
                        <X className="h-3 w-3" strokeWidth={3} />
                      ) : check ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-current" />
                      )}
                    </span>
                    <span className="text-[15px] leading-snug text-slate-600">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (block.kind === "pairs") {
          return (
            <div key={i}>
              {block.title && <BlockTitle>{block.title}</BlockTitle>}
              <dl className="overflow-hidden rounded-xl border border-slate-200">
                {block.rows.map((row, r) => (
                  <div
                    key={row.label}
                    className={`gap-1 px-3.5 py-2.5 sm:flex sm:gap-4 ${
                      r % 2 ? "bg-white" : "bg-slate-50/70"
                    }`}
                  >
                    <dt className="text-[14px] font-bold text-slate-800 sm:w-44 sm:shrink-0">
                      {row.label}
                    </dt>
                    <dd className="text-[14px] leading-snug text-slate-600">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        }

        const tone = CALLOUT_TONES[block.tone];
        const Icon = tone.icon;
        return (
          <div key={i} className={`rounded-2xl border px-4 py-3.5 ${tone.wrap}`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${tone.iconClass}`} />
              <p className={`text-[14px] font-extrabold ${tone.title}`}>
                {block.title}
              </p>
            </div>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-slate-700">
              {block.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
