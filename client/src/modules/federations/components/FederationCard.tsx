import Link from "next/link";
import { ArrowUpRight, BadgeCheck } from "lucide-react";

import type { FederationSummary } from "../services/fetchFederations";

// ─── One federation, as a card ───────────────────────────────────────────────
//
// Shared by the `/roadmap/[sport]` band and the `/federations` index so a
// federation looks the same wherever a parent meets it.
//
// A server component: nothing here is interactive, and this content is the
// reason the page is worth indexing.

/**
 * Labels match the detail page's badge vocabulary exactly. A federation that
 * reads "National Federation" on `/roadmap/tennis` and something else one click
 * later on `/federations/aita` reads as two different organisations.
 */
const TYPE_META: Record<FederationSummary["type"], { label: string; className: string }> = {
  govt: {
    label: "Government Body",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  national: {
    label: "National Federation",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  hybrid: {
    label: "Public-Private Body",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

/**
 * The two tabs a parent reading a pathway actually needs, deep-linked.
 *
 * "Is my child old enough" and "how do we sign up" are the questions a stage
 * raises; dropping someone on the Overview tab makes them hunt for the answer
 * they were already promised.
 */
const QUICK_TABS = [
  { tab: "eligibility", label: "Who can enter" },
  { tab: "register", label: "How to register" },
  { tab: "calendar", label: "Calendar" },
] as const;

export function FederationCard({
  federation,
  showSport = false,
}: {
  federation: FederationSummary;
  /** Label the card with its sport — for `/federations`, where sports are mixed. */
  showSport?: boolean;
}) {
  const type = TYPE_META[federation.type];
  const href = `/federations/${federation.slug}`;

  return (
    <div className="premium-shadow hover:border-power-orange/40 group flex h-full flex-col rounded-2xl border border-white/70 bg-white/80 p-5 backdrop-blur-sm transition hover:shadow-lg sm:p-6">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="font-title flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-extrabold tracking-tight text-white"
        >
          {federation.acronym.slice(0, 4)}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-title text-base font-bold leading-snug text-slate-900">
            <Link href={href} className="group-hover:text-power-orange transition">
              {federation.name}
            </Link>
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${type.className}`}
            >
              {type.label}
            </span>
            {showSport && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                {federation.sportSlug}
              </span>
            )}
            {federation.dataVerifiedAt && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <BadgeCheck className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {federation.about && (
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {federation.about}
        </p>
      )}

      <div className="mt-auto pt-5">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TABS.map((quick) => (
            <Link
              key={quick.tab}
              href={`${href}?tab=${quick.tab}`}
              className="hover:border-power-orange/40 hover:text-power-orange inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition"
            >
              {quick.label}
            </Link>
          ))}
        </div>

        <Link
          href={href}
          className="text-power-orange mt-3 inline-flex items-center gap-1 text-sm font-semibold transition hover:gap-1.5"
        >
          Read the full guide
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
