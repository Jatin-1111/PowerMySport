import { CalendarDays, FileText, Globe, Trophy, Users } from "lucide-react";
import type { Tournament } from "@/modules/pathway/services/pathway";
import { getSportArchetypeInfo } from "@/modules/sports/config/sportArchetypes";

// ─── Constants ────────────────────────────────────────────────────────────────

export const SPORT_LABEL: Record<string, string> = {
  cricket: "Cricket",
  tennis: "Tennis",
  chess: "Chess",
  football: "Football",
  basketball: "Basketball",
  hockey: "Hockey",
  "table-tennis": "Table Tennis",
  swimming: "Swimming",
  badminton: "Badminton",
  volleyball: "Volleyball",
};

export const TYPE_META = {
  govt: {
    label: "Government Body",
    bg: "bg-blue-500/20",
    text: "text-blue-200",
    border: "border-blue-400/30",
  },
  national: {
    label: "National Federation",
    bg: "bg-emerald-500/20",
    text: "text-emerald-200",
    border: "border-emerald-400/30",
  },
  hybrid: {
    label: "Public-Private Body",
    bg: "bg-violet-500/20",
    text: "text-violet-200",
    border: "border-violet-400/30",
  },
} as const;

export const TABS = [
  { id: "overview", label: "Overview", icon: Globe },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "eligibility", label: "Eligibility", icon: Users },
  { id: "register", label: "How to Register", icon: FileText },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/**
 * Candidate level pills, widest scope first. These are only ever *offered* when
 * the loaded tournaments actually contain them — a fixed list shipped dead
 * options: "District" and "Zonal" matched zero records anywhere in the database,
 * and for ranking/rating sports they don't exist as a concept at all (see
 * sportArchetypes.ts).
 */
const LEVEL_FILTER_CANDIDATES = [
  "International",
  "National",
  "State",
  "District",
  "Zonal",
] as const;

/**
 * Word-boundary match, NOT substring: "International".includes("national") is
 * true, so a plain substring test made the National pill select every
 * International event too. Still tolerates the free-form values scraped records
 * carry — "National (School)", "Grassroots / National" — and correctly reports
 * "National/International" as both.
 */
export function levelMatches(level: string | undefined, candidate: string): boolean {
  return !!level && new RegExp(`\\b${candidate}\\b`, "i").test(level);
}

export function availableLevelFilters(list: Tournament[]): string[] {
  return LEVEL_FILTER_CANDIDATES.filter((candidate) =>
    list.some((t) => levelMatches(t.level, candidate))
  );
}

/**
 * How the two tabs describe each other, per sport archetype.
 *
 * Archetypes exist precisely because competitive structure isn't universal (see
 * sportArchetypes.ts) — a ranking sport has no district/state ladder, so the
 * calendar can't be framed as "events at your level". Each archetype gets copy
 * that matches how progression actually works, and points at the tab that
 * explains it.
 */
export const ARCHETYPE_CALENDAR_NOTE: Record<
  ReturnType<typeof getSportArchetypeInfo>["archetype"],
  { calendar: string; competitions: string }
> = {
  ranking: {
    calendar:
      "These are ranking-circuit events — entering them is how a player earns the points that build a national ranking. The tier of each event decides how many points are on offer.",
    competitions: "See how the ranking tiers fit together",
  },
  rating: {
    calendar:
      "These are rated events — results from them move a player's official rating, which is what determines entry to higher tiers.",
    competitions: "See how the rating milestones work",
  },
  federation: {
    calendar:
      "These are the dated events on this federation's calendar. Selection runs through district and state representation before the national level.",
    competitions: "See the selection pathway",
  },
  standard: {
    calendar:
      "These are the dated meets on this federation's calendar — each is a chance to post a time or score against the published qualifying standards.",
    competitions: "See the qualifying standards",
  },
};

// ─── Small helpers ─────────────────────────────────────────────────────────────

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-title text-xl font-bold leading-tight tracking-tight text-slate-900">
        {children}
      </h2>
      <div className="bg-power-orange mt-1.5 h-[3px] w-7 rounded-full" />
    </div>
  );
}

export function RequirementPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
    >
      <div
        className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`}
      />
      <span className={`text-sm font-medium ${active ? "text-emerald-800" : "text-slate-500"}`}>
        {label}
      </span>
    </div>
  );
}
