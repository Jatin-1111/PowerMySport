import type { ReactNode } from "react";

import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { formatFullDate } from "@/modules/pathway/services/tournamentEditionPage";

import type { DrawRow, FactSheetDetails, FactSheetPlace } from "../types/factSheet";
import { describeDrawCode, rupees, telHref, websiteHref, withTime } from "../utils/entryFormat";

type Row = { label: string; value: ReactNode };

const LINK =
  "text-ink focus-visible:ring-ink rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2";

/** Whether the record carries any of the fact sheet's block sections. */
export function hasFactSheetSections(edition: TournamentEdition): boolean {
  const d = edition.factSheetDetails;
  return Boolean(
    d &&
    (d.draws.length > 0 ||
      d.organisation ||
      d.director ||
      d.referee ||
      d.academy ||
      d.venue ||
      d.travel ||
      d.hotel ||
      d.additional)
  );
}

function Panel({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-hairline rounded-xl border bg-white p-7 sm:p-8">
      <h2 id={id} className="font-editorial text-ink text-3xl font-light tracking-tight">
        {title}
      </h2>
      {lead && <p className="text-ink-muted mt-2 max-w-prose text-pretty text-sm">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function DefList({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-ink font-medium">{title}</h3>
      <dl className="divide-hairline border-hairline mt-3 divide-y border-y">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <dt className="text-ink-muted shrink-0 text-sm">{row.label}</dt>
            <dd className="text-ink min-w-0 break-words sm:text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const phoneLink = (phone: string | null): ReactNode => {
  if (!phone) return null;
  const href = telHref(phone);
  return href ? (
    <a href={href} className={LINK}>
      {phone}
    </a>
  ) : (
    phone
  );
};

const emailLink = (email: string | null): ReactNode =>
  email ? (
    <a href={`mailto:${email}`} className={LINK}>
      {email}
    </a>
  ) : null;

const siteLink = (site: string | null): ReactNode => {
  if (!site) return null;
  const href = websiteHref(site);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {site}
    </a>
  ) : (
    site
  );
};

const addressOf = (address: string | null, postalCode: string | null): string | null =>
  [address?.replace(/[,\s]+$/, ""), postalCode].filter(Boolean).join(", ") || null;

/** Drops the rows whose value the sheet did not print. */
const present = (rows: Array<{ label: string; value: ReactNode }>): Row[] =>
  rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");

// ─── Draws ────────────────────────────────────────────────────────────────────

const COLUMNS =
  "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.3fr)_minmax(0,1.5fr)] md:gap-x-6";

function dateRange(row: DrawRow): string {
  if (!row.startDate) return "Not printed";
  if (!row.endDate || row.endDate === row.startDate) return formatFullDate(row.startDate);
  return `${formatFullDate(row.startDate)} to ${formatFullDate(row.endDate)}`;
}

function DrawCell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-ink-muted mb-0.5 text-sm md:hidden">{caption}</p>
      {children}
    </div>
  );
}

function Draws({ draws }: { draws: DrawRow[] }) {
  return (
    <Panel
      id="draws"
      title="Draws and sign-in"
      lead="Qualifying is played before the main draw. Sign in by the time shown or the place is lost."
    >
      <div
        aria-hidden="true"
        className={`${COLUMNS} text-ink-muted border-hairline hidden border-b pb-3 text-sm`}
      >
        <span>Draw</span>
        <span>Round</span>
        <span>Size</span>
        <span>Played</span>
        <span>Sign in by</span>
      </div>
      <ul className="divide-hairline border-hairline divide-y border-b md:border-t-0">
        {draws.map((row, index) => (
          <li
            key={`${row.code}-${row.stage}-${index}`}
            className={`${COLUMNS} space-y-3 py-4 md:space-y-0`}
          >
            <DrawCell caption="Draw">
              <p className="text-ink">{describeDrawCode(row.code)}</p>
              <p className="text-ink-muted text-sm tabular-nums">{row.code}</p>
            </DrawCell>
            <DrawCell caption="Round">
              <p className="text-ink-body text-sm">
                {row.stage === "qualifying" ? "Qualifying" : "Main draw"}
              </p>
            </DrawCell>
            <DrawCell caption="Size">
              <p className="text-ink tabular-nums">{row.size ?? "Not printed"}</p>
            </DrawCell>
            <DrawCell caption="Played">
              <p className="text-ink-body text-sm tabular-nums">{dateRange(row)}</p>
            </DrawCell>
            <DrawCell caption="Sign in by">
              <p className="text-ink-body text-sm tabular-nums">
                {row.signIn ? withTime(row.signIn.date, row.signIn.time) : "On the day"}
              </p>
            </DrawCell>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── Venue and stay ───────────────────────────────────────────────────────────

function placeRows(place: FactSheetPlace): Row[] {
  return present([
    { label: "Name", value: place.name },
    { label: "Address", value: addressOf(place.address, place.postalCode) },
    { label: "Website", value: siteLink(place.website) },
    { label: "Contact", value: place.contact },
    { label: "Phone", value: phoneLink(place.phone) },
    { label: "Email", value: emailLink(place.email) },
  ]);
}

function VenueAndStay({ details }: { details: FactSheetDetails }) {
  const { venue, academy, hotel, travel } = details;
  // A host academy that is also the venue is the same place; it is shown once.
  const academyIsVenue =
    !!academy?.name &&
    !!venue?.name &&
    academy.name.trim().toLowerCase() === venue.name.trim().toLowerCase();

  const hotelRows = hotel
    ? present([
        { label: "Name", value: hotel.name },
        { label: "Distance from the venue", value: hotel.distanceFromVenue },
        {
          label: "Double room",
          value: hotel.doublePrice
            ? `${rupees(hotel.doublePrice.amount)}${hotel.doublePrice.note ? ` (${hotel.doublePrice.note.toLowerCase()})` : ""}`
            : null,
        },
        {
          label: "Breakfast",
          value:
            hotel.breakfastIncluded === null
              ? null
              : hotel.breakfastIncluded
                ? "Included"
                : "Not included",
        },
        { label: "Address", value: hotel.address },
        { label: "Contact", value: hotel.contact },
        { label: "Phone", value: phoneLink(hotel.phone) },
      ])
    : [];
  const travelRows = travel
    ? present([
        { label: "Nearest airport", value: travel.airport },
        { label: "Nearest railway station", value: travel.trainStation },
      ])
    : [];

  const blocks = [
    venue && placeRows(venue).length > 0 ? (
      <DefList key="venue" title="Venue" rows={placeRows(venue)} />
    ) : null,
    academy && !academyIsVenue && placeRows(academy).length > 0 ? (
      <DefList key="academy" title="Host academy" rows={placeRows(academy)} />
    ) : null,
    hotelRows.length > 0 ? <DefList key="hotel" title="Where to stay" rows={hotelRows} /> : null,
    travelRows.length > 0 ? <DefList key="travel" title="Getting there" rows={travelRows} /> : null,
  ].filter(Boolean);
  if (blocks.length === 0) return null;

  return (
    <Panel id="venue-stay" title="Venue and stay">
      <div className="grid gap-8 lg:grid-cols-2">{blocks}</div>
    </Panel>
  );
}

// ─── Organisers ───────────────────────────────────────────────────────────────

function Organisers({ details }: { details: FactSheetDetails }) {
  const { organisation, director, referee } = details;
  const blocks = [
    organisation ? (
      <DefList
        key="org"
        title="Organising association"
        rows={present([
          { label: "Name", value: organisation.name },
          { label: "Address", value: addressOf(organisation.address, organisation.postalCode) },
          { label: "Contact", value: organisation.contact },
          { label: "Phone", value: phoneLink(organisation.phone) },
          { label: "Email", value: emailLink(organisation.email) },
        ])}
      />
    ) : null,
    director ? (
      <DefList
        key="director"
        title="Tournament director"
        rows={present([
          { label: "Name", value: director.name },
          { label: "Phone", value: phoneLink(director.phone) },
          { label: "Email", value: emailLink(director.email) },
        ])}
      />
    ) : null,
    referee ? (
      <DefList
        key="referee"
        title="Referee"
        rows={present([
          { label: "Name", value: referee.name },
          { label: "Certification", value: referee.certification },
          { label: "Phone", value: phoneLink(referee.phone) },
          { label: "Email", value: emailLink(referee.email) },
        ])}
      />
    ) : null,
  ].filter(Boolean);
  if (blocks.length === 0) return null;

  return (
    <Panel
      id="organisers"
      title="Organisers and contacts"
      lead="Details are exactly as the federation prints them on its fact sheet."
    >
      <div className="grid gap-8 lg:grid-cols-2">{blocks}</div>
    </Panel>
  );
}

// ─── The organiser's own notes ────────────────────────────────────────────────

function Notes({ details }: { details: FactSheetDetails }) {
  const additional = details.additional;
  if (!additional) return null;
  return (
    <Panel
      id="organiser-notes"
      title="Notes from the organiser"
      lead="Written by the organiser on the fact sheet, shown as written."
    >
      {additional.meeting && (
        <p className="text-ink mb-4">
          <span className="text-ink-muted text-sm">Meeting: </span>
          {additional.meeting}
        </p>
      )}
      <ul className="text-ink-body max-w-prose space-y-1.5 leading-relaxed">
        {additional.notes.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </Panel>
  );
}

/** The fact sheet's draws, venue and stay, organiser sections and notes, for one tournament. */
export function FactSheetSections({ edition }: { edition: TournamentEdition }) {
  const details = edition.factSheetDetails;
  if (!details) return null;
  return (
    <>
      {details.draws.length > 0 && <Draws draws={details.draws} />}
      <VenueAndStay details={details} />
      <Organisers details={details} />
      <Notes details={details} />
    </>
  );
}
