import { ExternalLink } from "lucide-react";

import type { Opportunity } from "../services/opportunities";
import { glanceRows, hasFollowableDates, primaryAction } from "../utils/atAGlance";
import { formatDay } from "../utils/format";
import { FollowButton } from "./FollowButton";

// ─── The short answers and the one action ───────────────────────────────────
//
// On a wide screen this is the side rail, kept in view while the rules and steps
// are read; on a phone it is the first thing after the title. Either way it is
// the same block: what we get, who it is for, when, how players are chosen, and
// the single place to go next.

export function AtAGlance({ opportunity }: { opportunity: Opportunity }) {
  const rows = glanceRows(opportunity);
  const action = primaryAction(opportunity);

  return (
    <aside
      aria-labelledby="at-a-glance"
      className="rounded-lg border border-slate-200 bg-white p-5 lg:sticky lg:top-24"
    >
      <h2 id="at-a-glance" className="font-editorial text-lg font-normal text-slate-900">
        At a glance
      </h2>

      <dl className="mt-3 divide-y divide-slate-100 text-[15px]">
        {rows.map((row) => (
          <div key={row.label} className="py-3 first:pt-0">
            <dt className="text-xs font-semibold text-slate-500">{row.label}</dt>
            <dd className="mt-0.5 leading-relaxed text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>

      {action && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-power-orange-solid mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white transition hover:bg-orange-700"
        >
          {action.label}
          <ExternalLink aria-hidden className="h-4 w-4" />
        </a>
      )}

      {opportunity.lastVerifiedOn && (
        <p className="mt-3 text-[13px] text-slate-600">
          Last checked by PowerMySport on {formatDay(opportunity.lastVerifiedOn)}.
        </p>
      )}

      {hasFollowableDates(opportunity) && <FollowButton slug={opportunity.slug} />}
    </aside>
  );
}
