// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { buildShortlist, homeStanding, annualEntryCap } from "@powermysport/shared-types";

/**
 * The planner as a parent meets it: the real components, hooks, react-query cache
 * and auth store, with only the API modules replaced by an in-memory world.
 *
 * Each piece has its own tests. What nothing else covers is the composition: that
 * adding an event from a suggestion moves it onto the plan, marks the suggestions
 * out of date and re-prices the season; that a figure typed on one card reaches the
 * total; that every state a child can be in shows what it should. This is also where
 * the page is scanned for accessibility problems, since a rendered DOM is the only
 * place they exist.
 */

// The calendar shows one month, so which events are in view depends on the date. It is
// fixed (only the date, not the timers, so waiting still works): a Tuesday early in
// October, which puts the first events in October and the later ones in November.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-10-06T10:00:00.000Z"));

// ─── The in-memory world ──────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const TODAY = Date.UTC(
  new Date().getUTCFullYear(),
  new Date().getUTCMonth(),
  new Date().getUTCDate()
);
const day = (offset: number): string => new Date(TODAY + offset * DAY).toISOString();

const edition = (slug: string, start: number, over: Record<string, unknown> = {}) => ({
  slug,
  name: `AITA ${slug}`,
  startDate: day(start),
  endDate: day(start + 4),
  city: "Sonipat",
  state: "Haryana",
  ageGroups: ["Under-14"],
  ladder: "Championship Series",
  grade: 7,
  kind: "junior-ladder",
  ...over,
});

const day10 = (offset: number): string => day(offset).slice(0, 10);

/** What AITA's page for an event says. The board shows it and does not work it out. */
const official = (start: number, over: Record<string, unknown> = {}) => ({
  source: "factSheet",
  entryOpens: day10(start - 40),
  entryCloses: day10(start - 7),
  withdrawalDeadline: day10(start - 5),
  freezeDeadline: day10(start - 2),
  times: { entryCloses: "23:59", withdrawal: "23:59", freeze: "15:00" },
  dailyAllowance: 400,
  surface: "Clay",
  pageUrl: "https://www.aita.hitcourt.com/tournament-acceptance-factsheet-MjkyMQ==",
  checkedAt: day(-1),
  ...over,
});

const EDITIONS = [
  edition("cs7-sonipat", 10, { registrationDeadlineDate: day(3), official: official(10) }),
  edition("cs5-pune", 12, { city: "Pune", state: "Maharashtra" }),
  edition("ts-jaipur", 30, {
    ladder: "Talent Series",
    grade: 1,
    city: "Jaipur",
    state: "Rajasthan",
  }),
  edition("ss-delhi", 50, {
    ladder: "Super Series",
    grade: null,
    city: "Delhi",
    state: "Delhi",
    official: official(50, { feeSingles: 700, feeDoubles: 900 }),
  }),
  edition("cs-closed", 20, { registrationDeadlineDate: day(-2) }),
  edition("cs9-mumbai", 40, { ageGroups: ["Under-16"], city: "Mumbai", state: "Maharashtra" }),
];

interface Entry {
  editionSlug: string;
  name: string;
  startDate: string;
  status: "shortlisted" | "entered" | "played";
  addedAt: string;
  costs?: { travel?: number; stay?: number; entryFee?: number };
}

const world = {
  plan: [] as Entry[],
  prefs: { goal: "points", blockedRanges: [] as unknown[], budget: null as number | null },
  recs: null as null | { savedKey: string; value: Record<string, unknown> },
  used: 0,
  aiDown: false,
  city: null as string | null,
  planFails: false,
  costsFail: false,
  extra: [] as ReturnType<typeof edition>[],
};

const reset = () => {
  world.plan = [];
  world.prefs = { goal: "points", blockedRanges: [], budget: null };
  world.recs = null;
  world.used = 0;
  world.aiDown = false;
  world.city = null;
  world.planFails = false;
  world.costsFail = false;
  world.extra = [];
};

