/**
 * The parts of a federation fact sheet that are blocks, not single values: the
 * draws table, and who runs the event, where it is and where to stay. Mirrors the
 * server's `FactSheetDetails`. Every field is a value the federation printed; a
 * block it did not print is null, and the page leaves it out.
 */

export interface DrawRow {
  /** "BS18": boys' singles under 18. */
  code: string;
  stage: "main" | "qualifying";
  size: number | null;
  startDate: string | null;
  endDate: string | null;
  signIn: { date: string; time: string | null } | null;
}

export interface FactSheetContact {
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface FactSheetPlace {
  name: string | null;
  contact: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface FactSheetHotel {
  name: string | null;
  distanceFromVenue: string | null;
  contact: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  doublePrice: { amount: number; note: string | null } | null;
  breakfastIncluded: boolean | null;
}

/** What the organiser typed under "Additional Tournament Information", kept as written. */
export interface AdditionalInfo {
  meeting: string | null;
  notes: string[];
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
  director: FactSheetContact | null;
  referee: (FactSheetContact & { certification: string | null }) | null;
  academy: FactSheetPlace | null;
  venue: FactSheetPlace | null;
  travel: { airport: string | null; trainStation: string | null } | null;
  hotel: FactSheetHotel | null;
  additional?: AdditionalInfo | null;
}
