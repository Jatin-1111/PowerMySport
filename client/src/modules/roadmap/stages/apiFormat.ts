// ─── The uploaded stage guide, as the client sees it ────────────────────────
//
// Mirrors `server/src/shared/validation/stageGuideFormat.ts`. The server owns
// the contract and validates every upload against it, so nothing here re-checks
// the shape — but every field is optional on this side anyway, because a guide
// authored for one sport will legitimately leave out what that sport doesn't
// have, and a client that assumed otherwise would crash on the first upload
// that omitted a section.
//
// `formatVersion` is the safety catch: a payload from a future format is
// refused rather than half-rendered.

export const SUPPORTED_STAGE_GUIDE_FORMAT = 1;

export interface ApiAgeBand {
  fromYears?: number;
  toYears?: number;
  label: string;
}

export interface ApiMoney {
  minInr?: number;
  maxInr?: number;
  label: string;
  note?: string;
}

export interface ApiFunding {
  name: string;
  body: string;
  kind: string;
  eligibility: string;
  benefit: string;
  approxAnnualValueInr?: number;
  howToApply?: string;
  officialUrl?: string;
  verifiedOn?: string;
}

export interface ApiCompetitionTier {
  name: string;
  level: string;
  organiser?: string;
  whoCanEnter?: string;
  approxEntryFeeInr?: number;
  whenHeld?: string;
}

export interface ApiIndiaContext {
  ageCategories?: string[];
  registration?: {
    body: string;
    requirements?: string[];
    earliestAge?: string;
    officialUrl?: string;
  };
  competitionTiers?: ApiCompetitionTier[];
  rankingSystem?: {
    name: string;
    howPointsWork?: string[];
    whatItUnlocks?: string[];
    whatItDoesNotMeasure?: string[];
  };
  schoolRoute?: string;
  stateAssociationRole?: string;
}

export interface ApiStage {
  key: string;
  number: number;
  title: string;
  shortDescription: string;
  summary: string;
  goal: string;
  age?: ApiAgeBand;
  duration?: string;
  cost?: ApiMoney;
  standard?: string;
  india?: ApiIndiaContext;
  funding?: ApiFunding[];
  gates?: { administrative?: string[]; competitive?: string[] };
  movingUp?: {
    toStageKey?: string;
    criteria?: string[];
    typicalDuration?: string;
    warning?: string;
  };
  parentGuidance?: {
    dos?: string[];
    avoid?: string[];
    questionsForCoach?: string[];
  };
  readinessChecklist?: string[];
  outcomes?: string[];
  risks?: { commonInjuries?: string[]; burnoutSigns?: string[] };
  academics?: { boardExamNote?: string; quotaRoutes?: string[]; note?: string };
  notes?: string[];
}

export interface ApiStageGuide {
  formatVersion: number;
  sport: { slug: string; name: string };
  state?: string;
  governingBody?: { name: string; acronym?: string; website?: string };
  progressMetric?: { label: string; description?: string };
  intro?: string;
  stages: ApiStage[];
  sources: Array<{ label: string; url?: string; publishedOn?: string }>;
  verifiedOn?: string;
}

export interface ApiStageGuideResponse {
  guide: ApiStageGuide;
  scope: "national" | "state";
  verifiedOn: string | null;
  updatedAt?: string;
}