const planData = (id: string) => ({
  dependentId: id,
  sportSlug: "tennis",
  entries: world.plan
    .map((entry) => ({ ...entry, ...(entry.costs ? { costs: { ...entry.costs } } : {}) }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  preferences: { ...world.prefs },
});

const overview = (id: string) => {
  if (id !== "c1") {
    return {
      dependentId: id,
      dependentName: id === "c2" ? "Diya" : "Kabir",
      sportSlug: "tennis",
      linkState: "not-linked",
      standing: null,
      annualEntryCap: null,
      shortlist: null,
      plan: planData(id),
      editionsConsidered: 0,
    };
  }
  const home = homeStanding([
    { subcategory: "U-14", rank: 312, category: "Boys", totalPoints: 148, state: "Haryana" },
  ])!;
  return {
    dependentId: id,
    dependentName: "Aarav",
    sportSlug: "tennis",
    linkState: "ready",
    standing: { ...home, asOnDate: "2026-09-07T00:00:00.000Z" },
    annualEntryCap: annualEntryCap("U-14"),
    shortlist: buildShortlist([...EDITIONS, ...world.extra], { bracket: "U-14", rank: 312 }),
    plan: planData(id),
    editionsConsidered: EDITIONS.length,
  };
};

/** What the suggestions were built from: if it moves, they are out of date. */
const inputKey = () =>
  JSON.stringify({ plan: world.plan.map((entry) => entry.editionSlug), prefs: world.prefs });

const suggestionFor = () => {
  const onPlan = new Set(world.plan.map((entry) => entry.editionSlug));
  const items = [
    { slug: "cs7-sonipat", tier: "recommended", reason: "Championship Series in Haryana." },
    {
      slug: "ts-jaipur",
      tier: "recommended",
      reason: "Talent Series in Rajasthan, 20 days later.",
    },
    { slug: "ss-delhi", tier: "consider", reason: "Super Series, a national-level event." },
  ].filter((item) => !onPlan.has(item.slug));
  return {
    source: "ai",
    generatedAt: day(0),
    goal: world.prefs.goal,
    summary: "Three events across the weeks ahead.",
    items,
    notes: ["1 event has already closed entries."],
  };
};

const costFor = (entry: Entry | undefined, slug?: string) => {
  const yours = entry?.costs ?? {};
  const printed = (
    EDITIONS.find((e) => e.slug === (slug ?? entry?.editionSlug)) as
      { official?: { feeSingles?: number } } | undefined
  )?.official?.feeSingles;
  const travel =
    yours.travel !== undefined
      ? { low: yours.travel, high: yours.travel, basis: "yours" }
      : { low: 13000, high: 27000, basis: "estimate" };
  const stay =
    yours.stay !== undefined
      ? { low: yours.stay, high: yours.stay, basis: "yours" }
      : { low: 11500, high: 22500, basis: "estimate" };
  const fee = yours.entryFee ?? printed ?? null;
  return {
    source: "ai",
    assumptions:
      "A child and one parent, economy rail or bus, 5 nights in a budget hotel with meals.",
    travel,
    stay,
    entryFee: fee,
    entryFeeBasis:
      yours.entryFee !== undefined ? "yours" : printed !== undefined ? "fact-sheet" : null,
    total: {
      low: travel.low + stay.low + (fee ?? 0),
      high: travel.high + stay.high + (fee ?? 0),
    },
    entryFeeMissing: fee === null,
    note: null,
  };
};

const costsResponse = (slugs: string[]) => {
  const upcoming = world.plan.filter((entry) => entry.status !== "played");
  const all = [...new Set([...upcoming.map((e) => e.editionSlug), ...slugs])];
  const events = Object.fromEntries(
    all.map((slug) => [
      slug,
      {
        slug,
        ...costFor(
          world.plan.find((e) => e.editionSlug === slug),
          slug
        ),
      },
    ])
  );
  const planned = upcoming.map((entry) => events[entry.editionSlug]!.total);
  const total = planned.length
    ? {
        low: planned.reduce((sum, t) => sum + t.low, 0),
        high: planned.reduce((sum, t) => sum + t.high, 0),
      }
    : null;
  const budget = world.prefs.budget;
  const status =
    !total || budget === null
      ? "none"
      : total.high <= budget
        ? "within"
        : total.low <= budget
          ? "may-exceed"
          : "over";
  return {
    origin: world.city
      ? { kind: "city", city: world.city, label: world.city }
      : { kind: "state", state: "Haryana", label: "Haryana" },
    events,
    season: {
      events: planned.length,
      withoutFigures: 0,
      total,
      budget,
      status,
      missingEntryFees: upcoming.filter((e) => events[e.editionSlug]!.entryFee === null).length,
    },
  };
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const suggestCalls: boolean[] = [];
const savedCosts: unknown[] = [];
const savedPrefs: unknown[] = [];
const savedCities: string[] = [];

vi.mock("@/modules/planner/services/planner", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  plannerApi: {
    get: async (id: string) => overview(id),
    getRecommendations: async () => ({
      ready: true,
      recommendations: world.recs
        ? { ...world.recs.value, stale: world.recs.savedKey !== inputKey() }
        : null,
      usage: { used: world.used, cap: 10 },
    }),
    suggest: async (_id: string, force: boolean) => {
      suggestCalls.push(force);
      if (world.aiDown) {
        const value = { ...suggestionFor(), source: "rules", fallbackReason: "ai-unavailable" };
        world.recs = { savedKey: inputKey(), value };
        return {
          ready: true,
          recommendations: { ...value, stale: false },
          usage: { used: world.used, cap: 10 },
        };
      }
      world.used += 1;
      const value = suggestionFor();
      world.recs = { savedKey: inputKey(), value };
      return {
        ready: true,
        recommendations: { ...value, stale: false },
        usage: { used: world.used, cap: 10 },
      };
    },
    getCosts: async (_id: string, slugs: string[]) => {
      if (world.costsFail) throw new Error("boom");
      return costsResponse(slugs);
    },
    saveHomeCity: async (city: string) => {
      savedCities.push(city);
      world.city = city;
      return city;
    },
  },
}));

vi.mock("@/modules/planner/services/seasonPlan", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  seasonPlanApi: {
    get: async (id: string) => {
      if (world.planFails) throw new Error("boom");
      return planData(id);
    },
    add: async (id: string, slug: string) => {
      const found = [...EDITIONS, ...world.extra].find((e) => e.slug === slug)!;
      if (!world.plan.some((e) => e.editionSlug === slug)) {
        world.plan.push({
          editionSlug: slug,
          name: found.name,
          startDate: found.startDate,
          status: "shortlisted",
          addedAt: day(0),
        });
      }
      return planData(id);
    },
    setStatus: async (id: string, slug: string, status: Entry["status"]) => {
      world.plan.find((e) => e.editionSlug === slug)!.status = status;
      return planData(id);
    },
    remove: async (id: string, slug: string) => {
      world.plan = world.plan.filter((e) => e.editionSlug !== slug);
      return planData(id);
    },
    setCosts: async (id: string, slug: string, costs: Record<string, number | null>) => {
      savedCosts.push(costs);
      const entry = world.plan.find((e) => e.editionSlug === slug)!;
      const next: Record<string, number> = { ...(entry.costs ?? {}) };
      for (const [key, value] of Object.entries(costs)) {
        if (value === null) delete next[key];
        else next[key] = value;
      }
      entry.costs = Object.keys(next).length ? next : undefined;
      return planData(id);
    },
    setPreferences: async (id: string, prefs: typeof world.prefs) => {
      savedPrefs.push(prefs);
      world.prefs = { ...prefs, budget: prefs.budget ?? null };
      return planData(id);
    },
  },
}));

const profileUser = {
  _id: "u1",
  name: "Rahul",
  email: "r@example.test",
  role: "Parent",
  dependents: [
    { _id: "c1", name: "Aarav", chosenSport: "Tennis" },
    { _id: "c2", name: "Diya", chosenSport: "Tennis" },
    { _id: "c3", name: "Kabir", chosenSport: "Badminton" },
  ],
};

vi.mock("@/modules/auth/services/auth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  authApi: { getProfile: async () => ({ success: true, data: profileUser }) },
}));

vi.mock("@/modules/player/services/rankingClaim", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  rankingClaimApi: { list: async () => [], create: vi.fn(), remove: vi.fn() },
}));

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { PlannerApp } from "@/modules/planner/components/PlannerApp";

// ─── Harness ──────────────────────────────────────────────────────────────────

function renderPlanner(session: "parent" | "anonymous" | "coach" = "parent") {
  useAuthStore.setState({
    hydrated: true,
    token: session === "anonymous" ? null : "token",
    user:
      session === "anonymous"
        ? null
        : ({ ...profileUser, id: "u1", role: session === "coach" ? "Coach" : "Parent" } as never),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlannerApp />
    </QueryClientProvider>
  );
}

/**
 * The page's regions, by the names a parent would use. Plan and Suggested are the two
 * tabs of the side panel (both stay mounted, so either can be read at any time), and
 * the full list of events is closed until it is opened.
 */
const section = (title: string): HTMLElement => {
  if (title === "Suggested season") return screen.getByRole("tabpanel", { name: /^Suggested/ });
  if (title === "Their plan") return screen.getByRole("tabpanel", { name: /^Plan/ });
  const collapsible = title === "What they can enter" || title === "Every event they can enter";
  // The collapsible's heading holds its description too, so it is found by its start.
  const heading = screen.getByRole("heading", {
    level: 2,
    name: collapsible ? new RegExp(`^${title}`) : title,
  });
  if (collapsible) {
    const toggle = within(heading).getByRole("button");
    if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
  }
  return heading.closest("section") as HTMLElement;
};

/** The summary tile that says what the season may cost, which holds the budget. */
const cost = (): HTMLElement => section("What it may cost");

const originalMatchMedia = window.matchMedia;
/** A wide screen: the details sit beside the calendar and the season is drawn as a grid. */
const wide = () => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
};
const narrow = () => {
  window.matchMedia = originalMatchMedia;
};

beforeEach(() => {
  reset();
  suggestCalls.length = 0;
  savedCosts.length = 0;
  savedPrefs.length = 0;
  savedCities.length = 0;
});

// ─── Who sees what ────────────────────────────────────────────────────────────

describe("who the planner is for", () => {
  it("shows a signed-out visitor what it does and asks them in", () => {
    renderPlanner("anonymous");

    expect(screen.getByText("Only events your child can enter")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?redirect=/planner"
    );
    expect(screen.queryByText("Aarav")).toBeNull();
  });

  it("tells an account that is not a parent or player that there is nothing to plan", () => {
    renderPlanner("coach");
    expect(screen.getByText(/built for parents and players/)).toBeTruthy();
  });

  it("opens on a tennis child, because tennis is all it covers", async () => {
    renderPlanner();

    expect(await screen.findByRole("tab", { name: "Aarav", selected: true })).toBeTruthy();
  });
});

