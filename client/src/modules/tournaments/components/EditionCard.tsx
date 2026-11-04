import Link from "next/link";
import type { ReactNode } from "react";

import type { ListedEdition } from "../services/editionListing";
import { formatEditionDates, formatLocation } from "../utils/editionFormat";

/** The column grid shared by the heading row and every tournament. */
const ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)] md:gap-x-6";

/** A caption that only shows on small screens, where the columns stack. */
function Cell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-ink-muted mb-0.5 text-sm md:hidden">{caption}</p>
      {children}
    </div>
  );
}

export function EditionTableHead() {
  return (
    <div
      aria-hidden="true"
      className={`${ROW_GRID} text-ink-muted border-hairline hidden border-b pb-3 text-sm`}
    >
      <span>Dates</span>
      <span>Tournament</span>
      <span>Where</span>
      <span>Age groups</span>
    </div>
  );
}

/** A list of tournaments as a hairline-ruled table: head row, then one row each. */
export function EditionTable({ editions }: { editions: ListedEdition[] }) {
  return (
    <div>
      <EditionTableHead />
      <ul className="divide-hairline border-hairline divide-y border-b">
        {editions.map((edition) => (
          <li key={edition.slug}>
            <EditionCard edition={edition} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One tournament, as a row. It leads with the date, which is what a parent
 * plans around, then the name with what kind of event it is (the short calendar
 * name, "AITA CS7 (Pollachi)", only says so to a parent who already knows the
 * codes), where it is, and which age groups play.
 */
export function EditionCard({ edition }: { edition: ListedEdition }) {
  const where = formatLocation(edition.venue, edition.city);
  const kindLabel = edition.categoryLabel || edition.level;
  const ages = edition.ageGroups?.filter(Boolean) ?? [];

  return (
    <Link
      href={`/tournaments/${edition.slug}`}
      className={`${ROW_GRID} hover:bg-paper-deep/60 focus-visible:ring-ink group block space-y-3 px-1 py-5 transition-colors focus-visible:outline-none focus-visible:ring-2 md:space-y-0 md:px-2`}
    >
      <Cell caption="Dates">
        <p className="text-ink font-medium tabular-nums">
          {formatEditionDates(edition.startDate, edition.endDate)}
        </p>
      </Cell>
      <Cell caption="Tournament">
        <p className="text-ink line-clamp-2 text-lg leading-snug group-hover:underline group-hover:underline-offset-4">
          {edition.name}
        </p>
        {kindLabel && <p className="text-ink-muted mt-1 text-sm">{kindLabel}</p>}
      </Cell>
      <Cell caption="Where">
        <p className="text-ink-body text-sm">{where || "Venue to be announced"}</p>
      </Cell>
      <Cell caption="Age groups">
        <p className="text-ink-body text-sm">{ages.length > 0 ? ages.join(", ") : "Not listed"}</p>
      </Cell>
    </Link>
  );
}
