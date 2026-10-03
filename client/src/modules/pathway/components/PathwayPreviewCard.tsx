import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { PathwayGuideSummary } from "../services/pathway";

/**
 * A real pathway, at a glance: its stages, their ages and the question each
 * one answers, every row a link straight into that stage of the guide.
 *
 * It replaces the homepage's stock photo of a parent at a laptop, which was an
 * iStock preview hot-linked without a licence. Showing the product itself is
 * both the honest picture and the useful one, and it comes from the same
 * summaries /roadmap renders, so it cannot drift from the guide.
 */
export function PathwayPreviewCard({ pathway }: { pathway: PathwayGuideSummary }) {
  const stages = pathway.stages ?? [];
  if (stages.length === 0) return null;
  const guideHref = `/roadmap/${pathway.sportSlug}`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-end justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-power-orange-solid text-xs font-semibold uppercase tracking-[0.14em]">
            Pathway guide
          </p>
          <p className="font-title mt-1 text-lg font-bold text-slate-900">
            {pathway.sportName}, stage by stage
          </p>
        </div>
        <span className="shrink-0 text-sm text-slate-500">{stages.length} stages</span>
      </div>

      <ol className="divide-y divide-slate-100">
        {stages.map((stage, i) => (
          <li key={stage.key}>
            <Link
              href={`${guideHref}?stage=${encodeURIComponent(stage.key)}`}
              className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <span className="group-hover:text-power-orange-solid flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 transition-colors group-hover:bg-orange-50">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {stage.name}
                </span>
                {stage.coreQuestion && (
                  <span className="block truncate text-xs text-slate-500">
                    {stage.coreQuestion}
                  </span>
                )}
              </span>
              {stage.ageRange && (
                <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
                  {stage.ageRange}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>

      <div className="border-t border-slate-200 px-5 py-3">
        <Link
          href={guideHref}
          className="text-power-orange-solid group inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          Open the {pathway.sportName} guide
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </div>
    </div>
  );
}