describe("the states a child can be in", () => {
  it("asks for a ranking when none is linked, and says what for", async () => {
    renderPlanner();
    fireEvent.click(await screen.findByRole("tab", { name: "Diya" }));

    expect(await screen.findByRole("heading", { name: /Link Diya.s AITA ranking/ })).toBeTruthy();
    expect(screen.getByText(/checked and not stored/)).toBeTruthy();
  });

  it("says plainly that it covers tennis for a child who plays something else", async () => {
    renderPlanner();
    fireEvent.click(await screen.findByRole("tab", { name: "Kabir" }));

    expect(await screen.findByText(/covers tennis for now/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link a ranking" })).toBeNull();
  });

  it("starts a switched child from a clean page, with nothing carried over", async () => {
    renderPlanner();
    await screen.findAllByText(/Boys U-14, rank 312/);
    fireEvent.click(screen.getByRole("tab", { name: "Diya" }));

    expect(await screen.findByRole("heading", { name: /Link Diya/ })).toBeTruthy();
    expect(screen.queryAllByText(/Boys U-14, rank 312/)).toEqual([]);
  });
});

// ─── The timeline ─────────────────────────────────────────────────────────────

describe("what a child can enter", () => {
  it("lists their own age group by month, and keeps the rest behind disclosures", async () => {
    renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));

    expect(within(enter).getByText("AITA cs7-sonipat")).toBeTruthy();
    expect(within(enter).queryByText("AITA cs9-mumbai")).toBeNull();
    fireEvent.click(within(enter).getByRole("button", { name: /Events in an older age group/ }));
    expect(within(enter).getByText("AITA cs9-mumbai")).toBeTruthy();
  });

  it("says an entry deadline is not published rather than leaving a gap", async () => {
    renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));

    expect(within(enter).getAllByText(/Entry deadline not published/).length).toBeGreaterThan(0);
  });

  it("flags a deadline that is about to pass, and offers no actions on one that has", async () => {
    renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));

    expect(within(enter).getByText(/Entries closing soon/)).toBeTruthy();
    const closed = within(enter).getByText("AITA cs-closed").closest("li") as HTMLElement;
    expect(within(closed).getByText(/Entries closed/)).toBeTruthy();
    expect(within(closed).queryByRole("button", { name: /Add .* to the plan/ })).toBeNull();
  });
});

// ─── Suggestions ──────────────────────────────────────────────────────────────

describe("the suggested season", () => {
  const suggest = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /Suggest my season/ }));
    return waitFor(() => {
      const el = section("Suggested season");
      expect(within(el).getByText(/Three events across the weeks ahead/)).toBeTruthy();
      return el;
    });
  };

  it("makes nothing until the parent asks, and says what it will do", async () => {
    renderPlanner();
    const el = await waitFor(() => section("Suggested season"));

    expect(await within(el).findByRole("button", { name: /Suggest my season/ })).toBeTruthy();
    expect(within(el).getByText(/checked against the entry rules/)).toBeTruthy();
    expect(suggestCalls).toEqual([]);
  });

  it("shows the suggestions with their reasons, where they came from, and the day's use", async () => {
    renderPlanner();
    const el = await suggest();

    expect(within(el).getByText(/Championship Series in Haryana/)).toBeTruthy();
    expect(within(el).getByText("Worth considering")).toBeTruthy();
    expect(within(el).getByText(/Chosen by an AI model/)).toBeTruthy();
    expect(within(el).getByText(/1 of 10 fresh suggestions used today/)).toBeTruthy();
    expect(within(el).getByText(/1 event has already closed entries/)).toBeTruthy();
  });

  it("prices each suggestion, and says whether the entry fee is in it", async () => {
    renderPlanner();
    const el = await suggest();

    // Two events have no published fee, so their total leaves it out and says so.
    await waitFor(() =>
      expect(within(el).getAllByText(/Travel and stay ₹24,500 to ₹49,500/).length).toBe(2)
    );
    expect(within(el).getAllByText(/\(estimate, entry fee not included\)/).length).toBe(2);
    // The third has AITA's own fee, which is added and named as AITA's.
    expect(within(el).getByText(/Travel and stay ₹25,200 to ₹50,200/)).toBeTruthy();
    expect(within(el).getByText(/\(estimate, includes the ₹700 AITA entry fee\)/)).toBeTruthy();
  });

  it("moves an event onto the plan and says the suggestions are now out of date", async () => {
    renderPlanner();
    const el = await suggest();

    fireEvent.click(within(el).getByRole("button", { name: "Add AITA cs7-sonipat to the plan" }));

    const plan = await waitFor(() => {
      const planSection = section("Their plan");
      expect(within(planSection).getByText("AITA cs7-sonipat")).toBeTruthy();
      return planSection;
    });
    expect(plan).toBeTruthy();
    expect(
      await within(section("Suggested season")).findByText(/have changed since these were made/)
    ).toBeTruthy();
  });

  it("says when the answer came from the planner's rules, and why", async () => {
    world.aiDown = true;
    renderPlanner();
    fireEvent.click(await screen.findByRole("button", { name: /Suggest my season/ }));

    const el = section("Suggested season");
    expect(await within(el).findByText(/AI model could not be reached/)).toBeTruthy();
    expect(within(el).getByText(/Chosen by the planner's own rules/)).toBeTruthy();
    expect(within(el).queryByText(/Chosen by an AI model/)).toBeNull();
  });

  it("asks for a fresh answer, and spends one, only when told to", async () => {
    renderPlanner();
    const el = await suggest();

    fireEvent.click(within(el).getByRole("button", { name: /Suggest again/ }));
    await waitFor(() => expect(suggestCalls).toEqual([false, true]));
  });

  it("stops offering a fresh answer once the day's are used", async () => {
    world.used = 10;
    world.recs = { savedKey: inputKey(), value: suggestionFor() };
    renderPlanner();

    const el = await waitFor(() => section("Suggested season"));
    const again = await within(el).findByRole("button", { name: /Suggest again/ });
    expect((again as HTMLButtonElement).disabled).toBe(true);
  });
});

// ─── Preferences ──────────────────────────────────────────────────────────────

