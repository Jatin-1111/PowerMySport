/* eslint-disable @typescript-eslint/no-var-requires */
// Unit tests for the season recommender. No database, no network: the model is a
// fake, so the whole flow runs without spending a call.
//
// What matters here is not that the model is clever but that nothing it says can
// hurt a parent. So most of these tests are about what is REFUSED: an event that
// was never offered, two events on the same weekend, a promise of a place, a
// number that is not in the data. The rest pin the guarantees around it: a
// cached answer is free, a failure is refunded, and the day's limit holds.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { buildShortlist } = require("@powermysport/shared-types");
const { buildContext } = require("../client/services/plannerRecommendations/candidates");
const {
  baselineRecommend,
  orderForGoal,
  pickSchedule,
} = require("../client/services/plannerRecommendations/baseline");
const { validateModelOutput } = require("../client/services/plannerRecommendations/validate");
const {
  createRecommendationService,
} = require("../client/services/plannerRecommendations/RecommendationService");
const { DAILY_AI_CAP } = require("../client/services/plannerRecommendations/types");

const NOW = new Date("2026-10-05T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const midnight = (offsetDays: number): string =>
  new Date(Date.UTC(2026, 9, 5) + offsetDays * DAY).toISOString();

interface EditionOptions {
  len?: number;
  ladder?: string;
  state?: string;
  deadline?: number;
  grade?: number;
}

const edition = (slug: string, startOffset: number, options: EditionOptions = {}) => ({
  slug,
  name: `Event ${slug}`,
  startDate: midnight(startOffset),
  endDate: midnight(startOffset + (options.len ?? 3)),
  city: "Sonipat",
  state: options.state ?? "Haryana",
  ageGroups: ["Under-14"],
  ladder: options.ladder ?? "Championship Series",
  grade: options.grade ?? 7,
  kind: "junior-ladder",
  ...(options.deadline === undefined
    ? {}
    : { registrationDeadlineDate: midnight(options.deadline) }),
});

interface OverviewOptions {
  rank?: number;
  state?: string | null;
  goal?: "points" | "experience" | "home";
  blockedRanges?: Array<{ from: string; to: string }>;
  entries?: Array<{ editionSlug: string; name: string; startDate: string; status: string }>;
  cap?: number | null;
  linkState?: string;
}

const overviewOf = (editions: ReturnType<typeof edition>[], options: OverviewOptions = {}) => {
  const rank = options.rank ?? 312;
  return {
    linkState: options.linkState ?? "ready",
    dependentId: "d1",
    dependentName: "Aarav Khandelwal",
    sportSlug: "tennis",
    standing: {
      category: "Boys",
      subcategory: "U-14",
      rank,
      totalPoints: 100,
      state: options.state === undefined ? "Haryana" : options.state,
      asOnDate: new Date("2026-09-07T00:00:00.000Z"),
    },
    annualEntryCap: options.cap === undefined ? 25 : options.cap,
    shortlist: buildShortlist(editions, { bracket: "U-14", rank }),
    plan: {
      dependentId: "d1",
      sportSlug: "tennis",
      entries: options.entries ?? [],
      preferences: { goal: options.goal ?? "points", blockedRanges: options.blockedRanges ?? [] },
    },
    editionsConsidered: editions.length,
  };
};

const contextOf = (editions: ReturnType<typeof edition>[], options: OverviewOptions = {}) =>
  buildContext(overviewOf(editions, options), NOW);

const slugs = (result: { items: Array<{ slug: string }> }) => result.items.map((i) => i.slug);
const tier = (result: { items: Array<{ slug: string; tier: string }> }, t: string) =>
  result.items.filter((i) => i.tier === t).map((i) => i.slug);

// ─── What the recommender may draw on ─────────────────────────────────────────

describe("candidates", () => {
  it("leaves out what is already planned, already closed, or in blocked dates", () => {
    const context = contextOf(
      [
        edition("open", 10),
        edition("planned", 20),
        edition("closed", 30, { deadline: -2 }),
        edition("blocked", 40),
      ],
      {
        entries: [
          { editionSlug: "planned", name: "P", startDate: midnight(20), status: "shortlisted" },
        ],
        blockedRanges: [{ from: "2026-11-14", to: "2026-11-16" }],
      }
    );

    assert.deepEqual(
      context.candidates.map((c: { slug: string }) => c.slug),
      ["open"]
    );
    assert.deepEqual(context.skipped, { blocked: 1, entriesClosed: 1 });
  });

  it("treats a blocked range that touches an event only at one end as a clash", () => {
    // Event runs 15 to 18 Oct; the range ends on the 15th.
    const context = contextOf([edition("edge", 10)], {
      blockedRanges: [{ from: "2026-10-01", to: "2026-10-15" }],
    });
    assert.equal(context.candidates.length, 0);
  });

  it("keeps a deadline that falls today, because entries are live all that day", () => {
    const context = contextOf([edition("today", 10, { deadline: 0 })]);
    assert.equal(context.candidates.length, 1);
  });

  it("does not propose playing up, only the child's own age group", () => {
    const up = { ...edition("up", 10), ageGroups: ["Under-16"] };
    const context = contextOf([edition("own", 12), up]);
    assert.deepEqual(
      context.candidates.map((c: { slug: string }) => c.slug),
      ["own"]
    );
  });

  it("works out the yearly allowance from everything on the plan this year", () => {
    const entries = [1, 2, 3].map((n) => ({
      editionSlug: `e${n}`,
      name: `E${n}`,
      startDate: midnight(n * 10),
      status: "shortlisted",
    }));
    assert.equal(contextOf([edition("x", 50)], { entries }).allowanceLeft, 22);
    assert.equal(contextOf([edition("x", 50)], { cap: null }).allowanceLeft, null);
  });

  it("falls back from the home goal when no home state is known", () => {
    const context = contextOf([edition("x", 10)], { goal: "home", state: null });
    assert.equal(context.goal, "home");
    assert.equal(context.effectiveGoal, "experience");
  });

  it("only calls an event home when both states are recorded and match", () => {
    const context = contextOf([
      edition("same", 10, { state: "haryana" }),
      edition("other", 20, { state: "Delhi" }),
    ]);
    const home = Object.fromEntries(
      context.candidates.map((c: { slug: string; inHomeState: boolean }) => [c.slug, c.inHomeState])
    );
    assert.deepEqual(home, { same: true, other: false });
  });

  it("has nothing to build for a child with no verdicts", () => {
    assert.equal(buildContext(overviewOf([], { linkState: "not-linked" }), NOW), null);
  });
});

// ─── The rule-based answer ────────────────────────────────────────────────────

describe("the rule-based recommender", () => {
  const mixed = [
    edition("talent", 10, { ladder: "Talent Series" }),
    edition("cs", 20, { ladder: "Championship Series" }),
    edition("super", 30, { ladder: "Super Series", state: "Delhi" }),
  ];

  it("puts the higher rung first when the goal is points", () => {
    const ordered = orderForGoal(contextOf(mixed).candidates, "points");
    assert.deepEqual(
      ordered.map((c: { slug: string }) => c.slug),
      ["super", "cs", "talent"]
    );
  });

  it("puts the entry levels first when the goal is match experience", () => {
    const ordered = orderForGoal(contextOf(mixed).candidates, "experience");
    assert.deepEqual(
      ordered.map((c: { slug: string }) => c.slug),
      ["talent", "cs", "super"]
    );
  });

  it("puts events in the home state first when the goal is staying close", () => {
    const ordered = orderForGoal(contextOf(mixed).candidates, "home");
    assert.equal(ordered[ordered.length - 1].slug, "super");
  });

  it("never recommends two events that overlap or leave under two clear days", () => {
    const context = contextOf([
      edition("a", 10, { len: 4 }),
      edition("overlaps", 12),
      edition("tight", 15), // starts the day after a ends: 14 + 1
      edition("clear", 20),
    ]);
    const result = baselineRecommend(context, NOW);

    assert.deepEqual(tier(result, "recommended"), ["a", "clear"]);
    // The clashing ones stay on offer as alternatives.
    assert.deepEqual(tier(result, "consider").sort(), ["overlaps", "tight"]);
  });

  it("fits around what is already planned", () => {
    const context = contextOf([edition("clash", 10), edition("free", 30)], {
      entries: [{ editionSlug: "mine", name: "Mine", startDate: midnight(10), status: "entered" }],
    });
    const result = baselineRecommend(context, NOW);

    assert.deepEqual(tier(result, "recommended"), ["free"]);
    // An alternative may not sit on top of something already planned.
    assert.ok(!slugs(result).includes("clash"));
  });

  it("never recommends more events than the yearly allowance has left", () => {
    const events = [10, 20, 30, 40, 50].map((n) => edition(`e${n}`, n));
    const context = contextOf(events, { cap: 2 });
    assert.equal(tier(baselineRecommend(context, NOW), "recommended").length, 2);
  });

  it("recommends nothing, and says why, when the allowance is spent", () => {
    const entries = [1, 2].map((n) => ({
      editionSlug: `e${n}`,
      name: `E${n}`,
      startDate: midnight(-n * 10),
      status: "played",
    }));
    const result = baselineRecommend(contextOf([edition("x", 30)], { cap: 2, entries }), NOW);
    assert.equal(tier(result, "recommended").length, 0);
    assert.match(result.notes.join(" "), /allowance/);
  });

  it("explains a short list rather than leaving it a mystery", () => {
    const context = contextOf([edition("ok", 10), edition("blocked", 40)], {
      blockedRanges: [{ from: "2026-11-14", to: "2026-11-16" }],
    });
    assert.match(baselineRecommend(context, NOW).notes.join(" "), /blocked dates/);
  });

  it("writes reasons from AITA's own gloss, with no dashes and no promises", () => {
    const result = baselineRecommend(
      contextOf([edition("super", 10, { ladder: "Super Series" })]),
      NOW
    );
    const reason = result.items[0].reason;
    assert.match(reason, /Super Series: national-level events, harder to get into/);
    assert.doesNotMatch(reason, /[—–]/);
    assert.doesNotMatch(reason, /guarantee|will get in/i);
  });

  it("shows the picks in date order, however they were scored", () => {
    const result = baselineRecommend(
      contextOf([
        edition("early-talent", 10, { ladder: "Talent Series" }),
        edition("late-super", 40, { ladder: "Super Series" }),
      ]),
      NOW
    );
    // Points scores the Super Series first; the season still reads chronologically.
    assert.deepEqual(tier(result, "recommended"), ["early-talent", "late-super"]);
  });

  it("leaves the entry deadline to the card, which already shows it", () => {
    const result = baselineRecommend(contextOf([edition("a", 20, { deadline: 5 })]), NOW);
    assert.doesNotMatch(result.items[0].reason, /Entries close/);
  });

  it("says so plainly when nothing fits", () => {
    const result = baselineRecommend(contextOf([]), NOW);
    assert.equal(result.items.length, 0);
    assert.match(result.summary, /Nothing open fits/);
    assert.equal(result.source, "rules");
  });

  it("splits an ordered list the same way the service will", () => {
    const context = contextOf([edition("a", 10), edition("b", 11)]);
    const { recommended, consider } = pickSchedule(context.candidates, context);
    assert.equal(recommended.length, 1);
    assert.equal(consider.length, 1);
  });
});

// ─── The model's answer, made safe ────────────────────────────────────────────

describe("validating the model's answer", () => {
  const context = contextOf([
    edition("a", 10, { ladder: "Super Series", deadline: 8 }),
    edition("b", 30),
    edition("c", 31),
    edition("d", 60),
  ]);
  const good = (picks: unknown[], summary = "A steady run of events across the weeks ahead.") => ({
    summary,
    picks,
  });
  const pick = (slug: string, reason = "A good fit for this child.", t = "recommended") => ({
    slug,
    tier: t,
    reason,
  });

  it("keeps the picks the rules allowed and marks the answer as the model's", () => {
    const result = validateModelOutput(good([pick("a"), pick("b")]), context, NOW);
    assert.equal(result.source, "ai");
    assert.deepEqual(tier(result, "recommended"), ["a", "b"]);
  });

  it("drops an event that was never offered", () => {
    const result = validateModelOutput(good([pick("a"), pick("invented")]), context, NOW);
    assert.deepEqual(slugs(result), ["a"]);
  });

  it("drops a duplicate, keeping the first", () => {
    const result = validateModelOutput(
      good([pick("a", "First."), pick("a", "Second.")]),
      context,
      NOW
    );
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].reason, "First.");
  });

  it("will not recommend two events that clash, and keeps the second as an option", () => {
    const result = validateModelOutput(good([pick("b"), pick("c")]), context, NOW);
    assert.deepEqual(tier(result, "recommended"), ["b"]);
    assert.deepEqual(tier(result, "consider"), ["c"]);
  });

  it("will not recommend more than the yearly allowance has left", () => {
    const tight = contextOf([edition("a", 10), edition("b", 30), edition("c", 50)], { cap: 2 });
    const result = validateModelOutput(good([pick("a"), pick("b"), pick("c")]), tight, NOW);
    assert.equal(tier(result, "recommended").length, 2);
    assert.deepEqual(tier(result, "consider"), ["c"]);
  });

  it("will not offer an alternative that sits on top of the plan", () => {
    const planned = contextOf([edition("clash", 10), edition("free", 40)], {
      entries: [{ editionSlug: "mine", name: "Mine", startDate: midnight(10), status: "entered" }],
    });
    const result = validateModelOutput(
      good([pick("free"), pick("clash", "x", "consider")]),
      planned,
      NOW
    );
    assert.deepEqual(slugs(result), ["free"]);
  });

  it("replaces a reason that promises a place", () => {
    const result = validateModelOutput(
      good([pick("a", "They will definitely get in and it is guaranteed.")]),
      context,
      NOW
    );
    assert.doesNotMatch(result.items[0].reason, /definitely|guaranteed/i);
    assert.match(result.items[0].reason, /Super Series/);
  });

  it("replaces a reason that names a price", () => {
    for (const reason of [
      "Costs about ₹5,000 to enter.",
      "A cheap option near home.",
      "Budget friendly.",
    ]) {
      const result = validateModelOutput(good([pick("a", reason)]), context, NOW);
      assert.notEqual(result.items[0].reason, reason);
    }
  });

  it("replaces a reason that says one field is stronger or easier", () => {
    const result = validateModelOutput(
      good([pick("a", "An easier draw than most.")]),
      context,
      NOW
    );
    assert.doesNotMatch(result.items[0].reason, /easier/);
  });

  it("replaces a reason containing a number that is not in the data", () => {
    const result = validateModelOutput(
      good([pick("a", "Worth 250 ranking points here.")]),
      context,
      NOW
    );
    assert.doesNotMatch(result.items[0].reason, /250/);
  });

  it("keeps a reason whose numbers are real: its own dates, the rank, the deadline", () => {
    const reason = "Starts 15 Oct and entries close 13 Oct, well inside rank 312 at Under-14.";
    const result = validateModelOutput(good([pick("a", reason)]), context, NOW);
    assert.equal(result.items[0].reason, reason);
  });

  it("keeps a true gap to another event", () => {
    // b starts on day 30 and a on day 10: 20 days apart.
    const result = validateModelOutput(
      good([pick("a"), pick("b", "Falls 20 days after the first, with room to rest.")]),
      context,
      NOW
    );
    assert.match(result.items[1].reason, /20 days/);
  });

  it("holds spelled-out numbers to the same test as digits", () => {
    // x runs 15 to 18 Oct and y starts 21 Oct: two clear days between them.
    const pair = contextOf([edition("x", 10), edition("y", 16)]);
    const real = validateModelOutput(
      good([pick("x"), pick("y", "Starts two days after the first event ends.")]),
      pair,
      NOW
    );
    assert.match(real.items[1].reason, /two days/);

    const invented = validateModelOutput(
      good([pick("x"), pick("y", "Starts twelve days after the first event ends.")]),
      pair,
      NOW
    );
    assert.doesNotMatch(invented.items[1].reason, /twelve/);
  });

  it("does not mistake the pronoun one for a quantity", () => {
    const result = validateModelOutput(
      good([pick("a", "One of the higher rungs open to this child.")]),
      context,
      NOW
    );
    assert.match(result.items[0].reason, /^One of the higher rungs/);
  });

  it("replaces a reason that guesses the child's gender from a name", () => {
    for (const reason of [
      "It suits his game.",
      "She plays well in Haryana.",
      "Gives her a good draw.",
    ]) {
      const result = validateModelOutput(good([pick("a", reason)]), context, NOW);
      assert.notEqual(result.items[0].reason, reason);
    }
  });

  it("turns dashes into commas, because this site does not use them", () => {
    const result = validateModelOutput(
      good([pick("a", "A strong rung — and well timed.")]),
      context,
      NOW
    );
    assert.doesNotMatch(result.items[0].reason, /[—–]/);
  });

  it("replaces a summary that is not grounded", () => {
    const result = validateModelOutput(
      good([pick("a")], "This will earn 900 points for sure."),
      context,
      NOW
    );
    assert.doesNotMatch(result.summary, /900|sure/);
  });

  it("returns events ordered by date within each tier", () => {
    const result = validateModelOutput(good([pick("d"), pick("a")]), context, NOW);
    assert.deepEqual(slugs(result), ["a", "d"]);
  });

  it("rejects an answer that is not the agreed shape", () => {
    assert.equal(validateModelOutput({ nope: true }, context, NOW), null);
    assert.equal(validateModelOutput("text", context, NOW), null);
    assert.equal(validateModelOutput(null, context, NOW), null);
    assert.equal(
      validateModelOutput(good([{ slug: "a", tier: "maybe", reason: "x" }]), context, NOW),
      null
    );
  });

  it("rejects an answer with nothing usable left in it", () => {
    assert.equal(validateModelOutput(good([pick("invented")]), context, NOW), null);
    assert.equal(validateModelOutput(good([]), context, NOW), null);
  });

  it("rejects an answer that recommends nothing while there is room to", () => {
    assert.equal(validateModelOutput(good([pick("a", "x", "consider")]), context, NOW), null);
  });
});

