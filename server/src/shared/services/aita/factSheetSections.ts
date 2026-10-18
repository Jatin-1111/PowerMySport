/**
 * The parts of an AITA fact sheet that are not single labelled values: the draws
 * table, and the blocks about who runs the event, where it is, how to get there
 * and where to stay.
 *
 * Pure functions over the page's HTML, like `calendarParser.ts`. Everything here
 * is a value AITA printed; a block that is absent comes back as null, never as an
 * empty object, so "the sheet had no hotel" and "the hotel has no name" stay
 * different statements.
 *
 * ── Personal details ────────────────────────────────────────────────────────
 * The director and referee blocks carry named individuals' phone numbers and
 * emails, exactly as AITA publishes them on its own public page. They are kept as
 * printed, and shown only beside the link to the page they came from.
 */

export interface Contact {
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface DrawRow {
  /** "BS18": boys' singles under 18. Blank on a qualifying row, which belongs to the draw above it. */
  code: string;
  stage: "main" | "qualifying";
  size: number | null;
  startDate: string | null;
  endDate: string | null;
  /** The sign-in deadline, `HH:MM` in IST as printed; null where the page prints a dash. */
  signIn: { date: string; time: string | null } | null;
}

export interface Place {
  name: string | null;
  contact: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface Hotel {
  name: string | null;
  /** As printed, e.g. "Inside the venue." */
  distanceFromVenue: string | null;
  contact: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  /** Rupees for a double room, and what the page says about tax. */
  doublePrice: { amount: number; note: string | null } | null;
  breakfastIncluded: boolean | null;
}

export interface FactSheetDetails {
  draws: DrawRow[];
  organisation: {
    name: string | null;
    contact: string | null;
    address: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  director: Contact | null;
  referee: (Contact & { certification: string | null }) | null;
  academy: Place | null;
  venue: Place | null;
  travel: { airport: string | null; trainStation: string | null } | null;
  hotel: Hotel | null;
}

// ─── Reading the page ─────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#039;": "'",
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

const decode = (value: string): string =>
  value.replace(/&(?:amp|#0?39|quot|lt|gt|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);

/** The page's visible text, one value or label per line. */
function textOf(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

/**
 * The text between a heading and the next heading that follows it; null if the heading is absent.
 *
 * Case-insensitive, because the page shows some headings in capitals by styling a
 * title-case source ("Tournament Organization"), and a reader of the rendered page
 * and a reader of the HTML would otherwise disagree about what the heading says.
 */
function between(text: string, start: string, ends: string[]): string | null {
  // A heading stands alone on its line. Matching it anywhere would take the "Referee"
  // in "Referee Portal" or a "Name" in a sentence for the start of a block.
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = (title: string) =>
    new RegExp(`(?:^|\\n)[ \\t]*${escape(title)}[ \\t]*(?:\\n|$)`, "i");
  const open = heading(start).exec(text);
  if (!open) return null;
  const bodyStart = open.index + open[0].length;
  const rest = text.slice(bodyStart);
  let stop = rest.length;
  for (const end of ends) {
    const at = heading(end).exec(rest)?.index;
    if (at !== undefined && at < stop) stop = at;
  }
  return rest.slice(0, stop);
}

/** The value after a label inside one block: on the same line after a colon, or on the next line. */
function field(block: string, label: string): string | null {
  const match = new RegExp(`${label}\\s*:?\\s*\\n?\\s*([^\\n]+)`).exec(block);
  const value = match?.[1]?.trim();
  // A label followed straight away by the next label is an empty field, not a value.
  if (!value || /\s:\s*$/.test(value) || /^[A-Z][A-Za-z /.]+\s*:$/.test(value)) return null;
  return value;
}

const orNull = (value: string | null | undefined): string | null => (value ? value : null);

function numericDate(text: string | null | undefined): string | null {
  const match = /(\d{1,2})-(\d{1,2})-(\d{4})/.exec(text ?? "");
  if (!match) return null;
  const iso = `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso ? null : iso;
}

// ─── The draws table ──────────────────────────────────────────────────────────

const cellsOf = (row: string): string[] =>
  [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
    decode(m[1]!.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
  );

export function parseDraws(html: string): DrawRow[] {
  const table = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)]
    .map((m) => m[0])
    .find((t) => /Sign-?\s*In\s*Deadline/i.test(t));
  if (!table) return [];

  const rows: DrawRow[] = [];
  let code = "";
  for (const row of table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    if (/<th/i.test(row)) continue;
    const cells = cellsOf(row);
    if (cells.length < 6) continue;
    const [draw, stageText, size, start, end, signIn] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    // A qualifying row leaves the code blank: it belongs to the draw printed above it.
    if (draw) code = draw;
    if (!code) continue;
    const signInDate = numericDate(signIn);
    const signInTime = /(\d{1,2}):(\d{2})/.exec(signIn);
    rows.push({
      code,
      stage: /qualif/i.test(stageText) ? "qualifying" : "main",
      size: /^\d+$/.test(size) ? Number(size) : null,
      startDate: numericDate(start),
      endDate: numericDate(end),
      signIn: signInDate
        ? {
            date: signInDate,
            time: signInTime ? `${signInTime[1]!.padStart(2, "0")}:${signInTime[2]}` : null,
          }
        : null,
    });
  }
  return rows;
}

// ─── The blocks ───────────────────────────────────────────────────────────────

const HEADINGS = [
  "TOURNAMENT ORGANIZATION",
  "TOURNAMENT DIRECTOR",
  "REFEREE",
  "TOURNAMENT ACADEMY INFORMATION",
  "VENUE INFORMATION",
  "Tournament Travel",
  "Event Details",
  "Official Hotel Information",
  "Entry Opens",
];

function block(text: string, heading: string): string | null {
  return between(
    text,
    heading,
    HEADINGS.filter((h) => h !== heading)
  );
}

function contact(section: string): Contact {
  return {
    name: field(section, "Name"),
    phone: field(section, "Phone"),
    email: field(section, "Email"),
  };
}

function place(section: string, labels: { contact: string; phone: string }): Place {
  return {
    name: field(section, "Name(?: of Academy)?"),
    contact: field(section, labels.contact),
    address: field(section, "Address"),
    postalCode: field(section, "(?:ZIP|Postal) Code"),
    city: field(section, "City"),
    phone: field(section, labels.phone),
    email: field(section, "Email"),
    website: field(section, "Website"),
  };
}

export function parseFactSheetDetails(html: string): FactSheetDetails {
  const text = textOf(html);

  const org = block(text, "TOURNAMENT ORGANIZATION");
  const director = block(text, "TOURNAMENT DIRECTOR");
  const referee = block(text, "REFEREE");
  const academy = block(text, "TOURNAMENT ACADEMY INFORMATION");
  const venue = block(text, "VENUE INFORMATION");
  const travel = block(text, "Tournament Travel");
  const hotel = block(text, "Official Hotel Information");

  const price = hotel
    ? /Doubles Room Price\s*:?\s*([\d,.]+)\s*INR\s*(?:\(([^)]*)\))?/i.exec(hotel)
    : null;
  const breakfast = hotel
    ? /Breakfast Included\s*:?\s*\n?\s*(YES|NO)/i.exec(hotel)?.[1]
    : undefined;

  return {
    draws: parseDraws(html),
    organisation: org
      ? {
          name: field(org, "Name of State Association"),
          contact: field(org, "Association Contact"),
          address: field(org, "Association Address"),
          postalCode: field(org, "Association Postal Code"),
          phone: field(org, "Association Phone"),
          email: field(org, "Association Email"),
        }
      : null,
    director: director ? contact(director) : null,
    referee: referee
      ? {
          ...contact(referee),
          certification: orNull(field(referee, "Certification")?.replace(/,\s*$/, "")),
        }
      : null,
    academy: academy
      ? place(academy, { contact: "Academy Contact", phone: "Academy Phone" })
      : null,
    venue: venue ? place(venue, { contact: "Contact Person", phone: "Mobile No" }) : null,
    travel: travel
      ? { airport: field(travel, "Airport"), trainStation: field(travel, "Train station") }
      : null,
    hotel: hotel
      ? {
          name: field(hotel, "Hotel Name"),
          distanceFromVenue:
            field(hotel, "Distance from Venue")
              ?.replace(/\.?\s*KM\s*$/i, "")
              .trim() || null,
          contact: field(hotel, "Contact Person Name"),
          phone: field(hotel, "Contact No"),
          city: field(hotel, "City"),
          address: field(hotel, "Address"),
          doublePrice: price
            ? { amount: Number(price[1]!.replace(/,/g, "")), note: orNull(price[2]?.trim()) }
            : null,
          breakfastIncluded: breakfast ? breakfast.toUpperCase() === "YES" : null,
        }
      : null,
  };
}

/** Whether the page held any of these blocks at all. */
export function hasFactSheetDetails(details: FactSheetDetails): boolean {
  return (
    details.draws.length > 0 ||
    [
      details.organisation,
      details.director,
      details.referee,
      details.academy,
      details.venue,
      details.travel,
      details.hotel,
    ].some(Boolean)
  );
}
