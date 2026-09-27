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
      "Routes into schools and universities that count your child's sporting record: sports quotas, exam and attendance concessions, academies, and college sport abroad.",
    metaDescription:
      "Sports-quota admissions for young athletes in India: Delhi University, IIT Sports Excellence Admission, Kendriya Vidyalaya, CBSE concessions and US college tennis, each with its sources.",
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
      "Money and support for young athletes, from the government, federations, international bodies, companies and universities. Many are not applied for: players are picked from results, and each entry says which.",
    metaDescription:
      "Sports scholarships for young athletes in India: Khelo India, TOPS, state schemes, ITF and Asian Tennis Federation programmes, company and university scholarships, each with its sources.",
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
