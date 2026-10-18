import { ExternalLink } from "lucide-react";

import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { formatFullDate } from "@/modules/pathway/services/tournamentEditionPage";

type Row = { label: string; value: string };

/** `HH:MM` as the federation prints it (IST) to "11:59 pm IST". */
function clock(time: string | undefined): string | null {
  const match = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "pm" : "am";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${match[2]} ${suffix} IST`;
}

function withTime(day: string, time: string | undefined): string {
  const at = clock(time);
  return at ? `${formatFullDate(day)}, ${at}` : formatFullDate(day);
}

const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

/** Whether the record carries anything the event's own page or the rules supplied. */
export function hasEntryDetails(edition: TournamentEdition): boolean {
  return Boolean(
    edition.officialDetailsSource &&
    (typeof edition.feeSingles === "number" ||
      edition.entryOpensDate ||
      edition.withdrawalDeadlineDate ||
      edition.surface)
  );
}

/**
 * What the federation's page for this event says about entering it: the fees,
 * the surface, and the dates that matter, in the order a parent meets them.
 *
 * Every line is something that was printed; one that was not is left out, never
 * filled in. Where the figures are the federation's published rules applied to
 * the event's level, because the event's own page could not be read, it says so.
 */
export function EntryDetails({
  edition,
  finished,
  factSheetUrl,
  federationName,
}: {
  edition: TournamentEdition;
  finished: boolean;
  /** The event's own page on the federation site, where the fact sheet lives. */
  factSheetUrl?: string | undefined;
  federationName: string;
}) {
  const times = edition.deadlineTimes ?? {};

  const money: Row[] = [];
  if (typeof edition.feeSingles === "number") {
    money.push({ label: "Entry fee, singles", value: rupees(edition.feeSingles) });
  }
  if (typeof edition.feeDoubles === "number") {
    money.push({ label: "Entry fee, doubles", value: `${rupees(edition.feeDoubles)} per pair` });
  }
  if (typeof edition.dailyAllowance === "number") {
    money.push({
      label: "Daily allowance",
      value: `${rupees(edition.dailyAllowance)}, paid in the main round`,
    });
  }
  if (edition.surface) money.push({ label: "Surface", value: edition.surface });

  const dates: Row[] = [];
  if (edition.entryOpensDate) {
    dates.push({ label: "Entries open", value: formatFullDate(edition.entryOpensDate) });
  }
  if (edition.registrationDeadlineDate) {
    dates.push({
      label: "Entries close",
      value: withTime(edition.registrationDeadlineDate, times.entryCloses),
    });
  }
  if (edition.withdrawalDeadlineDate) {
    dates.push({
      label: "Withdraw by",
      value: withTime(edition.withdrawalDeadlineDate, times.withdrawal),
    });
  }
  if (edition.freezeDeadlineDate) {
    dates.push({
      label: "Draw is fixed",
      value: withTime(edition.freezeDeadlineDate, times.freeze),
    });
  }
  if (edition.qualifyingStartDate) {
    dates.push({ label: "Qualifying starts", value: formatFullDate(edition.qualifyingStartDate) });
  }
  if (edition.mainDrawStartDate) {
    dates.push({ label: "Main draw starts", value: formatFullDate(edition.mainDrawStartDate) });
  }

  const fromSheet = edition.officialDetailsSource === "factSheet";

  const group = (title: string, rows: Row[]) =>
    rows.length > 0 && (
      <div>
        <h3 className="text-ink font-medium">{title}</h3>
        <dl className="divide-hairline border-hairline mt-3 divide-y border-y">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <dt className="text-ink-muted text-sm">{row.label}</dt>
              <dd className="text-ink tabular-nums sm:text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );

  return (
    <section
      aria-labelledby="entry-details"
      className="border-hairline rounded-xl border bg-white p-7 sm:p-8"
    >
      <h2 id="entry-details" className="font-editorial text-ink text-3xl font-light tracking-tight">
        {finished ? "Entry details (archived)" : "Entry details"}
      </h2>
      <p className="text-ink-muted mt-2 max-w-prose text-pretty text-sm">
        {fromSheet
          ? `Read from ${federationName}'s page for this event${
              edition.lastCheckedAt ? ` on ${formatFullDate(edition.lastCheckedAt)}` : ""
            }. ${finished ? "Entries have closed." : "Dates and fees can change, so check the fact sheet before you enter."}`
          : `From ${federationName}'s published rules for this level and these dates. The event's own page could not be read, so check it before you enter.`}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {group("Fees and conditions", money)}
        {group("Key dates", dates)}
      </div>

      {factSheetUrl && (
        <a
          href={factSheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink focus-visible:ring-ink mt-6 inline-flex items-center gap-1.5 rounded-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
        >
          Open the official fact sheet
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
