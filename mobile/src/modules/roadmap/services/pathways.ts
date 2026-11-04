import apiClient from "@lib/api/axios";

// Mirrors server/src/shared/controller/pathwayController.ts. Public, read-only, and no response
// carries any per-child data. Only overview, answer and the signal/decision detail are Markdown.

export interface PathwayAction {
  label: string;
  /** "/site-relative" or "https://...". Absent means a plain chip. */
  href?: string;
}

export interface PathwayStage {
  key: string;
  order: number;
  name: string;
  /** Free text ("~5-7", "10 to 14", "18+"). Never assume it parses. */
  ageRange: string;
  coreQuestion: string;
  overview: string;
  questions: Array<{ question: string; answer?: string }>;
  signals: Array<{ title: string; detail?: string }>;
  decisions: Array<{ title: string; detail?: string }>;
  nextStepLead?: string;
  nextSteps: Array<{ when: string; action: string }>;
  primaryAction?: PathwayAction;
  helpLinks: PathwayAction[];
}

export interface PathwayContributor {
  name: string;
  organisation?: string;
  url?: string;
  blurb?: string;
  /** Present only while that coach or expert is publicly bookable. */
  profile?: {
    type: "coach" | "expert";
    id: string;
    href: string;
    ctaLabel: string;
    photoUrl?: string;
  };
}

export interface PathwayGuide {
  sportSlug: string;
  sportName: string;
  intro: { eyebrow?: string; headline?: string; description?: string };
  sportIntro: string[];
  reviewedOn: string | null;
  contributor: PathwayContributor | null;
  updatedAt?: string;
  stages: PathwayStage[];
}

export interface PathwayGuideSummary {
  sportSlug: string;
  sportName: string;
  stageCount: number;
  updatedAt?: string;
  stages: Array<{ key: string; name: string; ageRange: string; coreQuestion: string }>;
}

export interface QuestionsBySport {
  sportSlug: string;
  sportName: string;
  questions: Array<{ question: string; stageKey: string; stageName: string }>;
}

export const pathwaysApi = {
  guides: async (): Promise<PathwayGuideSummary[]> =>
    (await apiClient.get("/pathways/guides")).data.data,

  guide: async (sport: string): Promise<PathwayGuide> =>
    (await apiClient.get("/pathways/guide", { params: { sport } })).data.data,

  questions: async (): Promise<QuestionsBySport[]> =>
    (await apiClient.get("/pathways/questions")).data.data,
};

/**
 * The first stage whose typical age fits. Digits are read out of the free text: two numbers are a
 * range (either order), and one number is open-ended only when the text says so ("18+", "and over").
 * A range that cannot be read never matches, so nothing is claimed that the text does not say.
 */
export function findStageForAge<T extends { ageRange: string }>(
  stages: T[],
  age: number | null
): T | null {
  if (age === null || !Number.isFinite(age)) return null;
  for (const stage of stages) {
    const nums = (stage.ageRange.match(/\d+/g) ?? []).map(Number);
    if (nums.length >= 2) {
      const lo = Math.min(nums[0], nums[1]);
      const hi = Math.max(nums[0], nums[1]);
      if (age >= lo && age <= hi) return stage;
    } else if (nums.length === 1) {
      const openEnded = /\+|and\s+(over|above|up)|onwards/i.test(stage.ageRange);
      if (openEnded ? age >= nums[0] : age === nums[0]) return stage;
    }
  }
  return null;
}

// Links whose destination is not available on mobile (and, on the web, not offered either).
const UNAVAILABLE = /^\/(booking\?tab=(academies|coaches)|shop)/i;

export const isAvailableAction = (a?: PathwayAction): a is PathwayAction =>
  Boolean(a && !(a.href && UNAVAILABLE.test(a.href)));

/** An href the app may open: web links as they are, site paths on the website, nothing else. */
export function resolveHref(href: string | undefined, webUrl: string): string | null {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return `${webUrl}${href}`;
  return null;
}
