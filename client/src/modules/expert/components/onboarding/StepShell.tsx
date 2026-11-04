import type { ReactNode } from "react";

/** One step's heading and its fields, as a single ruled column. */
export function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="step-heading" className="py-8">
      <h2 id="step-heading" className="text-ink text-lg font-semibold">
        {title}
      </h2>
      {description && (
        <p className="text-ink-body mt-1 max-w-[56ch] text-pretty text-sm">{description}</p>
      )}
      <div className="mt-6 max-w-2xl space-y-6">{children}</div>
    </section>
  );
}
