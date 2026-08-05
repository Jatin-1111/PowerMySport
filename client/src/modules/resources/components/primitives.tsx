// ─── Resource page primitives ───────────────────────────────────────────────
//
// The five things every section on a resource page is built from. They exist
// because the component these sections replaced repeated the same panel markup
// nineteen times with slightly different Tailwind each time — which is how a
// stage detail view reaches 1,400 lines and stops being editable.
//
// Server components on purpose: a resource page is reference reading with no
// interactive state, so shipping JavaScript for it would buy nothing.

import { ReactNode } from "react";

/** Tone for a list or callout. Semantic, not colour — callers never pick hex. */
export type Tone = "neutral" | "good" | "caution" | "danger" | "info";

const TONES: Record<Tone, { border: string; bg: string; label: string; dot: string }> = {
  neutral: {
    border: "border-slate-200",
    bg: "bg-white",
    label: "text-slate-500",
    dot: "bg-slate-300",
  },
  good: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/40",
    label: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  caution: {
    border: "border-amber-200",
    bg: "bg-amber-50/40",
    label: "text-amber-700",
    dot: "bg-amber-500",
  },
  danger: {
    border: "border-rose-200",
    bg: "bg-rose-50/40",
    label: "text-rose-700",
    dot: "bg-rose-500",
  },
  info: {
    border: "border-sky-200",
    bg: "bg-sky-50/40",
    label: "text-sky-700",
    dot: "bg-sky-500",
  },
};

/** A bordered block with a small uppercase eyebrow. The page's basic unit. */
export function Panel({
  title,
  icon,
  tone = "neutral",
  children,
}: {
  title?: string;
  icon?: ReactNode;
  tone?: Tone;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-4 sm:p-5`}>
      {title && (
        <p
          className={`mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${t.label}`}
        >
          {icon}
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * A list of short statements.
 *
 * Every list on this page is the same shape — a marker and a line of text — and
 * the only thing that varies is whether the reader should treat the items as
 * things to do, things to check, or things to run away from. That's the `tone`.
 */
export function BulletList({
  items,
  tone = "neutral",
  numbered = false,
}: {
  items: string[];
  tone?: Tone;
  numbered?: boolean;
}) {
  if (items.length === 0) return null;
  const t = TONES[tone];
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2.5">
          {numbered ? (
            <span
              className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${t.dot}`}
            >
              {i + 1}
            </span>
          ) : (
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
          )}
          <span className="text-sm leading-relaxed text-slate-700">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** Label/value pairs — ages, windows, eligibility. Wraps to one column on mobile. */
export function FactGrid({
  facts,
}: {
  /**
   * Falsy entries are dropped, so callers can write `field && { label, value }`
   * inline. `""` is in the union because `string && obj` narrows to `"" | obj`
   * when the string is empty, which is the shape every real call site produces.
   */
  facts: Array<{ label: string; value: string } | false | "" | undefined | null>;
}) {
  const rows = facts.filter(Boolean) as Array<{ label: string; value: string }>;
  if (rows.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((f) => (
        <div key={f.label}>
          <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {f.label}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold leading-snug text-slate-800">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A single emphasised paragraph — the honest read on a stage, a warning. */
export function Callout({
  tone = "info",
  icon,
  title,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`flex gap-3 rounded-2xl border ${t.border} ${t.bg} p-4`}>
      {icon && <span className={`mt-0.5 shrink-0 ${t.label}`}>{icon}</span>}
      <div className="min-w-0">
        {title && (
          <p className={`text-[11px] font-black uppercase tracking-widest ${t.label}`}>
            {title}
          </p>
        )}
        <div className="text-sm leading-relaxed text-slate-700">{children}</div>
      </div>
    </div>
  );
}

/**
 * A section of the article: an `<h3>` with a stable id so a map node can deep-link
 * to it, and a subtitle saying what question the section answers.
 */
export function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
        {title}
      </h3>
      {intro && (
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{intro}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/**
 * A two-column reference table — age against focus, level against cost.
 *
 * The handbook is full of these and they are the most scannable thing on the
 * page: a parent looking for "what should a nine-year-old be doing" finds the row
 * far faster than they find the sentence. Rendered as a real `<table>` so it
 * stays readable to a screen reader and copy-pastes intact.
 */
export function DataTable({
  columns,
  rows,
  tone = "neutral",
}: {
  columns: [string, string];
  rows: Array<[string, string]>;
  tone?: Tone;
}) {
  if (rows.length === 0) return null;
  const t = TONES[tone];
  return (
    <div className={`overflow-hidden rounded-2xl border ${t.border}`}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-50">
            {columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {/* Indexed key: the row labels are generated, and a generator will
              happily emit the same one twice ("ITF Junior Ranking" for both the
              entry route and the ranking requirement). Keyed on the label alone,
              React drops the duplicate row. */}
          {rows.map(([a, b], i) => (
            <tr key={`${i}-${a}`}>
              <th
                scope="row"
                className="w-[34%] px-4 py-3 align-top text-[13px] font-bold text-slate-800"
              >
                {a}
              </th>
              <td className="px-4 py-3 align-top text-[13px] leading-relaxed text-slate-600">
                {b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Two lists side by side — what fits, what doesn't. */
export function SplitLists({
  left,
  right,
}: {
  left: { title: string; items: string[]; tone: Tone; icon?: ReactNode };
  right: { title: string; items: string[]; tone: Tone; icon?: ReactNode };
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[left, right].map((side) => (
        <Panel key={side.title} title={side.title} tone={side.tone} icon={side.icon}>
          <BulletList items={side.items} tone={side.tone} />
        </Panel>
      ))}
    </div>
  );
}
