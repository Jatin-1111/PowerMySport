import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";

import type { ListedEdition } from "../services/editionListing";
import { formatEditionDates, formatLocation } from "../utils/editionFormat";

/**
 * One tournament in a list. Leads with what kind of event it is, because the
 * short calendar name ("AITA CS7 (Pollachi)") only says so to a parent who
 * already knows the codes.
 */
export function EditionCard({ edition }: { edition: ListedEdition }) {
  const where = formatLocation(edition.venue, edition.city);
  const kindLabel = edition.categoryLabel || edition.level;
  const ages = edition.ageGroups?.filter(Boolean) ?? [];

  return (
    <Link
      href={`/tournaments/${edition.slug}`}
      className="hover:border-power-orange/40 group flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      {kindLabel && (
        <span className="mb-2 w-fit rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-800">
          {kindLabel}
        </span>
      )}
      <p className="font-title group-hover:text-power-orange-solid line-clamp-2 text-[15px] font-bold leading-snug text-slate-900">
        {edition.name}
      </p>
      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{formatEditionDates(edition.startDate, edition.endDate)}</span>
        </div>
        {where && (
          <div className="flex items-center gap-2">
            <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{where}</span>
          </div>
        )}
        {ages.length > 0 && (
          <div className="flex items-center gap-2">
            <Users aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{ages.join(", ")}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