// ─── The service: cache, limit, fallback ──────────────────────────────────────

describe("the recommendation service", () => {
  const events = [edition("a", 10, { ladder: "Super Series" }), edition("b", 30), edition("c", 60)];

  const aiAnswer = {
    summary: "Three events spread across the weeks ahead.",
    picks: ["a", "b", "c"].map((slug) => ({ slug, tier: "recommended", reason: "A good fit." })),
  };

  function harness(overviewOptions: OverviewOptions = {}, modelImpl?: () => Promise<unknown>) {
    const state = {
      calls: 0,
      count: 0,
      stored: new Map<string, unknown>(),
      overview: overviewOf(events, overviewOptions),
    };
    const service = createRecommendationService({
      model: async () => {
        state.calls += 1;
        return modelImpl ? modelImpl() : aiAnswer;
      },
      store: {
        get: async (key: string) => (state.stored.get(key) as never) ?? null,
        set: async (key: string, value: unknown) => {
          state.stored.set(key, value);
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
    });
    return { state, service };
  }

  it("uses the model once, then answers a repeat from the cache for free", async () => {
    const { state, service } = harness();

    const first = await service.generate("u1", "d1");
    const second = await service.generate("u1", "d1");

    assert.equal(first.recommendations.source, "ai");
    assert.equal(second.recommendations.source, "ai");
    assert.equal(state.calls, 1);
    assert.equal(second.usage.used, 1);
  });

  it("asks again, and spends another answer, when the parent forces it", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    const again = await service.generate("u1", "d1", { force: true });

    assert.equal(state.calls, 2);
    assert.equal(again.usage.used, 2);
  });

  it("gives the rule-based answer, and the reason, when the model fails", async () => {
    const { state, service } = harness({}, async () => {
      throw new Error("503 unavailable");
    });

    const result = await service.generate("u1", "d1");

    assert.equal(result.recommendations.source, "rules");
    assert.equal(result.recommendations.fallbackReason, "ai-unavailable");
    assert.ok(result.recommendations.items.length > 0);
    // Our failure is not the parent's: the answer is handed back.
    assert.equal(state.count, 0);
  });

  it("falls back, and refunds, when the model's answer fails validation", async () => {
    const { state, service } = harness({}, async () => ({ picks: "nonsense" }));

    const result = await service.generate("u1", "d1");

    assert.equal(result.recommendations.source, "rules");
    assert.equal(result.recommendations.fallbackReason, "invalid-output");
    assert.equal(state.count, 0);
  });

  it("does not cache a fallback, so the next try can reach the model", async () => {
    let fail = true;
    const { state, service } = harness({}, async () => {
      if (fail) throw new Error("429 quota");
      return aiAnswer;
    });

    await service.generate("u1", "d1");
    fail = false;
    const retry = await service.generate("u1", "d1");

    assert.equal(retry.recommendations.source, "ai");
    assert.equal(state.calls, 2);
  });

  it("stops at the daily limit, still gives an answer, and never calls the model", async () => {
    const { state, service } = harness();
    state.count = DAILY_AI_CAP;

    const result = await service.generate("u1", "d1");

    assert.equal(state.calls, 0);
    assert.equal(result.recommendations.source, "rules");
    assert.equal(result.recommendations.fallbackReason, "daily-limit");
    assert.ok(result.recommendations.items.length > 0);
    // The over-limit attempt is not counted, and the answer is not cached.
    assert.equal(state.count, DAILY_AI_CAP);
    assert.equal(state.stored.size, 0);
  });

  it("allows exactly the daily number of fresh answers", async () => {
    const { state, service } = harness();
    for (let i = 0; i < DAILY_AI_CAP; i += 1) {
      const result = await service.generate("u1", "d1", { force: true });
      assert.equal(result.recommendations.source, "ai");
    }
    const over = await service.generate("u1", "d1", { force: true });

    assert.equal(state.calls, DAILY_AI_CAP);
    assert.equal(over.recommendations.fallbackReason, "daily-limit");
  });

  it("does not call the model when there is nothing to choose from", async () => {
    const { state, service } = harness();
    state.overview = overviewOf([]);

    const result = await service.generate("u1", "d1");

    assert.equal(state.calls, 0);
    assert.equal(state.count, 0);
    assert.equal(result.recommendations.items.length, 0);
  });

  it("refuses, plainly, when no ranking is linked", async () => {
    const { state, service } = harness();
    state.overview = overviewOf(events, { linkState: "not-linked" });

    await assert.rejects(
      () => service.generate("u1", "d1"),
      (error: { statusCode?: number }) => error.statusCode === 409
    );
    const read = await service.get("u1", "d1");
    assert.equal(read.ready, false);
    assert.equal(read.recommendations, null);
  });

  it("reads without spending anything", async () => {
    const { state, service } = harness();
    const before = await service.get("u1", "d1");
    assert.equal(before.recommendations, null);

    await service.generate("u1", "d1");
    const calls = state.calls;
    const after = await service.get("u1", "d1");

    assert.equal(after.recommendations.stale, false);
    assert.equal(state.calls, calls);
  });

  it("marks the answer stale when the plan changes, and hides what is no longer offered", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");

    // The parent adds event "a" to the plan: it is no longer a suggestion.
    state.overview = overviewOf(events, {
      entries: [{ editionSlug: "a", name: "A", startDate: midnight(10), status: "shortlisted" }],
    });
    const read = await service.get("u1", "d1");

    assert.equal(read.recommendations.stale, true);
    assert.ok(!slugs(read.recommendations).includes("a"));
  });

  it("marks the answer stale when a preference changes", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");

    state.overview = overviewOf(events, { goal: "experience" });

    assert.equal((await service.get("u1", "d1")).recommendations.stale, true);
  });

  it("hands the chat a saved answer only while it is current", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");

    assert.ok(await service.peekFresh("u1", state.overview));
    state.overview = overviewOf(events, { goal: "home" });
    assert.equal(await service.peekFresh("u1", state.overview), null);
  });

  it("keeps one parent's answers away from another's", async () => {
    const { service } = harness();
    await service.generate("u1", "d1");
    const other = await service.get("u2", "d1");
    assert.equal(other.recommendations, null);
  });
});