describe("planning preferences", () => {
  const open = async () => {
    const el = await waitFor(() => section("Suggested season"));
    fireEvent.click(await within(el).findByRole("button", { name: /Planning preferences/ }));
    return el;
  };

  it("saves the goal, a blocked range and a budget together", async () => {
    renderPlanner();
    const el = await open();

    fireEvent.click(within(el).getByRole("radio", { name: /Match experience/ }));
    fireEvent.click(within(el).getByRole("button", { name: "Add dates" }));
    fireEvent.change(within(el).getByLabelText("From"), { target: { value: "2026-11-20" } });
    fireEvent.change(within(el).getByLabelText("To"), { target: { value: "2026-11-25" } });
    fireEvent.change(within(el).getByLabelText(/Season budget/), { target: { value: "60000" } });
    fireEvent.click(within(el).getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(savedPrefs.length).toBe(1));
    expect(savedPrefs[0]).toEqual({
      goal: "experience",
      budget: 60000,
      blockedRanges: [{ from: "2026-11-20", to: "2026-11-25" }],
    });
  });

  it("will not save a budget that is not an amount, or dates that run backwards", async () => {
    renderPlanner();
    const el = await open();

    fireEvent.change(within(el).getByLabelText(/Season budget/), { target: { value: "lots" } });
    expect(within(el).getByText(/whole rupees/)).toBeTruthy();
    fireEvent.change(within(el).getByLabelText(/Season budget/), { target: { value: "" } });
    fireEvent.click(within(el).getByRole("button", { name: "Add dates" }));
    fireEvent.change(within(el).getByLabelText("From"), { target: { value: "2026-11-25" } });
    fireEvent.change(within(el).getByLabelText("To"), { target: { value: "2026-11-20" } });

    expect(within(el).getByText(/end date is before the start date/)).toBeTruthy();
    expect(
      (within(el).getByRole("button", { name: "Save preferences" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("says what is saved in the closed panel, budget included", async () => {
    world.prefs = { goal: "home", blockedRanges: [], budget: 60000 };
    renderPlanner();
    const el = await waitFor(() => section("Suggested season"));

    expect(await within(el).findByText(/Stay close to home, budget ₹60,000/)).toBeTruthy();
  });
});

// ─── Costs and the budget ─────────────────────────────────────────────────────

describe("what the season may cost", () => {
  const withPlanned = async (slug = "cs7-sonipat") => {
    renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));
    fireEvent.click(
      await within(enter).findByRole("button", { name: `Add AITA ${slug} to the plan` })
    );
    return waitFor(() => {
      const planSection = section("Their plan");
      expect(within(planSection).getByText(`AITA ${slug}`)).toBeTruthy();
      return planSection;
    });
  };

  it("prices the plan, and says the total leaves out entry fees", async () => {
    await withPlanned();

    expect(
      await within(cost()).findByText(/Season travel and stay ₹24,500 to ₹49,500/)
    ).toBeTruthy();
    expect(within(cost()).getByText(/Entry fees are not included for 1 event/)).toBeTruthy();
    expect(within(cost()).getByText(/Set a season budget in Planning preferences/)).toBeTruthy();
  });

  it("compares the season with the budget", async () => {
    world.prefs = { goal: "points", blockedRanges: [], budget: 40000 };
    await withPlanned();

    expect(await within(cost()).findByText(/could reach ₹49,500 against ₹40,000/)).toBeTruthy();
    expect(within(cost()).getByRole("img").getAttribute("aria-label")).toMatch(/budget of ₹40,000/);
  });

  it("takes a figure the parent types, shows it as theirs, and updates the total", async () => {
    const plan = await withPlanned();
    await within(cost()).findByText(/Season travel and stay/);

    fireEvent.click(within(plan).getByRole("button", { name: /Add or edit my figures/ }));
    fireEvent.change(within(plan).getByLabelText("Travel"), { target: { value: "8000" } });
    fireEvent.change(within(plan).getByLabelText("Stay and meals"), { target: { value: "9000" } });
    fireEvent.change(within(plan).getByLabelText("Entry fee"), { target: { value: "1500" } });
    fireEvent.click(within(plan).getByRole("button", { name: "Save figures" }));

    await waitFor(() => expect(savedCosts).toEqual([{ travel: 8000, stay: 9000, entryFee: 1500 }]));
    expect(await within(cost()).findByText(/Season travel and stay ₹18,500/)).toBeTruthy();
    expect(within(plan).getByText(/your figures, includes your entry fee of ₹1,500/)).toBeTruthy();
    expect(within(cost()).queryByText(/Entry fees are not included/)).toBeNull();
  });

  it("asks for a city, says what happens to it, and re-prices from it once saved", async () => {
    await withPlanned();
    expect(
      await screen.findByText(/start from Haryana, the state on the ranking list/)
    ).toBeTruthy();
    expect(screen.getByText(/shared with our AI model/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Your city"), { target: { value: "Pune" } });
    fireEvent.click(screen.getByRole("button", { name: "Save city" }));

    await waitFor(() => expect(savedCities).toEqual(["Pune"]));
    expect(await screen.findByText(/Travel estimates start from Pune/)).toBeTruthy();
  });

  it("shows the plan at once and the figures when they arrive", async () => {
    const plan = await withPlanned();
    // The plan is on screen before, or as, the first price arrives: it never waits on it.
    expect(within(plan).getByText("AITA cs7-sonipat")).toBeTruthy();
    expect(await within(plan).findByText(/Travel and stay ₹24,500/)).toBeTruthy();
  });
});

// ─── Calendar and clashes ─────────────────────────────────────────────────────

describe("the plan", () => {
  it("warns about two events that overlap", async () => {
    renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));
    fireEvent.click(
      await within(enter).findByRole("button", { name: "Add AITA cs7-sonipat to the plan" })
    );
    await waitFor(() => within(section("Their plan")).getByText("AITA cs7-sonipat"));
    fireEvent.click(within(enter).getByRole("button", { name: "Add AITA cs5-pune to the plan" }));

    expect(
      await within(section("Their plan")).findByText(/Overlaps with AITA cs7-sonipat/)
    ).toBeTruthy();
  });

  it("gives every event a Google Calendar link with its dates", async () => {
    renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));
    const link = (
      await within(enter).findAllByRole("link", { name: /to Google Calendar/ })
    )[0] as HTMLAnchorElement;

    expect(link.href).toContain("https://calendar.google.com/calendar/render");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });
});

describe("when something goes wrong", () => {
  it("says so when the estimates cannot be had, instead of leaving a blank that reads as free", async () => {
    world.costsFail = true;
    renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));
    fireEvent.click(
      await within(enter).findByRole("button", { name: "Add AITA cs7-sonipat to the plan" })
    );

    const plan = await waitFor(() => {
      const el = section("Their plan");
      expect(within(el).getByText("AITA cs7-sonipat")).toBeTruthy();
      return el;
    });
    expect(
      await within(cost()).findByText(/Cost estimates are not available just now/)
    ).toBeTruthy();
    // The plan itself is untouched.
    expect(within(plan).getByRole("button", { name: /Mark entered/ })).toBeTruthy();
  });

  it("keeps the rest of the page when the plan fails to load", async () => {
    world.planFails = true;
    renderPlanner();

    // The verdicts come from a different request, so they still show.
    expect((await screen.findAllByText(/Boys U-14, rank 312/)).length).toBeGreaterThan(0);
    expect(
      within(await waitFor(() => section("Every event they can enter"))).getByText(
        "AITA cs7-sonipat"
      )
    ).toBeTruthy();
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe("accessibility", () => {
  // jsdom has no layout, so colour contrast cannot be judged here and is switched
  // off; everything else axe checks (names, roles, labels, structure) is real.
  const scan = async (root: HTMLElement) => {
    const results = await axe.run(root, { rules: { "color-contrast": { enabled: false } } });
    return results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(" | ")})`
    );
  };

  it("has no violations on the ready page with suggestions, a plan, costs and a budget", async () => {
    world.prefs = { goal: "points", blockedRanges: [], budget: 40000 };
    world.recs = { savedKey: inputKey(), value: suggestionFor() };
    const { container } = renderPlanner();

    const enter = await waitFor(() => section("Every event they can enter"));
    fireEvent.click(
      await within(enter).findByRole("button", { name: "Add AITA cs5-pune to the plan" })
    );
    await within(cost()).findByText(/Season travel and stay/);
    await within(section("Suggested season")).findAllByText(/Travel and stay/);

    expect(await scan(container)).toEqual([]);
  }, 30_000);

  it("has no violations with the preferences, the figure form and the city form open", async () => {
    const { container } = renderPlanner();
    const enter = await waitFor(() => section("Every event they can enter"));
    fireEvent.click(
      await within(enter).findByRole("button", { name: "Add AITA cs5-pune to the plan" })
    );
    const plan = await waitFor(() => within(section("Their plan")).getByText("AITA cs5-pune"));
    expect(plan).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: /Planning preferences/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add dates" }));
    fireEvent.click(
      await within(section("Their plan")).findByRole("button", { name: /Add or edit my figures/ })
    );
    await screen.findByLabelText("Your city");

    expect(await scan(container)).toEqual([]);
  }, 30_000);

  it("has no violations on the signed-out landing page", async () => {
    const { container } = renderPlanner("anonymous");
    expect(await scan(container)).toEqual([]);
  });

  it("has no violations on the link-a-ranking state", async () => {
    const { container } = renderPlanner();
    fireEvent.click(await screen.findByRole("tab", { name: "Diya" }));
    await screen.findByRole("heading", { name: /Link Diya/ });
    expect(await scan(container)).toEqual([]);
  });
});

// ─── The season calendar ──────────────────────────────────────────────────────

const calendar = (): HTMLElement => section("Season calendar");
/** A bar's name starts with the event's own, which the details' buttons never do. */
const anchored = (name: RegExp | string): RegExp =>
  new RegExp(`^${(name instanceof RegExp ? name.source : name).replace(/^\^/, "")}`);
const bar = (name: RegExp | string) =>
  within(calendar()).getByRole("button", { name: anchored(name) });
const queryBar = (name: RegExp | string) =>
  within(calendar()).queryByRole("button", { name: anchored(name) });

/** Move the calendar to a month, by its chip in the strip. */
const goTo = (month: string) =>
  fireEvent.click(within(calendar()).getByRole("button", { name: new RegExp(`^${month} 2026`) }));

/** On a wide screen the details are the panel's third tab, beside the calendar. */
const detail = () => screen.getByRole("tabpanel", { name: "Event" });

describe("the season calendar", () => {
  beforeEach(wide);
  afterEach(narrow);

  const openCalendar = async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    return calendar();
  };

  it("lays the season out by week, with the weekday names across the top", async () => {
    const el = await openCalendar();

    expect(within(el).getByRole("list", { name: "October 2026, by week" })).toBeTruthy();
    // One month, in weeks of Saturday to Friday: 1 Oct 2026 is a Thursday and 31 Oct a
    // Saturday, so the rows run from 26 Sep to 6 Nov.
    expect(within(el).getAllByRole("listitem", { name: /^Week of / })).toHaveLength(6);
    // The week starts on Saturday, because AITA's events do.
    const headers = within(el)
      .getAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)
      .map((node) => node.textContent);
    expect(headers).toEqual(["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
  });

  it("starts by showing everything the child can enter", async () => {
    await openCalendar();

    expect(bar(/AITA cs7-sonipat.*open to enter/)).toBeTruthy();
    // Opens on this month: the later events are one click away, not on screen.
    expect(queryBar(/AITA ts-jaipur/)).toBeNull();
    goTo("November");
    expect(bar(/AITA ts-jaipur.*open to enter/)).toBeTruthy();
    // A different age group is not theirs to be offered here.
    expect(queryBar(/AITA cs9-mumbai/)).toBeNull();
  });

  it("keeps the other events in view when one is added, and narrows to the plan on request", async () => {
    await openCalendar();
    fireEvent.click(bar(/AITA cs7-sonipat/));
    fireEvent.click(
      await within(detail()).findByRole("button", { name: "Add AITA cs7-sonipat to the plan" })
    );

    await waitFor(() => expect(bar(/AITA cs7-sonipat.*on the plan/)).toBeTruthy());
    // The events they might add next are still there, quietly.
    expect(bar(/AITA cs5-pune.*open to enter/)).toBeTruthy();

    fireEvent.click(
      within(calendar()).getByRole("checkbox", { name: /Show every event they can enter/ })
    );
    expect(queryBar(/AITA cs5-pune/)).toBeNull();
    expect(bar(/AITA cs7-sonipat.*on the plan/)).toBeTruthy();
  });

  it("draws a suggestion differently from an event on the plan, and names it", async () => {
    world.recs = { savedKey: inputKey(), value: suggestionFor() };
    await openCalendar();

    await waitFor(() => expect(bar(/AITA cs7-sonipat.*suggested/)).toBeTruthy());
    goTo("November");
    expect(bar(/AITA ss-delhi.*worth considering/)).toBeTruthy();
  });

  it("says which age groups an event is for, in its details", async () => {
    await openCalendar();
    fireEvent.click(bar(/AITA cs7-sonipat/));

    const panel = await waitFor(() => detail());
    expect(within(panel).getByText("Age groups").nextElementSibling?.textContent).toBe("Under 14");
  });

  it("opens an event's details when it is selected, with the rules and the cost", async () => {
    await openCalendar();
    fireEvent.click(bar(/AITA cs7-sonipat/));

    const dialog = await waitFor(() => detail());
    expect(within(dialog).getByText("Entry rules")).toBeTruthy();
    expect(within(dialog).getByText(/is open to enter at this rank/)).toBeTruthy();
    expect(within(dialog).getByText(/Entries close/)).toBeTruthy();
    // The event had no price until it was opened; opening it asked for one.
    expect(await within(dialog).findByText(/Travel and stay ₹24,500 to ₹49,500/)).toBeTruthy();
  });

  describe("what AITA's own page says", () => {
    const openDetail = async (name: RegExp, month?: string) => {
      await openCalendar();
      if (month) goTo(month);
      fireEvent.click(bar(name));
      return await waitFor(() => detail());
    };

    it("shows the dates and details AITA printed, with where they came from", async () => {
      const dialog = await openDetail(/AITA cs7-sonipat/);

      expect(within(dialog).getByText("From AITA")).toBeTruthy();
      expect(within(dialog).getByText("Entries open")).toBeTruthy();
      expect(within(dialog).getByText("Withdraw by")).toBeTruthy();
      expect(within(dialog).getByText("Draw is fixed")).toBeTruthy();
      expect(within(dialog).getByText("Daily allowance")).toBeTruthy();
      expect(within(dialog).getByText("Clay")).toBeTruthy();
      // Times are as printed, in words, on the withdrawal and the entry deadline.
      expect(within(dialog).getAllByText(/11:59 pm/).length).toBeGreaterThanOrEqual(2);
      expect(within(dialog).getByText(/Read from AITA's page for this event on/)).toBeTruthy();
    });

    it("says so when the figures are AITA's rules and not the event's own page", async () => {
      const ed = EDITIONS.find((e) => e.slug === "cs7-sonipat") as unknown as {
        official: Record<string, unknown>;
      };
      ed.official = official(10, { source: "rules" });
      try {
        const dialog = await openDetail(/AITA cs7-sonipat/);
        expect(
          within(dialog).getByText(/could not be read, so check it before you enter/)
        ).toBeTruthy();
        expect(within(dialog).queryByText(/Read from AITA's page/)).toBeNull();
      } finally {
        ed.official = official(10);
      }
    });

    it("links to the event's page on AITA, where the entry is made", async () => {
      const dialog = await openDetail(/AITA cs7-sonipat/);

      const link = within(dialog).getByRole("link", { name: /on AITA, where entries are made/ });
      expect(link.getAttribute("href")).toBe(
        "https://www.aita.hitcourt.com/tournament-acceptance-factsheet-MjkyMQ=="
      );
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("shows AITA's entry fee as the fee in the cost, and says it is theirs", async () => {
      const dialog = await openDetail(/AITA ss-delhi/, "November");

      expect(within(dialog).getByText(/₹700 singles, ₹900 doubles per pair/)).toBeTruthy();
      expect(await within(dialog).findByText(/includes the ₹700 AITA entry fee/)).toBeTruthy();
    });

    it("states the fine AITA's rules print for the level, and none where they print none", async () => {
      const sonipat = await openDetail(/AITA cs7-sonipat/);
      expect(within(sonipat).getByText(/fined ₹1,770/)).toBeTruthy();
      expect(
        within(sonipat).getByText(/not refunded to a player who does not turn up/)
      ).toBeTruthy();

      // Super Series: the rules print no fine, so none is stated.
      goTo("November");
      fireEvent.click(bar(/AITA ss-delhi/));
      const delhi = await waitFor(() => {
        const panel = detail();
        expect(within(panel).getByRole("heading", { name: "AITA ss-delhi" })).toBeTruthy();
        return panel;
      });
      expect(within(delhi).queryByText(/fined/)).toBeNull();
      expect(within(delhi).getByText(/withdraws the player from every event/)).toBeTruthy();
    });

    it("does not warn about the withdrawal deadline until the event is entered", async () => {
      const dialog = await openDetail(/AITA cs7-sonipat/);
      expect(within(dialog).queryByText(/without it counting as a late withdrawal/)).toBeNull();
    });

    it("warns an entered event's parent about the withdrawal deadline", async () => {
      world.plan = [
        {
          editionSlug: "cs7-sonipat",
          name: "AITA cs7-sonipat",
          startDate: day(10),
          status: "entered",
          addedAt: day(-1),
        },
      ];
      const dialog = await openDetail(/AITA cs7-sonipat/);
      expect(
        within(dialog).getByText(/To withdraw without it counting as a late withdrawal, do it by/)
      ).toBeTruthy();
    });

    it("leaves the section out for an event whose AITA page was never read", async () => {
      const dialog = await openDetail(/AITA ts-jaipur/, "November");
      expect(within(dialog).queryByText("From AITA")).toBeNull();
      expect(within(dialog).queryByRole("link", { name: /on AITA/ })).toBeNull();
    });

    it("has no accessibility violations with the section open", async () => {
      const dialog = await openDetail(/AITA cs7-sonipat/);
      const results = await axe.run(dialog, { rules: { "color-contrast": { enabled: false } } });
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });

  it("closes the details again", async () => {
    await openCalendar();
    fireEvent.click(bar(/AITA cs7-sonipat/));
    await waitFor(() => detail());

    fireEvent.click(within(detail()).getByRole("button", { name: "Close details" }));

    await waitFor(() => expect(screen.queryByRole("tabpanel", { name: "Event" })).toBeNull());
  });

  it("puts an event on the plan from its details, and the bar changes to match", async () => {
    await openCalendar();
    goTo("November");
    fireEvent.click(bar(/AITA ts-jaipur/));
    fireEvent.click(
      await within(detail()).findByRole("button", { name: "Add AITA ts-jaipur to the plan" })
    );

    await waitFor(() => expect(bar(/AITA ts-jaipur.*on the plan, shortlisted/)).toBeTruthy());
    expect(within(section("Their plan")).getByText("AITA ts-jaipur")).toBeTruthy();
  });

  it("moves a planned event along, and takes it off, from its details", async () => {
    await openCalendar();
    goTo("November");
    fireEvent.click(bar(/AITA ts-jaipur/));
    fireEvent.click(await within(detail()).findByRole("button", { name: /Add AITA ts-jaipur/ }));
    await waitFor(() => expect(bar(/AITA ts-jaipur.*on the plan/)).toBeTruthy());

    fireEvent.click(within(detail()).getByRole("button", { name: "Mark entered" }));
    await waitFor(() => expect(bar(/AITA ts-jaipur.*on the plan, entered/)).toBeTruthy());

    fireEvent.click(within(detail()).getByRole("button", { name: "Remove from plan" }));
    // Off the plan it is only on offer again, and the calendar stays on it.
    await waitFor(() => expect(bar(/AITA ts-jaipur.*open to enter/)).toBeTruthy());
  });

  it("marks two overlapping plan events, and says so in each one's details", async () => {
    await openCalendar();
    for (const slug of ["cs7-sonipat", "cs5-pune"]) {
      fireEvent.click(bar(new RegExp(`AITA ${slug}`)));
      fireEvent.click(
        await within(detail()).findByRole("button", { name: `Add AITA ${slug} to the plan` })
      );
      await waitFor(() => expect(bar(new RegExp(`AITA ${slug}.*on the plan`))).toBeTruthy());
    }

    await waitFor(() => {
      expect(bar(/AITA cs7-sonipat.*overlaps another planned event/)).toBeTruthy();
      expect(bar(/AITA cs5-pune.*overlaps another planned event/)).toBeTruthy();
    });
    fireEvent.click(bar(/AITA cs7-sonipat/));
    expect(await within(detail()).findByText(/Overlaps with AITA cs5-pune/)).toBeTruthy();
  });

  it("shades the dates the child cannot play, with the parent's own note", async () => {
    const iso = (offset: number) => new Date(TODAY + offset * DAY).toISOString().slice(0, 10);
    world.prefs = {
      goal: "points",
      blockedRanges: [{ from: iso(3), to: iso(5), label: "Board exams" }],
      budget: null,
    };
    const el = await openCalendar();

    expect(within(el).getAllByText("Board exams").length).toBeGreaterThan(0);
  });

  it("flags the day entries close for an event on the plan", async () => {
    await openCalendar();
    fireEvent.click(bar(/AITA cs7-sonipat/));
    fireEvent.click(await within(detail()).findByRole("button", { name: /Add AITA cs7-sonipat/ }));

    // cs7-sonipat closes in 3 days, and a flag is only drawn for what is being acted on.
    expect(
      await within(calendar()).findByRole("img", { name: "Entries close for AITA cs7-sonipat" })
    ).toBeTruthy();
  });

  it("announces an event that crosses a week once, and keeps its second piece out of the way", async () => {
    // A Thursday to a Tuesday, so it crosses from Friday into the next week's Saturday.
    world.extra = [edition("cs-midweek", 9, { endDate: day(14), name: "AITA midweek event" })];
    await openCalendar();

    const pieces = within(calendar()).getAllByTitle("AITA midweek event");
    expect(pieces).toHaveLength(2);
    expect(pieces[0]!.getAttribute("aria-hidden")).toBeNull();
    expect(pieces[1]!.getAttribute("aria-hidden")).toBe("true");
    expect(pieces[1]!.getAttribute("tabindex")).toBe("-1");
  });

  it("draws a Saturday to Friday event as a single bar", async () => {
    world.extra = [edition("cs-std", 4, { endDate: day(10), name: "AITA standard event" })];
    await openCalendar();

    expect(within(calendar()).getAllByTitle("AITA standard event")).toHaveLength(1);
  });

  it("names an event by its place first, and its level after", async () => {
    await openCalendar();

    const text = bar(/AITA cs7-sonipat/).textContent ?? "";
    expect(text).toContain("Sonipat");
    expect(text).toContain("Championship");
    expect(text.indexOf("Sonipat")).toBeLessThan(text.indexOf("Championship"));
  });

  describe("when a week is busy", () => {
    // Six events in the week of Saturday 10 October, which is more than a week draws.
    const crowd = () => {
      world.extra = Array.from({ length: 6 }, (_, i) =>
        edition(`busy${i}`, 4, {
          endDate: day(10),
          name: `AITA busy${i}`,
          city: `Town ${i}`,
          state: "Haryana",
        })
      );
    };

    it("draws the first few and folds the rest into a count, in place", async () => {
      crowd();
      await openCalendar();
      const drawn = () => within(calendar()).queryAllByTitle(/^AITA busy/).length;

      expect(drawn()).toBeLessThan(6);
      const more = within(calendar()).getByRole("button", { name: /more events? in the week of/ });
      expect((more.textContent ?? "").trim()).toMatch(/^\d+ more events?/);

      fireEvent.click(more);
      expect(drawn()).toBe(6);

      fireEvent.click(within(calendar()).getByRole("button", { name: "Show fewer" }));
      expect(drawn()).toBeLessThan(6);
    });

    it("opens the week of an event chosen from the list, so it is never out of sight", async () => {
      crowd();
      await openCalendar();
      expect(within(calendar()).queryAllByTitle("AITA busy5")).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: "List" }));
      fireEvent.click(
        within(calendar()).getByRole("button", { name: /^AITA busy5.*open to enter/ })
      );
      fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

      expect(within(calendar()).getAllByTitle("AITA busy5").length).toBeGreaterThan(0);
    });

    it("keeps the plan in view however busy the week is", async () => {
      crowd();
      world.plan = [
        {
          editionSlug: "busy5",
          name: "AITA busy5",
          startDate: day(4),
          status: "shortlisted",
          addedAt: day(-1),
        },
      ];
      await openCalendar();

      expect(within(calendar()).getAllByTitle("AITA busy5").length).toBeGreaterThan(0);
    });
  });

  describe("the key", () => {
    const names = () =>
      within(calendar())
        .queryAllByText(
          /^(On the plan|Entered|Suggested|Open to enter|Dates they cannot play|Overlap|Entries close)$/
        )
        .map((node) => node.textContent);

    it("explains only what is on the screen", async () => {
      await openCalendar();
      expect(names()).toContain("Open to enter");
      expect(names()).not.toContain("Entered");
      expect(names()).not.toContain("Suggested");
      expect(names()).not.toContain("Dates they cannot play");
    });

    it("adds the plan and the suggestions once there are some", async () => {
      world.recs = { savedKey: inputKey(), value: suggestionFor() };
      // The suggestion is cs7-sonipat; the entered event is another one in October.
      world.plan = [
        {
          editionSlug: "cs5-pune",
          name: "AITA cs5-pune",
          startDate: day(12),
          status: "entered",
          addedAt: day(-1),
        },
      ];
      await openCalendar();

      await waitFor(() => expect(names()).toContain("Suggested"));
      expect(names()).toContain("Entered");
    });
  });

  it("falls back to the list below for anyone who cannot use the grid", async () => {
    await openCalendar();
    // The same events, in date order, with everything the calendar shows.
    const list = section("Every event they can enter");
    expect(within(list).getByText("AITA cs7-sonipat")).toBeTruthy();
    expect(
      within(list).getAllByText(/Entry deadline not published|Entries close/).length
    ).toBeGreaterThan(0);
  });
});

describe("the calendar's months", () => {
  beforeEach(wide);
  afterEach(narrow);

  const openCalendar = async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    return calendar();
  };
  /** The month drawn, from the name of its list of weeks. */
  const shown = () =>
    within(calendar())
      .getByRole("list", { name: /, by week$/ })
      .getAttribute("aria-label");

  it("opens on this month and says what each month ahead holds", async () => {
    const el = await openCalendar();

    expect(shown()).toBe("October 2026, by week");
    expect(
      within(el).getByRole("button", { name: /^October 2026, \d+ events?$/, pressed: true })
    ).toBeTruthy();
    for (const month of ["November 2026", "December 2026"]) {
      expect(
        within(el).getByRole("button", {
          name: new RegExp(`^${month}, [0-9]+ events?$`),
          pressed: false,
        })
      ).toBeTruthy();
    }
    expect(within(el).getByText(/in October 2026: .* open to enter\./)).toBeTruthy();
  });

  it("moves between months by their tabs", async () => {
    const el = await openCalendar();
    // Nothing before this month is on offer: this is a calendar for what is to come, and
    // the first tab is this month.
    const tabs = within(el).getByRole("group", { name: "Choose a month" });
    expect(within(tabs).getAllByRole("button")[0]!.getAttribute("aria-label")).toMatch(
      /^October 2026/
    );

    goTo("November");
    expect(shown()).toBe("November 2026, by week");
    expect(within(el).getByRole("button", { name: /^November 2026/, pressed: true })).toBeTruthy();
    expect(within(el).getByRole("button", { name: /^October 2026/, pressed: false })).toBeTruthy();

    goTo("October");
    expect(shown()).toBe("October 2026, by week");
  });

  it("is one quiet row: no arrows, no big title, no sentence unless the month is empty", async () => {
    const el = await openCalendar();

    expect(within(el).queryByRole("button", { name: "Next month" })).toBeNull();
    expect(within(el).queryByRole("button", { name: "Previous month" })).toBeNull();
    expect(within(el).queryByRole("button", { name: "This month" })).toBeNull();
    expect(within(el).queryByRole("heading", { level: 3 })).toBeNull();
    // The month is still announced, for people who cannot see the tabs change.
    expect(within(el).getByText(/in October 2026: .* open to enter\./).className).toContain(
      "sr-only"
    );
  });

  it("says plainly that a month has nothing in it yet, and why", async () => {
    const el = await openCalendar();
    goTo("December");

    expect(within(el).getByText(/Nothing on the calendar for December 2026 yet\./)).toBeTruthy();
    expect(within(el).getByText(/publishes about ten weeks ahead/)).toBeTruthy();
  });

  it("puts an event that crosses a month end in both months", async () => {
    // From 30 October to 3 November.
    world.extra = [edition("cs-cross", 24, { endDate: day(28), name: "AITA crossing event" })];
    const el = await openCalendar();

    expect(within(el).getAllByTitle("AITA crossing event").length).toBeGreaterThan(0);
    goTo("November");
    expect(within(el).getAllByTitle("AITA crossing event").length).toBeGreaterThan(0);
  });

  it("moves to the month of an event opened from the next-up tile", async () => {
    world.plan = [
      {
        editionSlug: "ts-jaipur",
        name: "AITA ts-jaipur",
        startDate: day(30),
        status: "shortlisted",
        addedAt: day(-1),
      },
    ];
    const el = await openCalendar();
    expect(shown()).toBe("October 2026, by week");

    const summary = screen.getByLabelText("Season at a glance");
    fireEvent.click(within(summary).getAllByRole("button", { name: "AITA ts-jaipur" })[0]!);

    await waitFor(() => expect(shown()).toBe("November 2026, by week"));
    expect(await screen.findByRole("tab", { name: "Event", selected: true })).toBeTruthy();
    expect(within(el).getAllByTitle("AITA ts-jaipur").length).toBeGreaterThan(0);
  });

  it("keeps the month the parent chose when they add an event", async () => {
    const el = await openCalendar();
    goTo("November");
    fireEvent.click(bar(/AITA ts-jaipur/));
    fireEvent.click(
      await within(detail()).findByRole("button", { name: "Add AITA ts-jaipur to the plan" })
    );

    await waitFor(() => expect(bar(/AITA ts-jaipur.*on the plan/)).toBeTruthy());
    expect(shown()).toBe("November 2026, by week");
    expect(el).toBeTruthy();
  });
});

describe("the side panel", () => {
  beforeEach(wide);
  afterEach(narrow);

  const tab = (name: RegExp | string) => screen.getByRole("tab", { name });

  it("opens on the plan when there is one, and on the suggestions when there is not", async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    expect(tab(/^Suggested/).getAttribute("aria-selected")).toBe("true");
    expect(tab(/^Plan/).getAttribute("aria-selected")).toBe("false");
  });

  it("starts on the plan for a child who already has one", async () => {
    world.plan = [
      {
        editionSlug: "cs7-sonipat",
        name: "AITA cs7-sonipat",
        startDate: day(10),
        status: "shortlisted",
        addedAt: day(-1),
      },
    ];
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    expect(tab(/^Plan \(1\)/).getAttribute("aria-selected")).toBe("true");
  });

  it("gives a selected event its own tab, beside the calendar and not in a dialog", async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    expect(screen.queryByRole("tab", { name: "Event" })).toBeNull();

    fireEvent.click(bar(/AITA cs7-sonipat/));

    expect(await screen.findByRole("tab", { name: "Event", selected: true })).toBeTruthy();
    expect(within(detail()).getByRole("heading", { name: "AITA cs7-sonipat" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the event when another tab is chosen, and when the same event is selected again", async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));

    fireEvent.click(bar(/AITA cs7-sonipat/));
    await screen.findByRole("tab", { name: "Event" });
    fireEvent.mouseDown(tab(/^Plan/), { button: 0 });
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Event" })).toBeNull());
    expect(tab(/^Plan/).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(bar(/AITA cs7-sonipat/));
    await screen.findByRole("tab", { name: "Event" });
    fireEvent.click(bar(/AITA cs7-sonipat/));
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Event" })).toBeNull());
  });

  it("keeps what was open in a tab when the parent comes back to it", async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    fireEvent.click(
      await within(section("Suggested season")).findByRole("button", {
        name: /Planning preferences/,
      })
    );
    expect(
      within(section("Suggested season")).getByRole("radio", { name: /Match experience/ })
    ).toBeTruthy();

    fireEvent.mouseDown(tab(/^Plan/), { button: 0 });
    fireEvent.mouseDown(tab(/^Suggested/), { button: 0 });

    expect(
      within(section("Suggested season")).getByRole("radio", { name: /Match experience/ })
    ).toBeTruthy();
  });

  it("can show the season as a list, with the same events and the same details", async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    fireEvent.click(screen.getByRole("button", { name: "List" }));

    const list = section("Season calendar");
    expect(within(list).queryByRole("list", { name: "Season calendar, by week" })).toBeNull();
    fireEvent.click(within(list).getByRole("button", { name: /^AITA cs7-sonipat.*open to enter/ }));
    expect(await screen.findByRole("tab", { name: "Event" })).toBeTruthy();
  });
});

describe("the season on a phone", () => {
  it("lists the events by month instead of drawing seven narrow columns", async () => {
    renderPlanner();
    const el = await waitFor(() => section("Season calendar"));

    expect(within(el).queryByRole("list", { name: "Season calendar, by week" })).toBeNull();
    expect(
      within(el).getByRole("button", { name: /^AITA cs7-sonipat.*open to enter/ })
    ).toBeTruthy();
    expect(within(el).queryByRole("button", { name: "Calendar" })).toBeNull();
  });

  it("opens an event in a dialog, where the panel has no room beside the list", async () => {
    renderPlanner();
    const el = await waitFor(() => section("Season calendar"));
    fireEvent.click(within(el).getByRole("button", { name: /^AITA cs7-sonipat.*open to enter/ }));

    const dialog = await screen.findByRole("dialog", { name: /AITA/ });
    expect(within(dialog).getByText("Entry rules")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Event" })).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close modal" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /AITA/ })).toBeNull());
  });
});

describe("what to do next", () => {
  const summary = () => screen.getByLabelText("Season at a glance");

  it("says so plainly when nothing is planned, and what is open", async () => {
    renderPlanner();
    await waitFor(() => section("Season calendar"));
    expect(within(summary()).getByText("Nothing planned yet")).toBeTruthy();
    expect(within(summary()).getByText(/event.* open to enter/)).toBeTruthy();
  });

  it("puts the nearest deadline first, with AITA's page to act on it", async () => {
    world.plan = [
      {
        editionSlug: "cs7-sonipat",
        name: "AITA cs7-sonipat",
        startDate: day(10),
        status: "shortlisted",
        addedAt: day(-1),
      },
    ];
    renderPlanner();
    await waitFor(() => section("Season calendar"));

    // cs7-sonipat closes in 3 days; its event is 10 days off.
    expect(within(summary()).getByText(/^Entries close /)).toBeTruthy();
    const link = within(summary()).getByRole("link", { name: /Open AITA cs7-sonipat on AITA/ });
    expect(link.textContent).toMatch(/Enter on AITA/);
    expect(link.getAttribute("href")).toContain("aita.hitcourt.com");
  });

  it("counts the plan by what has been done with each event", async () => {
    world.plan = [
      {
        editionSlug: "cs7-sonipat",
        name: "AITA cs7-sonipat",
        startDate: day(10),
        status: "entered",
        addedAt: day(-3),
      },
      {
        editionSlug: "ts-jaipur",
        name: "AITA ts-jaipur",
        startDate: day(30),
        status: "shortlisted",
        addedAt: day(-2),
      },
    ];
    renderPlanner();
    await waitFor(() => section("Season calendar"));

    const tile = within(summary())
      .getByRole("heading", { name: "The plan" })
      .closest("section") as HTMLElement;
    expect(within(tile).getByText("Still to enter").nextElementSibling?.textContent).toBe("1");
    expect(within(tile).getByText("Entered").nextElementSibling?.textContent).toBe("1");
    expect(within(tile).getByText("Played").nextElementSibling?.textContent).toBe("0");
  });
});

describe("accessibility of the calendar", () => {
  beforeEach(wide);
  afterEach(narrow);

  const scan = async (root: HTMLElement) => {
    const results = await axe.run(root, { rules: { "color-contrast": { enabled: false } } });
    return results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(" | ")})`
    );
  };

  it("has no violations with a plan, suggestions, a clash, blocked dates and the details open", async () => {
    world.recs = { savedKey: inputKey(), value: suggestionFor() };
    world.prefs = {
      goal: "points",
      blockedRanges: [
        {
          from: new Date(TODAY + 2 * DAY).toISOString().slice(0, 10),
          to: new Date(TODAY + 4 * DAY).toISOString().slice(0, 10),
          label: "Exams",
        },
      ],
      budget: null,
    };
    const { container } = renderPlanner();
    await waitFor(() => section("Season calendar"));
    for (const slug of ["cs7-sonipat", "cs5-pune"]) {
      fireEvent.click(
        await within(calendar()).findByRole("button", { name: new RegExp(`AITA ${slug}`) })
      );
      fireEvent.click(
        await within(detail()).findByRole("button", { name: `Add AITA ${slug} to the plan` })
      );
      await waitFor(() => bar(new RegExp(`AITA ${slug}.*on the plan`)));
    }
    fireEvent.click(bar(/AITA cs7-sonipat/));
    await within(detail()).findByText(/Overlaps with/);

    expect(await scan(container)).toEqual([]);
    expect(await scan(detail())).toEqual([]);
  }, 30_000);
});
