import { SUPPORTED_SPORT_NAMES } from "@/modules/sports/config/supportedSports";

import type {
  AdminOpportunity,
  OpportunityPayload,
  OpportunityTrack,
} from "../../services/opportunities";

// ─── The editor's form model ────────────────────────────────────────────────
//
// Every input is held as a string so the fields stay controlled, and
// `toPayload` turns that into the record the server validates: blank strings
// become absent keys (the schema rejects "" where it accepts nothing), numbers
// are parsed, and an amount with no value is dropped as a whole.

export const CATEGORY_OPTIONS: Record<OpportunityTrack, Array<{ value: string; label: string }>> = {
  admission: [
    { value: "college", label: "Colleges and universities" },
    { value: "school", label: "Schools" },
    { value: "exam-concession", label: "Board exams and attendance" },
    { value: "academy", label: "Academies" },
    { value: "study-abroad", label: "Studying abroad" },
  ],
  scholarship: [
    { value: "government", label: "Government" },
    { value: "federation", label: "Federations" },
    { value: "international", label: "International" },
    { value: "company", label: "Companies and foundations" },
    { value: "university", label: "Universities" },
  ],
};

export const OWNER_TYPE_OPTIONS = [
  { value: "central-government", label: "Government of India" },
  { value: "state-government", label: "State government" },
  { value: "federation", label: "Sports federation" },
  { value: "international-body", label: "International body" },
  { value: "university", label: "University" },
  { value: "school-board", label: "School board" },
  { value: "public-sector-company", label: "Public-sector company" },
  { value: "company", label: "Company" },
  { value: "foundation", label: "Foundation" },
];

export const SELECTION_OPTIONS = [
  { value: "apply", label: "Apply (there is a form)" },
  { value: "trials", label: "Selection trials" },
  { value: "nominated", label: "Nominated (no application)" },
  { value: "scouted", label: "Picked by scouts (no application)" },
  { value: "recruitment", label: "Recruited by coaches" },
];

export const SCOPE_OPTIONS = [
  { value: "india", label: "Across India" },
  { value: "state", label: "One state" },
  { value: "international", label: "International" },
  { value: "abroad", label: "Abroad (study or play outside India)" },
];

export const sportSlugOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

export const SPORT_OPTIONS = SUPPORTED_SPORT_NAMES.map((name) => ({
  value: sportSlugOf(name),
  label: name,
}));

export interface OpportunityForm {
  slug: string;
  track: OpportunityTrack;
  category: string;
  title: string;
  summary: string;
  ownerName: string;
  ownerType: string;
  allSports: boolean;
  sports: string[];
  scope: string;
  state: string;
  ageMin: string;
  ageMax: string;
  ageNote: string;
  gender: string;
  level: string;
  academic: string;
  income: string;
  selection: string;
  benefitSummary: string;
  amountValue: string;
  amountCurrency: string;
  amountPeriod: string;
  amountNote: string;
  cycleLabel: string;
  opensOn: string;
  closesOn: string;
  keyDates: Array<{ label: string; date: string }>;
  steps: string[];
  keyFacts: string[];
  applyUrl: string;
  sources: Array<{ label: string; url: string; publishedOn: string }>;
  verificationNote: string;
}

export function formFromDoc(doc: AdminOpportunity): OpportunityForm {
  const amount = doc.benefit?.amount;
  return {
    slug: doc.slug,
    track: doc.track,
    category: doc.category,
    title: doc.title,
    summary: doc.summary ?? "",
    ownerName: doc.owner?.name ?? "",
    ownerType: doc.owner?.type ?? "",
    allSports: doc.allSports ?? false,
    sports: doc.sports ?? [],
    scope: doc.geography?.scope ?? "",
    state: doc.geography?.state ?? "",
    ageMin: doc.eligibility?.ageMin?.toString() ?? "",
    ageMax: doc.eligibility?.ageMax?.toString() ?? "",
    ageNote: doc.eligibility?.ageNote ?? "",
    gender: doc.eligibility?.gender ?? "any",
    level: doc.eligibility?.level ?? "",
    academic: doc.eligibility?.academic ?? "",
    income: doc.eligibility?.income ?? "",
    selection: doc.selection ?? "",
    benefitSummary: doc.benefit?.summary ?? "",
    amountValue: amount?.value?.toString() ?? "",
    amountCurrency: amount?.currency ?? "INR",
    amountPeriod: amount?.period ?? "year",
    amountNote: amount?.note ?? "",
    cycleLabel: doc.cycle?.label ?? "",
    opensOn: doc.cycle?.opensOn ?? "",
    closesOn: doc.cycle?.closesOn ?? "",
    keyDates: doc.cycle?.keyDates ?? [],
    steps: doc.steps ?? [],
    keyFacts: doc.keyFacts ?? [],
    applyUrl: doc.applyUrl ?? "",
    sources: (doc.sources ?? []).map((s) => ({ ...s, publishedOn: s.publishedOn ?? "" })),
    verificationNote: doc.verificationNote ?? "",
  };
}

const text = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const int = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Keep only the keys that carry a value. */
const compact = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

export function payloadFromForm(form: OpportunityForm): OpportunityPayload {
  const amountValue = int(form.amountValue);
  const ownerName = text(form.ownerName);
  const benefitSummary = text(form.benefitSummary);

  return compact({
    slug: form.slug.trim(),
    track: form.track,
    category: form.category,
    title: form.title.trim(),
    summary: text(form.summary),
    owner: ownerName && form.ownerType ? { name: ownerName, type: form.ownerType } : undefined,
    allSports: form.allSports,
    sports: form.allSports ? [] : form.sports,
    geography: form.scope
      ? compact({ scope: form.scope, state: form.scope === "state" ? text(form.state) : undefined })
      : undefined,
    eligibility: compact({
      ageMin: int(form.ageMin),
      ageMax: int(form.ageMax),
      ageNote: text(form.ageNote),
      gender: form.gender || "any",
      level: text(form.level),
      academic: text(form.academic),
      income: text(form.income),
    }),
    selection: form.selection || undefined,
    benefit: benefitSummary
      ? compact({
          summary: benefitSummary,
          amount:
            amountValue !== undefined
              ? compact({
                  value: amountValue,
                  currency: form.amountCurrency,
                  period: form.amountPeriod,
                  note: text(form.amountNote),
                })
              : undefined,
        })
      : undefined,
    cycle: compact({
      label: text(form.cycleLabel),
      opensOn: text(form.opensOn),
      closesOn: text(form.closesOn),
      keyDates: form.keyDates
        .filter((d) => d.label.trim() && d.date.trim())
        .map((d) => ({ label: d.label.trim(), date: d.date.trim() })),
    }),
    steps: form.steps.map((s) => s.trim()).filter(Boolean),
    keyFacts: form.keyFacts.map((s) => s.trim()).filter(Boolean),
    applyUrl: text(form.applyUrl),
    sources: form.sources
      .filter((s) => s.label.trim() && s.url.trim())
      .map((s) =>
        compact({ label: s.label.trim(), url: s.url.trim(), publishedOn: text(s.publishedOn) })
      ),
    verificationNote: text(form.verificationNote),
  }) as OpportunityPayload;
}
