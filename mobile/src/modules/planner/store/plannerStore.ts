import { create } from "zustand";
import type { PlannerEdition, PlannerEntry } from "@powermysport/shared-types";
import {
  plannerApi,
  type CostResponse,
  type EntryCosts,
  type EntryStatusValue,
  type PlannerOverview,
  type RecommendationsResponse,
  type SeasonPlanData,
  type SeasonPreferences,
} from "../services/planner";

type Load = "idle" | "loading" | "ready" | "error";

interface PlannerState {
  childId: string | null;
  overview: PlannerOverview | null;
  overviewState: Load;
  recs: RecommendationsResponse | null;
  recsState: Load;
  costs: CostResponse | null;
  costsState: Load;

  /** Loads everything for one child. Switching child resets all of it. */
  open: (childId: string) => Promise<void>;
  refreshOverview: () => Promise<void>;
  refreshRecs: () => Promise<void>;
  refreshCosts: () => Promise<void>;
  suggest: (force: boolean) => Promise<void>;

  // Each plan change returns the whole plan; we replace our copy and let the dependents refresh.
  addEntry: (slug: string) => Promise<void>;
  removeEntry: (slug: string) => Promise<void>;
  setStatus: (slug: string, status: EntryStatusValue) => Promise<void>;
  setEntryCosts: (slug: string, costs: EntryCosts | null) => Promise<void>;
  dismiss: (slug: string) => Promise<void>;
  restore: (slug: string) => Promise<void>;
  savePreferences: (prefs: SeasonPreferences) => Promise<void>;
}

export const usePlannerStore = create<PlannerState>((set, get) => {
  const childOrThrow = (): string => {
    const id = get().childId;
    if (!id) throw new Error("No child selected");
    return id;
  };

  // A plan or preference change can make the saved suggestions stale and changes the season
  // total, so both are re-read (free: neither spends the AI allowance).
  const applyPlan = (plan: SeasonPlanData) => {
    const overview = get().overview;
    if (overview) set({ overview: { ...overview, plan } });
    void get().refreshRecs();
    void get().refreshCosts();
  };

  return {
    childId: null,
    overview: null,
    overviewState: "idle",
    recs: null,
    recsState: "idle",
    costs: null,
    costsState: "idle",

    open: async (childId) => {
      set({
        childId,
        overview: null,
        overviewState: "loading",
        recs: null,
        recsState: "idle",
        costs: null,
        costsState: "idle",
      });
      await get().refreshOverview();
      if (get().childId !== childId) return;
      if (get().overview?.linkState === "ready") {
        void get().refreshRecs();
        void get().refreshCosts();
      }
    },

    refreshOverview: async () => {
      const id = childOrThrow();
      try {
        const overview = await plannerApi.overview(id);
        if (get().childId === id) set({ overview, overviewState: "ready" });
      } catch {
        if (get().childId === id) set({ overviewState: "error" });
      }
    },

    refreshRecs: async () => {
      const id = get().childId;
      if (!id || get().overview?.linkState !== "ready") return;
      try {
        const recs = await plannerApi.recommendations(id);
        if (get().childId === id) set({ recs, recsState: "ready" });
      } catch {
        if (get().childId === id) set({ recsState: "error" });
      }
    },

    refreshCosts: async () => {
      const id = get().childId;
      if (!id || get().overview?.linkState !== "ready") return;
      const slugs = get().recs?.recommendations?.items.map((i) => i.slug) ?? [];
      try {
        const costs = await plannerApi.costs(id, slugs);
        if (get().childId === id) set({ costs, costsState: "ready" });
      } catch {
        // The planner works without estimates; the cost section says so.
        if (get().childId === id) set({ costsState: "error" });
      }
    },

    suggest: async (force) => {
      const id = childOrThrow();
      const recs = await plannerApi.suggest(id, force);
      if (get().childId !== id) return;
      set({ recs, recsState: "ready" });
      void get().refreshCosts();
    },

    addEntry: async (slug) => applyPlan(await plannerApi.addEntry(childOrThrow(), slug)),
    removeEntry: async (slug) => applyPlan(await plannerApi.removeEntry(childOrThrow(), slug)),
    setStatus: async (slug, status) =>
      applyPlan(await plannerApi.updateEntry(childOrThrow(), slug, { status })),
    setEntryCosts: async (slug, costs) =>
      applyPlan(await plannerApi.updateEntry(childOrThrow(), slug, { costs })),
    dismiss: async (slug) => applyPlan(await plannerApi.dismiss(childOrThrow(), slug)),
    restore: async (slug) => applyPlan(await plannerApi.restore(childOrThrow(), slug)),
    savePreferences: async (prefs) =>
      applyPlan(await plannerApi.savePreferences(childOrThrow(), prefs)),
  };
});

/** Every event the planner knows about, by slug, across all four buckets. */
export function calendarOf(overview: PlannerOverview | null): Map<string, PlannerEdition> {
  const map = new Map<string, PlannerEdition>();
  const shortlist = overview?.shortlist;
  if (!shortlist) return map;
  for (const bucket of [
    shortlist.ownGroup,
    shortlist.playingUp,
    shortlist.unknown,
    shortlist.closed,
  ]) {
    for (const entry of bucket) if (entry.edition.slug) map.set(entry.edition.slug, entry.edition);
  }
  return map;
}

/** Every judged entry by slug, so the detail screen can show why an event is open or closed. */
export function entriesBySlug(overview: PlannerOverview | null): Map<string, PlannerEntry> {
  const map = new Map<string, PlannerEntry>();
  const shortlist = overview?.shortlist;
  if (!shortlist) return map;
  for (const bucket of [
    shortlist.ownGroup,
    shortlist.playingUp,
    shortlist.unknown,
    shortlist.closed,
  ]) {
    for (const entry of bucket) if (entry.edition.slug) map.set(entry.edition.slug, entry);
  }
  return map;
}
