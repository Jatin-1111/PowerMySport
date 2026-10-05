// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const EDITIONS = [
  edition("cs7-sonipat", 10, { registrationDeadlineDate: day(3) }),
  edition("cs5-pune", 12, { city: "Pune", state: "Maharashtra" }),
  edition("ts-jaipur", 30, {
    ladder: "Talent Series",
    grade: 1,
    city: "Jaipur",
    state: "Rajasthan",
  }),
  edition("ss-delhi", 50, { ladder: "Super Series", city: "Delhi", state: "Delhi" }),
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
};

const planData = (id: string) => ({
  dependentId: id,
  sportSlug: "tennis",
  entries: [...world.plan].sort((a, b) => a.startDate.localeCompare(b.startDate)),
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
    shortlist: buildShortlist(EDITIONS, { bracket: "U-14", rank: 312 }),
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

const costFor = (entry: Entry | undefined) => {
  const yours = entry?.costs ?? {};
  const travel =
    yours.travel !== undefined
      ? { low: yours.travel, high: yours.travel, basis: "yours" }
      : { low: 13000, high: 27000, basis: "estimate" };
  const stay =
    yours.stay !== undefined
      ? { low: yours.stay, high: yours.stay, basis: "yours" }
      : { low: 11500, high: 22500, basis: "estimate" };
  const fee = yours.entryFee ?? null;
  return {
    source: "ai",
    assumptions:
      "A child and one parent, economy rail or bus, 5 nights in a budget hotel with meals.",
    travel,
    stay,
    entryFee: fee,
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
    all.map((slug) => [slug, { slug, ...costFor(world.plan.find((e) => e.editionSlug === slug)) }])
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
      missingEntryFees: upcoming.filter((e) => e.costs?.entryFee === undefined).length,
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
      const found = EDITIONS.find((e) => e.slug === slug)!;
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

const section = (title: string): HTMLElement => {
  const heading = screen.getByRole("heading", { level: 2, name: title });
  return heading.closest("section") as HTMLElement;
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
    const enter = await waitFor(() => section("What they can enter"));

    expect(within(enter).getByText("AITA cs7-sonipat")).toBeTruthy();
    expect(within(enter).queryByText("AITA cs9-mumbai")).toBeNull();
    fireEvent.click(within(enter).getByRole("button", { name: /Events in an older age group/ }));
    expect(within(enter).getByText("AITA cs9-mumbai")).toBeTruthy();
  });

  it("says an entry deadline is not published rather than leaving a gap", async () => {
    renderPlanner();
    const enter = await waitFor(() => section("What they can enter"));

    expect(within(enter).getAllByText(/Entry deadline not published/).length).toBeGreaterThan(0);
  });

  it("flags a deadline that is about to pass, and offers no actions on one that has", async () => {
    renderPlanner();
    const enter = await waitFor(() => section("What they can enter"));

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

  it("prices each suggestion and labels it an estimate that leaves out the entry fee", async () => {
    renderPlanner();
    const el = await suggest();

    await waitFor(() =>
      expect(within(el).getAllByText(/Travel and stay ₹24,500 to ₹49,500/).length).toBe(3)
    );
    expect(within(el).getAllByText(/\(estimate, entry fee not included\)/).length).toBe(3);
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
    const enter = await waitFor(() => section("What they can enter"));
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
    const plan = await withPlanned();

    expect(await within(plan).findByText(/Season travel and stay ₹24,500 to ₹49,500/)).toBeTruthy();
    expect(within(plan).getByText(/Entry fees are not included for 1 event/)).toBeTruthy();
    expect(within(plan).getByText(/Set a season budget in Planning preferences/)).toBeTruthy();
  });

  it("compares the season with the budget", async () => {
    world.prefs = { goal: "points", blockedRanges: [], budget: 40000 };
    const plan = await withPlanned();

    expect(await within(plan).findByText(/could reach ₹49,500 against ₹40,000/)).toBeTruthy();
    expect(within(plan).getByRole("img").getAttribute("aria-label")).toMatch(/budget of ₹40,000/);
  });

  it("takes a figure the parent types, shows it as theirs, and updates the total", async () => {
    const plan = await withPlanned();
    await within(plan).findByText(/Season travel and stay/);

    fireEvent.click(within(plan).getByRole("button", { name: /Add or edit my figures/ }));
    fireEvent.change(within(plan).getByLabelText("Travel"), { target: { value: "8000" } });
    fireEvent.change(within(plan).getByLabelText("Stay and meals"), { target: { value: "9000" } });
    fireEvent.change(within(plan).getByLabelText("Entry fee"), { target: { value: "1500" } });
    fireEvent.click(within(plan).getByRole("button", { name: "Save figures" }));

    await waitFor(() => expect(savedCosts).toEqual([{ travel: 8000, stay: 9000, entryFee: 1500 }]));
    expect(await within(plan).findByText(/Season travel and stay ₹18,500/)).toBeTruthy();
    expect(within(plan).getByText(/your figures, includes your entry fee of ₹1,500/)).toBeTruthy();
    expect(within(plan).queryByText(/Entry fees are not included/)).toBeNull();
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
    const enter = await waitFor(() => section("What they can enter"));
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
    const enter = await waitFor(() => section("What they can enter"));
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
    const enter = await waitFor(() => section("What they can enter"));
    fireEvent.click(
      await within(enter).findByRole("button", { name: "Add AITA cs7-sonipat to the plan" })
    );

    const plan = await waitFor(() => {
      const el = section("Their plan");
      expect(within(el).getByText("AITA cs7-sonipat")).toBeTruthy();
      return el;
    });
    expect(await within(plan).findByText(/Cost estimates are not available just now/)).toBeTruthy();
    // The plan itself is untouched.
    expect(within(plan).getByRole("button", { name: /Mark entered/ })).toBeTruthy();
  });

  it("keeps the rest of the page when the plan fails to load", async () => {
    world.planFails = true;
    renderPlanner();

    // The verdicts come from a different request, so they still show.
    expect((await screen.findAllByText(/Boys U-14, rank 312/)).length).toBeGreaterThan(0);
    expect(
      within(await waitFor(() => section("What they can enter"))).getByText("AITA cs7-sonipat")
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

    const enter = await waitFor(() => section("What they can enter"));
    fireEvent.click(
      await within(enter).findByRole("button", { name: "Add AITA cs5-pune to the plan" })
    );
    await within(section("Their plan")).findByText(/Season travel and stay/);
    await within(section("Suggested season")).findAllByText(/Travel and stay/);

    expect(await scan(container)).toEqual([]);
  });

  it("has no violations with the preferences, the figure form and the city form open", async () => {
    const { container } = renderPlanner();
    const enter = await waitFor(() => section("What they can enter"));
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
  });

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
