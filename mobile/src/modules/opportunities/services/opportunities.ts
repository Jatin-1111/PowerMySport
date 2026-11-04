import apiClient from "@lib/api/axios";

export type OpportunityTrack = "admission" | "scholarship";
export type CycleState = "open" | "upcoming" | "closed" | "rolling";

// Mirrors the server's public read (shared/controller/opportunityController.ts) and the web's
// modules/opportunities/services/opportunities.ts.
export interface Opportunity {
  slug: string;
  track: OpportunityTrack;
  category: string;
  title: string;
  summary?: string;
  owner?: { name: string; type: string };
  sports: string[];
  allSports: boolean;
  geography?: { scope: string; state?: string };
  eligibility?: {
    summary?: string;
    ageMin?: number;
    ageMax?: number;
    ageNote?: string;
    gender?: string;
    level?: string;
    academic?: string;
    income?: string;
  };
  selection?: string;
  benefit?: {
    summary: string;
    amount?: { value: number; currency: "INR" | "USD"; period: string; note?: string };
  };
  /** Absent when the entry does not say, which is not the same as free. */
  cost?: {
    kind: "free" | "fee" | "varies";
    amount?: number;
    currency?: "INR" | "USD";
    note?: string;
  };
  cycle?: {
    label?: string;
    opensOn?: string;
    closesOn?: string;
    keyDates?: Array<{ label: string; date: string }>;
  };
  steps?: string[];
  keyFacts?: string[];
  applyUrl?: string;
  sources?: Array<{ label: string; url: string; publishedOn?: string }>;
  lastVerifiedOn?: string;
  verificationNote?: string;
  /** Worked out by the server on each read, never stored. */
  cycleState: CycleState;
  stale: boolean;
}

export interface OpportunityList {
  items: Opportunity[];
  /** India's date, which every window was worked out against ("2026-11-04"). */
  today: string;
  sports: string[];
  categories: string[];
}

export const opportunitiesApi = {
  list: async (track: OpportunityTrack): Promise<OpportunityList> => {
    const res = await apiClient.get("/opportunities", { params: { track } });
    return res.data.data;
  },

  get: async (slug: string): Promise<Opportunity> => {
    const res = await apiClient.get(`/opportunities/${encodeURIComponent(slug)}`);
    return res.data.data;
  },

  followedSlugs: async (): Promise<string[]> => {
    const res = await apiClient.get("/opportunity-follows");
    return res.data.data?.slugs ?? [];
  },

  follow: async (slug: string): Promise<void> => {
    await apiClient.put(`/opportunity-follows/${encodeURIComponent(slug)}`);
  },

  unfollow: async (slug: string): Promise<void> => {
    await apiClient.delete(`/opportunity-follows/${encodeURIComponent(slug)}`);
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-15" as "15 Dec 2026". Dates are plain calendar days, so no time zone is involved. */
export function formatDay(iso?: string): string {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Whole days from `today` to `iso`, both calendar days. Negative once it has passed. */
export function daysBetween(today: string, iso: string): number {
  return dayNumber(iso) - dayNumber(today);
}

/** The one line a parent scans for: where the window stands today. */
export function windowLine(o: Opportunity, today: string): string {
  const { cycle } = o;
  switch (o.cycleState) {
    case "open": {
      if (!cycle?.closesOn) return "Open now";
      const left = daysBetween(today, cycle.closesOn);
      if (left <= 0) return "Closes today";
      return left === 1 ? "Open, closes tomorrow" : `Open, ${left} days left`;
    }
    case "upcoming":
      return cycle?.opensOn ? `Opens ${formatDay(cycle.opensOn)}` : "Opens soon";
    case "rolling":
      return "Applications accepted through the year";
    case "closed":
      return cycle?.closesOn ? `Closed ${formatDay(cycle.closesOn)}` : "Closed";
  }
}
