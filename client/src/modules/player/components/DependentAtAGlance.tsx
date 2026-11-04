"use client";

import type { Fact } from "@/modules/player/utils/dependentPageModel";

interface DependentAtAGlanceProps {
  facts: Fact[];
  onEdit: () => void;
}

/**
 * The facts a parent looks up most, each with its label. Only the ones the family has given are
 * drawn: the gaps are named once, in the next-step band above, and a column of "Not added yet"
 * rows made the page louder without telling the parent anything new.
 */
export function DependentAtAGlance({ facts, onEdit }: DependentAtAGlanceProps) {
  const known = facts.filter((fact): fact is Fact & { value: string } => fact.value !== null);
  if (known.length === 0) return null;

  return (
    <section aria-labelledby="at-a-glance" className="border-hairline border-t pt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="at-a-glance"
          className="font-editorial text-ink text-2xl font-light tracking-tight sm:text-3xl"
        >
          At a glance
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink min-h-11 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Edit details
        </button>
      </div>
      <dl className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {known.map((fact) => (
          <div key={fact.label}>
            <dt className="text-ink-body text-sm">{fact.label}</dt>
            <dd className="text-ink mt-1 text-pretty text-lg">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
