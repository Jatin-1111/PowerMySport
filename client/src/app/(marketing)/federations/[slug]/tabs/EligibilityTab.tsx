import { BadgeCheck, Clock, ExternalLink, Info, Users } from "lucide-react";
import type { FederationDetail } from "../page";
import { RequirementPill, SectionHeading } from "../federationShared";

export function EligibilityTab({
  fed,
  isVerified,
}: {
  fed: FederationDetail;
  isVerified: boolean;
}) {
  if (!fed.eligibilityCriteria) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">Eligibility data coming soon</p>
          <p className="mt-1 text-xs text-slate-400">
            We&apos;re verifying this information against official {fed.acronym} sources.
          </p>
        </div>
      </div>
    );
  }

  const { eligibilityCriteria } = fed;

  return (
    <div className="space-y-6">
      {/* Age cutoff rule */}
      {eligibilityCriteria.ageCutoffRule && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="mb-1 text-sm font-bold text-amber-900">Age Cut-off Rule</p>
              <p className="text-sm leading-relaxed text-amber-800">
                {eligibilityCriteria.ageCutoffRule}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Category table */}
      {eligibilityCriteria.categories.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
          <SectionHeading>Age Categories</SectionHeading>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Category
                  </th>
                  <th className="py-3 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Max Age
                  </th>
                  <th className="py-3 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Genders
                  </th>
                  <th className="py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {eligibilityCriteria.categories.map((cat, i) => (
                  <tr key={i} className="transition-colors hover:bg-slate-50/50">
                    <td className="py-3.5 pr-4 font-bold text-slate-900">{cat.name}</td>
                    <td className="py-3.5 pr-4 text-slate-600">
                      {cat.maxAge === 99 ? "No limit" : `Under ${cat.maxAge}`}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {cat.genders.map((g) => (
                          <span
                            key={g}
                            className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-[280px] py-3.5 text-xs leading-relaxed text-slate-500">
                      {cat.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Registration requirements */}
      <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
        <SectionHeading>Registration Requirements</SectionHeading>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <RequirementPill
            label="Federation registration mandatory"
            active={eligibilityCriteria.registrationRequired}
          />
          <RequirementPill
            label="State association registration first"
            active={eligibilityCriteria.stateAssociationFirst}
          />
        </div>
        {eligibilityCriteria.notes && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <p className="text-sm leading-relaxed text-slate-600">{eligibilityCriteria.notes}</p>
            </div>
          </div>
        )}
      </section>

      {/* Source notice */}
      {isVerified && fed.sourceUrls && fed.sourceUrls.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="mb-1 text-sm font-semibold text-emerald-800">Verified eligibility data</p>
            <p className="text-xs leading-relaxed text-emerald-700">
              This eligibility information was cross-checked against the official {fed.acronym}{" "}
              rulebook and tournament circulars. Always confirm the exact cutoff dates in the
              official tournament circular before entering.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...new Set(fed.sourceUrls)].map((url, i) => {
                let hostname = url;
                try {
                  hostname = new URL(url).hostname;
                } catch {}
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline transition hover:text-emerald-900"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {hostname}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
