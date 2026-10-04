import type { CycleState, OpportunityTrack, SelectionMode } from "../services/opportunities";

/**
 * Everything that differs between the two pages. The pages themselves are one
 * component; adding a third track would be an entry here and a route.
 */
export const TRACKS: Record<
  OpportunityTrack,
  {
    path: string;
    title: string;
    heading: string;
    intro: string;
    metaDescription: string;
    categories: Record<string, { label: string; blurb: string }>;
  }
> = {
  admission: {
    path: "/admissions",
    title: "Admissions",
    heading: "Sports admissions",
    intro:
      "Ways into schools, colleges and academies that count your child's sporting record. Each entry says how it works, who it is for and where we checked it.",
    metaDescription:
      "Sports admissions for young athletes in India: schools, colleges and academies that count a sporting record, each with its sources.",
    categories: {
      college: {
        label: "Colleges and universities",
        blurb: "Seats kept for athletes, usually on top of normal intake.",
      },
      school: { label: "Schools", blurb: "Admission rules that count a child's sporting record." },
      "exam-concession": {
        label: "Board exams and attendance",
        blurb: "What a board allows when competing clashes with school.",
      },
      academy: { label: "Academies", blurb: "Full-time training places, and how they select." },
      "study-abroad": { label: "Studying abroad", blurb: "College sport outside India." },
    },
  },
  scholarship: {
    path: "/scholarships",
    title: "Scholarships",
    heading: "Scholarships and funding",
    intro:
      "Money and support for young athletes. Some you apply for; many pick players from their results, and each entry says which, who it is for and where we checked it.",
    metaDescription:
      "Sports scholarships for young athletes in India: funding and support from governments, federations, companies and universities, each with its sources.",
    categories: {
      government: { label: "Government", blurb: "Central and state schemes." },
      federation: { label: "Federations", blurb: "Support run by a sport's own federation." },
      international: {
        label: "International",
        blurb: "Programmes run by international bodies for players from India.",
      },
      company: { label: "Companies and foundations", blurb: "Corporate and non-profit support." },
      university: { label: "Universities", blurb: "Fee waivers for athletes." },
    },
  },
};

/** Said plainly, because "apply" against "scouted" decides what a parent does next. */
export const SELECTION_LABELS: Record<SelectionMode, { label: string; explain: string }> = {
  apply: { label: "Apply", explain: "You apply, with the documents it asks for." },
  trials: { label: "Selection trials", explain: "Selection is decided at a trial." },
  nominated: {
    label: "Nominated",
    explain: "There is no application form: players are nominated, usually on their results.",
  },
  scouted: {
    label: "Picked by scouts",
    explain: "There is no application form: scouts pick players from their performances.",
  },
  recruitment: {
    label: "Recruited",
    explain: "Coaches find and approach players; the player's job is to be findable.",
  },
};

export const CYCLE_LABELS: Record<CycleState, string> = {
  open: "Open now",
  upcoming: "Opening soon",
  closed: "Closed for this cycle",
  rolling: "No fixed window",
};

export const OWNER_TYPE_LABELS: Record<string, string> = {
  "central-government": "Government of India",
  "state-government": "State government",
  federation: "Sports federation",
  "international-body": "International body",
  university: "University",
  "school-board": "School board",
  "public-sector-company": "Public-sector company",
  company: "Company",
  foundation: "Foundation",
};

/** The site's WhatsApp number, the one every other "ask us" link uses. */
const WHATSAPP_NUMBER = "918968582443";

/**
 * A WhatsApp link, with the message already written, for a parent who did not
 * find what they were after. It goes to a person; there is no form behind it.
 */
export function askUsHref(track: OpportunityTrack, sportLabel?: string): string {
  const what = track === "scholarship" ? "a sports scholarship" : "a sports admission route";
  const text = `Hi! I'm looking for ${what}${sportLabel ? ` for ${sportLabel}` : ""} for my child and did not find it on PowerMySport. Can you help?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * Below this many entries a list is shown flat, with the category on each card.
 * Grouped into five headed sections, a handful of entries is mostly headings.
 */
export const GROUP_THRESHOLD = 8;
