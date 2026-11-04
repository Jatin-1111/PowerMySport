"use client";

import {
  CHILD_HISTORY_SOURCE_LABELS,
  type ChildAcademicBoard,
  type ChildSharePublicRow,
  type ChildSharePublicView,
  type ChildShareSection,
} from "@powermysport/shared-types";
import { SharedVideoRow } from "@/modules/my-child/components/SharedVideoRow";
import { SECTION_LABELS, formatEntryDate, headerLine } from "@/modules/my-child/utils/format";
import { StatTile } from "@/modules/shared/ui/StatTile";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

const BOARD_LABELS: Record<ChildAcademicBoard, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  ISC: "ISC",
  IB: "IB",
  STATE: "State board",
  OTHER: "Other",
};

/** The order a reader meets them: what happened on court first, school after. */
const ORDER: ChildShareSection[] = [
  "results",
  "ranking",
  "awards",
  "coaching",
  "fitness",
  "academics",
];

/**
 * A child's profile as the person holding a share link sees it, and as the parent previews it.
 *
 * It draws only what the server sent: every list and number here comes from the response, which
 * the server builds from a fixed set of fields for the sections the parent ticked. A section
 * with nothing in it is not drawn at all.
 *
 * The same component serves the public page and the dialog's preview. In a preview nothing is
 * played (`play` is left out) and the title is a second-level heading, because the dialog
 * already has the page's first-level one.
 */
export function SharedProfile({
  view,
  play,
  preview = false,
  actions,
}: {
  view: ChildSharePublicView;
  play?: (videoId: string) => Promise<{ url: string }>;
  preview?: boolean;
  /** What a reader can do with the profile: ask for contact, save the CV. Not shown in a preview. */
  actions?: ReactNode;
}) {
  const Title = preview ? "h2" : "h1";
  const rowsBySection = (section: ChildShareSection): ChildSharePublicRow[] =>
    view.timeline.filter((row) => row.section === section);

  const tiles = [
    view.stats.yearsInSport ? { label: "Years in sport", value: view.stats.yearsInSport } : null,
    view.stats.tournaments ? { label: "Tournaments", value: view.stats.tournaments } : null,
    view.stats.awards ? { label: "Awards", value: view.stats.awards } : null,
  ].filter((tile): tile is { label: string; value: number } => tile !== null);

  const whereFrom = [
    headerLine({
      sport: view.child.sport,
      level: view.child.level,
      sinceYear: view.child.sinceYear,
    }),
    view.child.state,
    view.child.classYear ? `Class of ${view.child.classYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      aria-labelledby="shared-name"
      className="border-hairline rounded-2xl border bg-white p-5 sm:p-8"
    >
      <header>
        <Title id="shared-name" className="font-editorial text-ink text-4xl font-light">
          {view.child.name}
        </Title>
        {whereFrom && <p className="text-ink-body mt-2 text-lg">{whereFrom}</p>}
        <p className="text-ink-body mt-4 text-sm">
          Shared by the family on {formatEntryDate(view.sharedAt, "day")}. This link expires on{" "}
          {formatEntryDate(view.expiresAt, "day")}.
        </p>
        <p className="text-ink-body mt-1 text-pretty text-sm">{view.notice}</p>
        {actions && <div className="mt-6 flex flex-col gap-3 sm:flex-row">{actions}</div>}
      </header>

      {tiles.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {tiles.map((tile) => (
            <StatTile key={tile.label} label={tile.label} value={tile.value} />
          ))}
        </div>
      )}

      <div className="mt-10 space-y-10">
        {ORDER.map((section) => {
          const rows = rowsBySection(section);
          const academics = section === "academics" ? view.academics : null;
          if (rows.length === 0 && !academics) return null;
          return (
            <section key={section} aria-labelledby={`shared-${section}`}>
              <h3 id={`shared-${section}`} className="font-editorial text-ink text-2xl font-light">
                {SECTION_LABELS[section]}
              </h3>
              {academics && <AcademicFacts academics={academics} />}
              {rows.length > 0 && (
                <ol className="divide-hairline mt-2 divide-y">
                  {rows.map((row, index) => (
                    <SharedRow key={`${row.title}-${row.occurredOn}-${index}`} row={row} />
                  ))}
                </ol>
              )}
            </section>
          );
        })}

        {view.videos.length > 0 && (
          <section aria-labelledby="shared-videos">
            <h3 id="shared-videos" className="font-editorial text-ink text-2xl font-light">
              {SECTION_LABELS.videos}
            </h3>
            <ul className="divide-hairline mt-2 divide-y">
              {view.videos.map((clip) => (
                <SharedVideoRow key={clip.id} clip={clip} {...(play ? { play } : {})} />
              ))}
            </ul>
          </section>
        )}

        {view.timeline.length === 0 && view.videos.length === 0 && !view.academics && (
          <p className="text-ink-body">Nothing has been added to the sections shared here yet.</p>
        )}
      </div>
    </article>
  );
}

function AcademicFacts({
  academics,
}: {
  academics: NonNullable<ChildSharePublicView["academics"]>;
}) {
  const facts: Array<[string, string]> = [
    ["Board", academics.board ? BOARD_LABELS[academics.board] : ""],
    ["School", academics.school ?? ""],
    ["Wants to study", academics.intendedField ?? ""],
  ];
  const shown = facts.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-3">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt className="text-ink-body text-sm">{label}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SharedRow({ row }: { row: ChildSharePublicRow }) {
  return (
    <li className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[9rem_1fr]">
      <p className="text-ink-body text-sm tabular-nums">
        {formatEntryDate(row.occurredOn, row.datePrecision)}
        {row.endedOn && (
          <>
            <span aria-hidden> to </span>
            <span className="sr-only"> to </span>
            {formatEntryDate(row.endedOn, row.datePrecision)}
          </>
        )}
      </p>
      <div className="min-w-0">
        <p className="text-ink font-medium">
          {row.title}
          {row.resultLabel && (
            <span className="text-ink-body font-normal"> · {row.resultLabel}</span>
          )}
        </p>
        {row.detail && <p className="text-ink-body mt-1 text-pretty text-sm">{row.detail}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="border-hairline text-ink-body rounded-md border px-2 py-0.5 text-xs">
            {CHILD_HISTORY_SOURCE_LABELS[row.source]}
          </span>
          {row.resultUrl && (
            <a
              href={row.resultUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-ink inline-flex min-h-11 items-center gap-1 underline underline-offset-2"
            >
              Result page
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </p>
      </div>
    </li>
  );
}