// ─── What the validator had to repair, counted ────────────────────────────────

describe("counting what validation repaired", () => {
  const { inspectModelOutput } = require("../client/services/plannerRecommendations/validate");
  const context = contextOf([
    edition("a", 10, { ladder: "Super Series" }),
    edition("b", 30),
    edition("c", 31),
  ]);
  const pick = (slug: string, reason = "A good fit for this child.", t = "recommended") => ({
    slug,
    tier: t,
    reason,
  });
  const answer = (
    picks: unknown[],
    summary = "A steady run of events across the weeks ahead."
  ) => ({
    summary,
    picks,
  });

  it("reports a clean answer as clean", () => {
    const { stats } = inspectModelOutput(answer([pick("a"), pick("b")]), context, NOW);
    assert.deepEqual(stats, {
      picks: 2,
      dropped: 0,
      demoted: 0,
      reasonsReplaced: 0,
      summaryReplaced: false,
      malformed: false,
    });
  });

  it("counts an invented event and a duplicate as dropped", () => {
    const { stats } = inspectModelOutput(
      answer([pick("a"), pick("made-up"), pick("a")]),
      context,
      NOW
    );
    assert.equal(stats.picks, 3);
    assert.equal(stats.dropped, 2);
  });

  it("counts a clashing recommendation that was moved down", () => {
    const { stats } = inspectModelOutput(answer([pick("b"), pick("c")]), context, NOW);
    assert.equal(stats.demoted, 1);
  });

  it("counts a reason and a summary that failed the checks", () => {
    const { stats } = inspectModelOutput(
      answer([pick("a", "Guaranteed to get in, costs 5000.")], "This will earn 900 points."),
      context,
      NOW
    );
    assert.equal(stats.reasonsReplaced, 1);
    assert.equal(stats.summaryReplaced, true);
  });

  it("flags an answer that is not the agreed shape", () => {
    const { result, stats } = inspectModelOutput({ nope: true }, context, NOW);
    assert.equal(result, null);
    assert.equal(stats.malformed, true);
  });

  it("returns the same answer as validateModelOutput", () => {
    const raw = answer([pick("a"), pick("b")]);
    assert.deepEqual(
      inspectModelOutput(raw, context, NOW).result,
      validateModelOutput(raw, context, NOW)
    );
  });
});
