/* eslint-disable @typescript-eslint/no-var-requires */
// Unit tests for season cost estimates. No database, no network: the model is a
// fake, so the whole flow runs without spending a call.
//
// The properties worth pinning are the ones that stop a wrong number reaching a
// parent: an absurd range is refused, a figure the parent typed always wins, an
// entry fee is never invented, and two parents asking about the same trip are
// told the same thing from one model call. The rest pin the guarantees around it:
// a failure is refunded, the day's limit holds, and a rough figure never gets
// cached over a real one.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { buildShortlist } = require("@powermysport/shared-types");
const { routeFor, eventDaysOf, nightsFor } = require("../client/services/plannerCosts/routes");
const { roughEstimate, roundTo500 } = require("../client/services/plannerCosts/baseline");
const { validateCostOutput } = require("../client/services/plannerCosts/validate");
const { createCostService, budgetStatus } = require("../client/services/plannerCosts/CostService");
const { DAILY_COST_CALL_CAP } = require("../client/services/plannerCosts/types");

const NOW = new Date("2026-10-05T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const midnight = (offsetDays: number): string =>
  new Date(Date.UTC(2026, 9, 5) + offsetDays * DAY).toISOString();

const CITY = { kind: "city", city: "Pune", label: "Pune" };
const STATE = { kind: "state", state: "Haryana", label: "Haryana" };
const NONE = { kind: "none", label: null };

const event = (over: Record<string, unknown> = {}) => ({
  city: "Chennai",
  state: "Tamil Nadu",
  startDate: midnight(30),
  endDate: midnight(34),
  ...over,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

describe("routes", () => {
  it("gives the same trip the same key, whatever the event is called", () => {
    const a = routeFor(CITY, event({ name: "AITA CS7" }));
    const b = routeFor(CITY, event({ name: "A completely different name" }));
    assert.equal(a.key, b.key);
  });

  it("gives a different trip a different key: another month, length or home", () => {
    const base = routeFor(CITY, event()).key;
    assert.notEqual(
      base,
      routeFor(CITY, event({ startDate: midnight(70), endDate: midnight(74) })).key
    );
    assert.notEqual(base, routeFor(CITY, event({ endDate: midnight(36) })).key);
    assert.notEqual(base, routeFor({ ...CITY, city: "Delhi", label: "Delhi" }, event()).key);
  });

  it("ignores case, accents and punctuation in place names", () => {
    const a = routeFor(CITY, event({ city: "Chennai" }));
    const b = routeFor({ ...CITY, city: "  PUNE " }, event({ city: "chennai." }));
    assert.equal(a.key, b.key);
  });

  it("knows a trip at home from a trip away", () => {
    assert.equal(routeFor(CITY, event({ city: "pune" })).relation, "same-city");
    assert.equal(routeFor(CITY, event()).relation, "unknown");
  });

  it("works out same state and other state from a state-only home", () => {
    assert.equal(
      routeFor(STATE, event({ state: "Haryana", city: "Sonipat" })).relation,
      "same-state"
    );
    assert.equal(routeFor(STATE, event()).relation, "other-state");
  });

  it("has no route without a home, or without a venue", () => {
    assert.equal(routeFor(NONE, event()), null);
    assert.equal(routeFor(CITY, event({ city: null, state: null })), null);
    assert.equal(routeFor(CITY, event({ city: undefined, state: "Goa" })).destinationCity, null);
  });

  it("counts the days an event runs, capped, and the nights away from them", () => {
    assert.equal(eventDaysOf({ startDate: midnight(10), endDate: midnight(14) }), 5);
    assert.equal(eventDaysOf({ startDate: midnight(10) }), 1);
    assert.equal(eventDaysOf({ startDate: midnight(10), endDate: midnight(200) }), 14);
    assert.equal(nightsFor(routeFor(CITY, event())), 5);
    assert.equal(nightsFor(routeFor(CITY, event({ city: "Pune" }))), 0);
  });
});

// ─── The rough table ──────────────────────────────────────────────────────────

describe("the rough estimate", () => {
  it("rounds to the nearest 500, because anything finer would claim more than we know", () => {
    assert.equal(roundTo500(1249), 1000);
    assert.equal(roundTo500(1250), 1500);
    assert.equal(roundTo500(7010), 7000);
  });

  it("prices a trip at home as local travel only", () => {
    const rough = roughEstimate(routeFor(CITY, event({ city: "Pune" })));
    assert.deepEqual(rough.stay, { low: 0, high: 0 });
    assert.ok(rough.travel.high <= 1000);
    assert.equal(rough.source, "rough");
  });

  it("scales the stay by the nights and keeps a low end below the high end", () => {
    const short = roughEstimate(routeFor(STATE, event({ endDate: midnight(31) })));
    const long = roughEstimate(routeFor(STATE, event({ endDate: midnight(36) })));
    assert.ok(long.stay.high > short.stay.high);
    for (const part of [short.travel, short.stay, long.travel, long.stay]) {
      assert.ok(part.low <= part.high);
    }
  });

  it("says what it assumes", () => {
    assert.match(
      roughEstimate(routeFor(CITY, event())).assumptions,
      /one parent.*economy.*budget hotel/
    );
  });
});

// ─── The model's numbers, checked ─────────────────────────────────────────────

describe("validating the model's numbers", () => {
  const away = routeFor(CITY, event()); // 5 days, unknown relation
  const home = routeFor(CITY, event({ city: "Pune" }));
  const requested = (...routes: Array<ReturnType<typeof routeFor>>) =>
    new Map(routes.map((route, i) => [`r${i}`, route]));
  const answer = (...rows: unknown[]) => ({ routes: rows });
  const good = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    travel: { low: 6000, high: 14000 },
    stay: { low: 9000, high: 18000 },
    ...over,
  });

  it("accepts a sensible answer and marks it as the model's", () => {
    const result = validateCostOutput(answer(good("r0")), requested(away));
    const estimate = result.get(away.key);
    assert.equal(estimate.source, "ai");
    assert.deepEqual(estimate.travel, { low: 6000, high: 14000 });
  });

  it("rounds to the nearest 500", () => {
    const result = validateCostOutput(
      answer(good("r0", { travel: { low: 6120, high: 13880 } })),
      requested(away)
    );
    assert.deepEqual(result.get(away.key).travel, { low: 6000, high: 14000 });
  });

  it("refuses a range that runs backwards", () => {
    const result = validateCostOutput(
      answer(good("r0", { travel: { low: 14000, high: 6000 } })),
      requested(away)
    );
    assert.equal(result.has(away.key), false);
  });

  it("refuses a figure no trip of this kind could cost", () => {
    const absurd = validateCostOutput(
      answer(good("r0", { travel: { low: 150000, high: 300000 } })),
      requested(away)
    );
    assert.equal(absurd.has(away.key), false);
  });

  it("refuses a range so wide it says nothing", () => {
    const wide = validateCostOutput(
      answer(good("r0", { travel: { low: 3000, high: 40000 } })),
      requested(away)
    );
    assert.equal(wide.has(away.key), false);
  });

  it("refuses a stay for a trip at home, and a free stay for a trip away", () => {
    assert.equal(validateCostOutput(answer(good("r0")), requested(home)).has(home.key), false);
    assert.equal(
      validateCostOutput(answer(good("r0", { stay: { low: 0, high: 0 } })), requested(away)).has(
        away.key
      ),
      false
    );
  });

  it("accepts a trip at home priced as local travel with no stay", () => {
    const result = validateCostOutput(
      answer({ id: "r0", travel: { low: 200, high: 800 }, stay: { low: 0, high: 0 } }),
      requested(home)
    );
    assert.ok(result.has(home.key));
  });

  it("keeps the good routes when one in the same answer fails", () => {
    const other = routeFor(STATE, event({ state: "Haryana", city: "Sonipat" }));
    const result = validateCostOutput(
      answer(
        good("r0", { travel: { low: 150000, high: 300000 } }),
        good("r1", { travel: { low: 2000, high: 6000 } })
      ),
      requested(away, other)
    );
    assert.equal(result.has(away.key), false);
    assert.equal(result.has(other.key), true);
  });

  it("ignores a route it was never asked about, and a duplicate", () => {
    const result = validateCostOutput(answer(good("r9"), good("r0"), good("r0")), requested(away));
    assert.equal(result.size, 1);
  });

  it("uses our own assumptions line, never words from the model", () => {
    const result = validateCostOutput(
      answer({ ...good("r0"), assumptions: "Take a private jet." }),
      requested(away)
    );
    assert.doesNotMatch(result.get(away.key).assumptions, /jet/);
  });

  it("rejects an answer that is not the agreed shape", () => {
    assert.equal(validateCostOutput({ nope: 1 }, requested(away)), null);
    assert.equal(validateCostOutput("text", requested(away)), null);
    assert.equal(validateCostOutput(answer({ id: "r0", travel: "lots" }), requested(away)), null);
  });
});

// ─── The budget ───────────────────────────────────────────────────────────────

describe("the budget", () => {
  it("is within, may exceed, or over, by where the range sits", () => {
    assert.equal(budgetStatus({ low: 10000, high: 20000 }, 25000), "within");
    assert.equal(budgetStatus({ low: 10000, high: 20000 }, 20000), "within");
    assert.equal(budgetStatus({ low: 10000, high: 20000 }, 15000), "may-exceed");
    assert.equal(budgetStatus({ low: 10000, high: 20000 }, 9000), "over");
  });

  it("says nothing without a ceiling or without a total", () => {
    assert.equal(budgetStatus({ low: 1, high: 2 }, null), "none");
    assert.equal(budgetStatus(null, 5000), "none");
  });
});

// ─── The service ──────────────────────────────────────────────────────────────

type PlanEntry = {
  editionSlug: string;
  name: string;
  startDate: string;
  status: string;
  costs?: { travel?: number; stay?: number; entryFee?: number };
};

const ed = (slug: string, start: number, over: Record<string, unknown> = {}) => ({
  slug,
  name: `Event ${slug}`,
  startDate: midnight(start),
  endDate: midnight(start + 3),
  city: "Chennai",
  state: "Tamil Nadu",
  ageGroups: ["Under-14"],
  ladder: "Championship Series",
  grade: 7,
  kind: "junior-ladder",
  ...over,
});

const overviewOf = (
  editions: ReturnType<typeof ed>[],
  entries: PlanEntry[] = [],
  budget: number | null = null
) => ({
  linkState: "ready",
  dependentId: "d1",
  dependentName: "Aarav",
  sportSlug: "tennis",
  standing: {
    category: "Boys",
    subcategory: "U-14",
    rank: 312,
    totalPoints: 100,
    state: "Haryana",
    asOnDate: new Date("2026-09-07T00:00:00.000Z"),
  },
  annualEntryCap: 25,
  shortlist: buildShortlist(editions, { bracket: "U-14", rank: 312 }),
  plan: {
    dependentId: "d1",
    sportSlug: "tennis",
    entries,
    preferences: { goal: "points", blockedRanges: [], budget },
  },
  editionsConsidered: editions.length,
});

const entry = (slug: string, start: number, over: Partial<PlanEntry> = {}): PlanEntry => ({
  editionSlug: slug,
  name: `Event ${slug}`,
  startDate: midnight(start),
  status: "shortlisted",
  ...over,
});

const goodAnswer = (prompt: string) => {
  // Reads the ids out of the prompt it was sent, like a real model would.
  const ids = [...prompt.matchAll(/"id": "(r\d+)"/g)].map((match) => match[1]);
  return {
    routes: ids.map((id) => ({
      id,
      travel: { low: 6000, high: 14000 },
      stay: { low: 9000, high: 18000 },
    })),
  };
};

function harness(
  overview: ReturnType<typeof overviewOf>,
  options: { origin?: unknown; model?: (prompt: string) => Promise<unknown> } = {}
) {
  const state = {
    calls: 0,
    prompts: [] as string[],
    count: 0,
    overview,
    origin: options.origin ?? CITY,
    cache: new Map<string, unknown>(),
  };
  const model = options.model ?? (async (prompt: string) => goodAnswer(prompt));
  const service = createCostService({
    model: async (_system: string, prompt: string) => {
      state.calls += 1;
      state.prompts.push(prompt);
      return model(prompt);
    },
    store: {
      get: async (key: string) => (state.cache.get(key) as never) ?? null,
      set: async (key: string, value: unknown) => {
        state.cache.set(key, value);
      },
    },
    counter: {
      get: async () => state.count,
      increment: async () => ++state.count,
      decrement: async () => {
        state.count -= 1;
      },
    },
    now: () => NOW,
    loadOverview: async () => state.overview,
    resolveOrigin: async () => state.origin,
  });
  return { state, service };
}

describe("the cost service", () => {
  it("prices a route with the model once, and from the cache after that", async () => {
    const { state, service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]));

    const first = await service.estimate("u1", "d1");
    const second = await service.estimate("u1", "d1");

    assert.equal(state.calls, 1);
    assert.equal(first.events.a.source, "ai");
    assert.equal(second.events.a.source, "ai");
    assert.deepEqual(first.events.a.total, { low: 15000, high: 32000 });
  });

  it("prices two events on the same route with one model call", async () => {
    // Same venue, same length, same month: one trip.
    const { state, service } = harness(
      overviewOf([ed("a", 30), ed("b", 31)], [entry("a", 30), entry("b", 31)])
    );

    await service.estimate("u1", "d1");

    assert.equal(state.calls, 1);
    assert.equal((state.prompts[0]?.match(/"id": "r\d+"/g) ?? []).length, 1);
  });

  it("shares one estimate between two parents asking about the same trip", async () => {
    const { state, service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]));

    await service.estimate("parent-1", "d1");
    const calls = state.calls;
    const count = state.count;
    const second = await service.estimate("parent-2", "d1");

    assert.equal(state.calls, calls);
    assert.equal(state.count, count);
    assert.equal(second.events.a.source, "ai");
  });

  it("falls back to the rough table, labelled, when the model fails", async () => {
    const { state, service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]), {
      model: async () => {
        throw new Error("503 unavailable");
      },
    });

    const result = await service.estimate("u1", "d1");

    assert.equal(result.events.a.source, "rough");
    assert.ok(result.events.a.total);
    // Our failure is not the parent's: the call is handed back.
    assert.equal(state.count, 0);
  });

  it("does not cache a rough figure, so the next ask can reach the model", async () => {
    let fail = true;
    const { state, service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]), {
      model: async (prompt: string) => {
        if (fail) throw new Error("429 quota");
        return goodAnswer(prompt);
      },
    });

    await service.estimate("u1", "d1");
    fail = false;
    const retry = await service.estimate("u1", "d1");

    assert.equal(retry.events.a.source, "ai");
    assert.equal(state.calls, 2);
  });

  it("falls back to rough for a route whose numbers fail the checks", async () => {
    const { service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]), {
      model: async (prompt: string) => ({
        routes: [...prompt.matchAll(/"id": "(r\d+)"/g)].map((match) => ({
          id: match[1],
          travel: { low: 900000, high: 950000 },
          stay: { low: 9000, high: 18000 },
        })),
      }),
    });

    assert.equal((await service.estimate("u1", "d1")).events.a.source, "rough");
  });

  it("stops calling the model at the daily limit, and still prices from rules", async () => {
    const { state, service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]));
    state.count = DAILY_COST_CALL_CAP;

    const result = await service.estimate("u1", "d1");

    assert.equal(state.calls, 0);
    assert.equal(result.events.a.source, "rough");
    assert.equal(state.count, DAILY_COST_CALL_CAP);
  });

  it("lets the parent's own figure replace ours, and says it is theirs", async () => {
    const { service } = harness(
      overviewOf([ed("a", 30)], [entry("a", 30, { costs: { travel: 8000, entryFee: 1500 } })])
    );

    const { events } = await service.estimate("u1", "d1");

    assert.deepEqual(events.a.travel, { low: 8000, high: 8000, basis: "yours" });
    assert.equal(events.a.stay.basis, "estimate");
    assert.equal(events.a.entryFee, 1500);
    assert.deepEqual(events.a.total, { low: 8000 + 9000 + 1500, high: 8000 + 18000 + 1500 });
    assert.equal(events.a.entryFeeMissing, false);
  });

  it("never invents an entry fee", async () => {
    const { service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]));

    const { events } = await service.estimate("u1", "d1");

    assert.equal(events.a.entryFee, null);
    assert.equal(events.a.entryFeeMissing, true);
  });

  it("gives no total when it cannot say where the trip starts, and says why", async () => {
    const { state, service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]), {
      origin: NONE,
    });

    const { events, origin } = await service.estimate("u1", "d1");

    assert.equal(origin.kind, "none");
    assert.equal(events.a.total, null);
    assert.match(events.a.note, /Add your city/);
    assert.equal(state.calls, 0);
  });

  it("gives no total when the event has no venue, and says why", async () => {
    const { service } = harness(
      overviewOf([ed("a", 30, { city: undefined, state: undefined })], [entry("a", 30)])
    );

    const { events } = await service.estimate("u1", "d1");

    assert.equal(events.a.total, null);
    assert.match(events.a.note, /No venue is published/);
  });

  it("still uses a parent's own figures when there is no estimate, but not half a trip", async () => {
    const { service } = harness(
      overviewOf([ed("a", 30)], [entry("a", 30, { costs: { travel: 5000 } })]),
      { origin: NONE }
    );

    const { events } = await service.estimate("u1", "d1");

    assert.equal(events.a.travel.basis, "yours");
    // Travel alone is not the cost of the trip, so there is no total.
    assert.equal(events.a.total, null);
  });

  it("totals the plan, and only the plan, against the budget", async () => {
    const { service } = harness(
      overviewOf([ed("a", 30), ed("suggested", 60)], [entry("a", 30)], 40000)
    );

    const { season, events } = await service.estimate("u1", "d1", ["suggested"]);

    // The suggestion is priced for display but is not part of the season yet.
    assert.ok(events.suggested.total);
    assert.equal(season.events, 1);
    assert.deepEqual(season.total, { low: 15000, high: 32000 });
    assert.equal(season.status, "within");
    assert.equal(season.budget, 40000);
  });

  it("flags a budget the season may exceed, or already does", async () => {
    const plan = [entry("a", 30)];
    const may = harness(overviewOf([ed("a", 30)], plan, 20000));
    const over = harness(overviewOf([ed("a", 30)], plan, 10000));

    assert.equal((await may.service.estimate("u1", "d1")).season.status, "may-exceed");
    assert.equal((await over.service.estimate("u1", "d1")).season.status, "over");
  });

  it("leaves a played event out of the season, and counts missing entry fees", async () => {
    const { service } = harness(
      overviewOf(
        [ed("a", 30), ed("b", 50), ed("old", -20)],
        [
          entry("a", 30),
          entry("b", 50, { costs: { entryFee: 1000 } }),
          entry("old", -20, { status: "played" }),
        ]
      )
    );

    const { season } = await service.estimate("u1", "d1");

    assert.equal(season.events, 2);
    assert.equal(season.missingEntryFees, 1);
  });

  it("ignores events the child's planner does not know", async () => {
    const { state, service } = harness(overviewOf([ed("a", 30)], [entry("a", 30)]));

    const { events } = await service.estimate("u1", "d1", ["not-an-event", "a"]);

    assert.deepEqual(Object.keys(events), ["a"]);
    assert.equal(state.calls, 1);
  });

  it("reports where it started from", async () => {
    const city = harness(overviewOf([ed("a", 30)], [entry("a", 30)]), { origin: CITY });
    const state = harness(overviewOf([ed("a", 30)], [entry("a", 30)]), { origin: STATE });

    assert.equal((await city.service.estimate("u1", "d1")).origin.label, "Pune");
    assert.equal((await state.service.estimate("u1", "d1")).origin.label, "Haryana");
  });
});
