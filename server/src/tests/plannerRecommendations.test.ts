/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
// The season recommender. No database, no network: the model is a fake, so the whole flow
// runs without spending a call.
//
// What these pin, in order of importance:
//   1. Code builds the season. It never breaks a hard rule (overlap, rest days, the plan,
//      the yearly allowance), it is the same whatever order the calendar lists events in,
//      and it is the best set, not the first one found.
//   2. An event is only a PICK when past draws say the child would have got in. Anything
//      the draws closed above is shown apart, and anything there is no history for is an
//      option with a plain warning.
//   3. The model only words the season, and nothing it says reaches a parent unchecked.
//   4. The cost of all this is bounded: a cached answer is free, a failure is refunded, a
//      repeat with nothing changed is free, and the day's limit holds.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { buildShortlist } = require("@powermysport/shared-types");
const { buildContext, withCosts } = require("../client/services/plannerRecommendations/candidates");
const {
  baselineRecommend,
  conflictBetween,
} = require("../client/services/plannerRecommendations/baseline");
const { realismOf, reasonFor } = require("../client/services/plannerRecommendations/builder");
const {
  hasWordableItems,
  inspectModelOutput,
  reasonIsGrounded,
  validateModelOutput,
} = require("../client/services/plannerRecommendations/validate");
const {
  createRecommendationService,
} = require("../client/services/plannerRecommendations/RecommendationService");
const {
  SYSTEM_PROMPT,
  buildUserPrompt,
} = require("../client/services/plannerRecommendations/prompt");
const { responseSchemaFor } = require("../client/services/plannerRecommendations/gemini");
const { DAILY_AI_CAP } = require("../client/services/plannerRecommendations/types");

const NOW = new Date("2026-10-05T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const midnight = (offsetDays: number): string =>
  new Date(Date.UTC(2026, 9, 5) + offsetDays * DAY).toISOString();

interface EditionOptions {
  len?: number;
  ladder?: string;
  state?: string;
  city?: string;
  deadline?: number;
  grade?: number;
  surface?: string;
  ageGroups?: string[];
  fee?: number;
}

const edition = (slug: string, startOffset: number, options: EditionOptions = {}) => ({
  slug,
  name: `Event ${slug}`,
  startDate: midnight(startOffset),
  endDate: midnight(startOffset + (options.len ?? 3)),
  city: options.city ?? "Sonipat",
  state: options.state ?? "Haryana",
  ageGroups: options.ageGroups ?? ["Under-14"],
  ladder: options.ladder ?? "Championship Series",
  grade: options.grade ?? 7,
  kind: "junior-ladder",
  ...(options.deadline === undefined
    ? {}
    : { registrationDeadlineDate: midnight(options.deadline) }),
  ...(options.surface || options.fee !== undefined
    ? {
        official: {
          source: "factSheet",
          ...(options.surface ? { surface: options.surface } : {}),
          ...(options.fee !== undefined ? { feeSingles: options.fee } : {}),
        },
      }
    : {}),
});

const verdict = (
  kind: string,
  text = "Past events closed around rank 118. Rank 312 was outside."
) => ({
  kind,
  events: 3,
  mainDraw: kind === "likely" ? 3 : 0,
  qualifying: kind === "qualifying" ? 3 : 0,
  mainCutoffs: [118],
  text,
});

interface OverviewOptions {
  rank?: number | null;
  state?: string | null;
  goal?: "points" | "experience" | "home";
  blockedRanges?: Array<{ from: string; to: string }>;
  entries?: Array<{ editionSlug: string; name: string; startDate: string; status: string }>;
  cap?: number | null;
  linkState?: string;
  budget?: number | null;
  includeOlderGroup?: boolean;
  dismissed?: string[];
  reach?: Record<string, ReturnType<typeof verdict>>;
}

const overviewOf = (editions: any[], options: OverviewOptions = {}) => {
  const rank = options.rank === undefined ? 312 : options.rank;
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
      alsoRanked: [],
      state: options.state === undefined ? "Haryana" : options.state,
      asOnDate: new Date("2026-09-07T00:00:00.000Z"),
    },
    annualEntryCap: options.cap === undefined ? 25 : options.cap,
    shortlist: buildShortlist(editions, { bracket: "U-14", rank }),
    reach: options.reach ?? {},
    plan: {
      dependentId: "d1",
      sportSlug: "tennis",
      entries: options.entries ?? [],
      preferences: {
        goal: options.goal ?? "points",
        blockedRanges: options.blockedRanges ?? [],
        budget: options.budget ?? null,
        includeOlderGroup: options.includeOlderGroup ?? false,
      },
      dismissed: options.dismissed ?? [],
    },
    editionsConsidered: editions.length,
  };
};

const contextOf = (editions: any[], options: OverviewOptions = {}) =>
  buildContext(overviewOf(editions, options), NOW);

const slugsOf = (result: { items: Array<{ slug: string }> }) => result.items.map((i) => i.slug);
const tier = (result: { items: Array<{ slug: string; tier: string }> }, t: string) =>
  result.items.filter((i) => i.tier === t).map((i) => i.slug);

const planned = (slug: string, offset: number, status = "shortlisted") => ({
  editionSlug: slug,
  name: `P ${slug}`,
  startDate: midnight(offset),
  status,
});

// ─── What the recommender may draw on ─────────────────────────────────────────

describe("candidates", () => {
  it("leaves out what is already planned, closed, in blocked dates, or marked not for us", () => {
    const context = contextOf(
      [
        edition("open", 10),
        edition("planned", 20),
        edition("closed", 30, { deadline: -2 }),
        edition("blocked", 40),
        edition("nope", 50),
      ],
      {
        entries: [planned("planned", 20)],
        blockedRanges: [{ from: "2026-11-14", to: "2026-11-16" }],
        dismissed: ["nope"],
      }
    );
    assert.deepEqual(slugsOf({ items: context.candidates }), ["open"]);
    assert.deepEqual(context.skipped, { blocked: 1, entriesClosed: 1, dismissed: 1 });
  });

  it("treats a blocked range that touches an event only at one end as a clash", () => {
    const context = contextOf([edition("edge", 10)], {
      blockedRanges: [{ from: "2026-10-01", to: "2026-10-15" }],
    });
    assert.equal(context.candidates.length, 0);
  });

  it("keeps a deadline that falls today, because entries are live all that day", () => {
    assert.equal(contextOf([edition("today", 10, { deadline: 0 })]).candidates.length, 1);
  });

  it("offers only the child's own age group, unless the parent asks for older events", () => {
    const up = edition("up", 10, { ageGroups: ["Under-16"] });
    const own = contextOf([edition("own", 12), up]);
    assert.deepEqual(slugsOf({ items: own.candidates }), ["own"]);
    assert.deepEqual(own.olderCandidates, []);

    const asked = contextOf([edition("own", 12), up], { includeOlderGroup: true });
    assert.deepEqual(slugsOf({ items: asked.candidates }), ["own"]);
    assert.deepEqual(slugsOf({ items: asked.olderCandidates }), ["up"]);
    assert.equal(asked.olderCandidates[0].older, true);
  });

  it("works out the yearly allowance from everything on the plan this year", () => {
    const entries = [1, 2, 3].map((n) => planned(`e${n}`, n * 10));
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
    const home = Object.fromEntries(context.candidates.map((c: any) => [c.slug, c.inHomeState]));
    assert.deepEqual(home, { same: true, other: false });
  });

  it("carries what the calendar and the fact sheet say about each event", () => {
    const context = contextOf([edition("a", 10, { deadline: 3, surface: "Clay", fee: 600 })]);
    const [a] = context.candidates;
    assert.equal(a.surface, "Clay");
    assert.equal(a.feeSingles, 600);
    assert.equal(a.daysToDeadline, 3);
  });

  it("carries the verdict from past draws, with the words that report it", () => {
    const context = contextOf([edition("a", 10)], {
      reach: { a: verdict("qualifying", "Closed near 118.") },
    });
    assert.equal(context.candidates[0].reach, "qualifying");
    assert.equal(context.candidates[0].reachText, "Closed near 118.");
  });

  it("has nothing to build for a child with no verdicts", () => {
    assert.equal(contextOf([edition("a", 10)], { linkState: "not-linked" }), null);
  });

  it("takes the budget, and fills in costs only where they are known", () => {
    const base = contextOf([edition("a", 10), edition("b", 30)], {
      budget: 60000,
      entries: [planned("p", 50)],
    });
    assert.equal(base.budget, 60000);
    assert.equal(base.candidates[0].cost, undefined);
    const priced = withCosts(base, {
      a: { low: 10000, high: 20000 },
      p: { low: 5000, high: 8000 },
    });
    assert.deepEqual(priced.candidates[0].cost, { low: 10000, high: 20000 });
    assert.equal(priced.candidates[1].cost, undefined);
    assert.deepEqual(priced.committed[0].cost, { low: 5000, high: 8000 });
  });
});

// ─── Which events are realistic ───────────────────────────────────────────────

describe("which events are realistic for the child", () => {
  const of = (ladder: string | undefined, reach?: string) =>
    realismOf({ ladder, ...(reach ? { reach } : {}) });

  it("trusts what past draws showed over what the level's name suggests", () => {
    assert.equal(of("National Series", "likely"), "realistic");
    assert.equal(of("National Series", "qualifying"), "qualifying");
    assert.equal(of("Championship Series", "unlikely"), "reach");
  });

  it("takes Championship Series and below as realistic when there is no history", () => {
    assert.equal(of("Championship Series"), "realistic");
    assert.equal(of("Talent Series", "no-evidence"), "realistic");
    assert.equal(of(undefined), "realistic");
  });

  it("calls a level cut by ranking uncertain, not unrealistic, when there is no history", () => {
    assert.equal(of("Super Series"), "uncertain");
    assert.equal(of("National Series", "no-evidence"), "uncertain");
    assert.equal(of("Nationals"), "uncertain");
  });
});

// ─── The season, by code ──────────────────────────────────────────────────────

describe("building the season", () => {
  const build = (editions: any[], options: OverviewOptions = {}) =>
    baselineRecommend(contextOf(editions, options), NOW);

  it("puts the higher level first when the goal is points", () => {
    const result = build(
      [
        edition("cs", 10, { ladder: "Championship Series" }),
        edition("ns", 30, { ladder: "National Series" }),
      ],
      { cap: 1, reach: { ns: verdict("likely") } }
    );
    assert.deepEqual(tier(result, "recommended"), ["ns"]);
  });

  it("puts the entry levels first when the goal is match experience", () => {
    const result = build(
      [
        edition("ns", 10, { ladder: "National Series" }),
        edition("cs", 30, { ladder: "Championship Series" }),
      ],
      { cap: 1, goal: "experience", reach: { ns: verdict("likely") } }
    );
    assert.deepEqual(tier(result, "recommended"), ["cs"]);
  });

  it("puts events in the home state first when the goal is staying close", () => {
    const result = build(
      [edition("far", 10, { state: "Delhi" }), edition("near", 30, { state: "Haryana" })],
      { cap: 1, goal: "home" }
    );
    assert.deepEqual(tier(result, "recommended"), ["near"]);
  });

  it("never recommends two events that overlap or leave under two clear days", () => {
    const result = build([
      edition("a", 10, { len: 3 }),
      edition("overlap", 12),
      edition("tight", 14), // one clear day after a ends on the 13th
      edition("fine", 17),
    ]);
    const picked = tier(result, "recommended");
    for (const x of picked) {
      for (const y of picked) {
        if (x < y) {
          const ex = edition(x, x === "a" ? 10 : x === "fine" ? 17 : 12);
          const ey = edition(y, y === "a" ? 10 : y === "fine" ? 17 : 12);
          assert.equal(conflictBetween(ex, ey), null);
        }
      }
    }
    assert.ok(picked.includes("a") && picked.includes("fine"));
    assert.ok(!picked.includes("overlap") && !picked.includes("tight"));
  });

  it("fits around what is already planned", () => {
    const result = build(
      [edition("p", 10), edition("clash", 10), edition("near", 14), edition("free", 40)],
      { entries: [planned("p", 10)] }
    );
    // On top of the plan: nothing. Just too near it: an option, not a pick. Clear: a pick.
    assert.deepEqual(tier(result, "recommended"), ["free"]);
    assert.ok(!slugsOf(result).includes("clash"));
  });

  it("never recommends more events than the yearly allowance has left", () => {
    const events = [10, 20, 30, 40, 50].map((n) => edition(`e${n}`, n));
    assert.equal(tier(build(events, { cap: 2 }), "recommended").length, 2);
  });

  it("recommends nothing, offers nothing, and says why, when the allowance is spent", () => {
    const entries = [1, 2].map((n) => planned(`e${n}`, -n * 10, "played"));
    const result = build([edition("x", 30), edition("y", 60)], { cap: 2, entries });
    assert.equal(result.items.length, 0);
    assert.match(result.notes.join(" "), /allowance/);
  });

  it("chooses the best set, not the first events it comes to", () => {
    // One long event covers the weeks two short ones sit in. Taken first, the long one
    // blocks both, and two events are worth more than one.
    const result = build(
      [
        edition("long", 10, { len: 20, ladder: "Super Series" }),
        edition("early", 12, { len: 2 }),
        edition("late", 20, { len: 2 }),
      ],
      { goal: "experience", reach: { long: verdict("likely") } }
    );
    assert.deepEqual(tier(result, "recommended").sort(), ["early", "late"]);
  });

  it("gives the same season whatever order the calendar lists events in", () => {
    const events = [10, 17, 24, 31, 38, 45, 52].map((n) =>
      edition(`e${n}`, n, { state: n % 2 ? "Delhi" : "Haryana" })
    );
    const forward = build(events, { goal: "home" });
    const backward = build([...events].reverse(), { goal: "home" });
    assert.deepEqual(forward.items, backward.items);
    assert.equal(forward.summary, backward.summary);
  });

  it("prefers a week between events to the bare minimum, when it costs nothing", () => {
    // Same score each: 'a' then either a close one or a spaced one. Spaced wins.
    const result = build([edition("a", 10), edition("close", 16), edition("spaced", 24)], {
      cap: 2,
    });
    assert.deepEqual(tier(result, "recommended"), ["a", "spaced"]);
  });

  it("prefers a change of surface to the same surface twice running", () => {
    const result = build(
      [
        edition("a", 10, { surface: "Clay" }),
        edition("clay", 30, { surface: "Clay" }),
        edition("hard", 30, { surface: "Hard" }),
      ],
      { cap: 2 }
    );
    assert.deepEqual(tier(result, "recommended"), ["a", "hard"]);
  });

  it("shows the picks in date order, however they were scored", () => {
    const result = build(
      [
        edition("late", 60),
        edition("early", 10),
        edition("mid", 35, { ladder: "National Series" }),
      ],
      { reach: { mid: verdict("likely") } }
    );
    const dates = result.items
      .filter((item: any) => item.tier === "recommended")
      .map((item: any) => item.slug);
    assert.deepEqual(dates, ["early", "mid", "late"]);
  });
});

describe("the options and the stretch", () => {
  const build = (editions: any[], options: OverviewOptions = {}) =>
    baselineRecommend(contextOf(editions, options), NOW);

  it("keeps what is left over as options, most useful first, at most four", () => {
    const events = [10, 20, 30, 40, 50, 60, 70, 80].map((n) => edition(`e${n}`, n));
    const result = build(events, { cap: 2 });
    assert.equal(tier(result, "recommended").length, 2);
    assert.equal(tier(result, "consider").length, 4);
  });

  it("shows an event whose past draws closed above the rank apart, never as a pick", () => {
    const result = build([edition("ok", 10), edition("far", 40, { ladder: "National Series" })], {
      reach: { far: verdict("unlikely") },
    });
    assert.deepEqual(tier(result, "recommended"), ["ok"]);
    assert.deepEqual(tier(result, "reach"), ["far"]);
    assert.deepEqual(tier(result, "consider"), []);
  });

  it("explains a stretch with what past draws showed", () => {
    const result = build([edition("far", 40, { ladder: "National Series" })], {
      reach: {
        far: verdict("unlikely", "The main draw closed around rank 118 in the last 3 events."),
      },
    });
    assert.match(result.items[0].reason, /closed around rank 118/);
  });

  it("keeps a qualifying-only event as an option with the evidence, not as a pick", () => {
    const result = build([edition("q", 10, { ladder: "National Series" })], {
      reach: { q: verdict("qualifying", "This rank would mostly have meant the qualifying.") },
    });
    assert.deepEqual(tier(result, "recommended"), []);
    assert.deepEqual(tier(result, "consider"), ["q"]);
    assert.match(result.items[0].reason, /qualifying/);
  });

  it("keeps a level with no history as a cautious option that says what is not known", () => {
    const result = build([edition("ss", 10, { ladder: "Super Series" })]);
    assert.deepEqual(tier(result, "recommended"), []);
    assert.deepEqual(tier(result, "consider"), ["ss"]);
    assert.match(result.items[0].reason, /cut by ranking and we hold no past draws/);
  });

  it("shows at most three stretch events, the highest level first", () => {
    const events = [10, 30, 50, 70, 90].map((n, i) =>
      edition(`r${i}`, n, { ladder: i % 2 ? "National Series" : "Super Series" })
    );
    const reach = Object.fromEntries(events.map((e) => [e.slug, verdict("unlikely")]));
    const result = build(events, { reach });
    assert.equal(tier(result, "reach").length, 3);
  });

  it("leaves out an event that sits on top of the plan, from every tier", () => {
    const result = build([edition("clash", 10, { ladder: "National Series" })], {
      entries: [planned("p", 10)],
      reach: { clash: verdict("unlikely") },
    });
    assert.equal(result.items.length, 0);
  });

  it("offers older-group events only as options, and only when asked for", () => {
    const up = edition("up", 12, { ageGroups: ["Under-16"] });
    assert.ok(!slugsOf(build([edition("own", 40), up])).includes("up"));
    const asked = build([edition("own", 40), up], { includeOlderGroup: true });
    assert.deepEqual(tier(asked, "consider"), ["up"]);
    assert.match(asked.items.find((i: any) => i.slug === "up").reason, /older age group/);
  });

  it("flags an event whose entries close within a week, and not one already closed", () => {
    const result = build([
      edition("soon", 10, { deadline: 3 }),
      edition("later", 30, { deadline: 20 }),
      edition("none", 50),
    ]);
    const urgent = result.items.filter((i: any) => i.urgent).map((i: any) => i.slug);
    assert.deepEqual(urgent, ["soon"]);
  });

  it("says when the deadline is close, in the reason, and the surface otherwise", () => {
    const result = build([
      edition("soon", 10, { deadline: 3, surface: "Clay" }),
      edition("clay", 30, { surface: "Clay" }),
    ]);
    assert.match(result.items.find((i: any) => i.slug === "soon").reason, /Entries close 8 Oct/);
    assert.match(result.items.find((i: any) => i.slug === "clay").reason, /Clay courts/);
  });

  it("writes every reason so that it passes the checks a model's must", () => {
    const events = [
      edition("a", 10, { deadline: 3, surface: "Clay" }),
      edition("b", 30, { ladder: "National Series" }),
      edition("c", 50, { ladder: "Super Series" }),
      edition("d", 70, { ladder: "National Series" }),
    ];
    const context = contextOf(events, {
      goal: "home",
      reach: { b: verdict("likely"), d: verdict("unlikely") },
    });
    const result = baselineRecommend(context, NOW);
    for (const item of result.items) {
      const candidate = context.candidates.find((c: any) => c.slug === item.slug);
      assert.ok(reasonIsGrounded(item.reason, candidate, context), `${item.slug}: ${item.reason}`);
      assert.doesNotMatch(item.reason, /[—–]/);
    }
  });
});

describe("keeping within the budget", () => {
  const build = (
    editions: any[],
    costs: Record<string, { low: number; high: number }>,
    options: OverviewOptions
  ) => baselineRecommend(withCosts(contextOf(editions, options), costs), NOW);
  const events = [edition("a", 10), edition("b", 30), edition("c", 50)];

  it("keeps the picks within the budget where that can be done, and says what it left out", () => {
    const result = build(
      events,
      {
        a: { low: 10000, high: 20000 },
        b: { low: 10000, high: 20000 },
        c: { low: 10000, high: 20000 },
      },
      { budget: 45000, goal: "experience" }
    );
    assert.equal(tier(result, "recommended").length, 2);
    assert.match(
      result.notes.join(" "),
      /1 event was left out of the picks to keep within your ₹45,000 budget/
    );
  });

  it("says the picks fit when they do", () => {
    const result = build(
      events,
      { a: { low: 1, high: 5000 }, b: { low: 1, high: 5000 }, c: { low: 1, high: 5000 } },
      {
        budget: 60000,
      }
    );
    assert.equal(tier(result, "recommended").length, 3);
    assert.match(result.notes.join(" "), /within your ₹60,000 budget/);
  });

  it("takes what is already planned out of the budget first", () => {
    const result = build(
      [edition("a", 10), edition("b", 30)],
      { a: { low: 1, high: 20000 }, b: { low: 1, high: 20000 }, p: { low: 1, high: 30000 } },
      { budget: 55000, entries: [planned("p", 60)], goal: "experience" }
    );
    // 55,000 less the plan's 30,000 leaves room for one of the two, not both.
    assert.equal(tier(result, "recommended").length, 1);
  });

  it("still shows the best season, and says so, when nothing fits the budget", () => {
    const result = build(
      events,
      { a: { low: 1, high: 90000 }, b: { low: 1, high: 90000 }, c: { low: 1, high: 90000 } },
      {
        budget: 10000,
      }
    );
    assert.ok(tier(result, "recommended").length > 0);
    assert.match(result.notes.join(" "), /over your ₹10,000 budget/);
  });

  it("does not claim the budget was used when no cost could be estimated", () => {
    const result = build(events, {}, { budget: 60000 });
    assert.equal(tier(result, "recommended").length, 3);
    assert.match(result.notes.join(" "), /budget was not used to choose them/);
  });

  it("makes no remark about a budget the parent never set", () => {
    const result = build(events, { a: { low: 1, high: 5 } }, {});
    assert.doesNotMatch(result.notes.join(" "), /budget/);
  });

  it("ranks by estimated cost for the home goal, within the same state", () => {
    const result = build(
      [edition("dear", 10), edition("cheap", 30)],
      { dear: { low: 1, high: 60000 }, cheap: { low: 1, high: 10000 } },
      { goal: "home", cap: 1 }
    );
    assert.deepEqual(tier(result, "recommended"), ["cheap"]);
  });
});

describe("saying it in words", () => {
  it("explains a short list rather than leaving it a mystery", () => {
    const context = contextOf([edition("ok", 10), edition("blocked", 40)], {
      blockedRanges: [{ from: "2026-11-14", to: "2026-11-16" }],
    });
    const result = baselineRecommend(context, NOW);
    assert.match(result.notes.join(" "), /1 event fall inside your blocked dates/);
  });

  it("says how many events were marked not for us", () => {
    const result = baselineRecommend(
      contextOf([edition("ok", 10), edition("no", 40)], { dismissed: ["no"] }),
      NOW
    );
    assert.match(result.notes.join(" "), /1 event you marked as not for you is left out/);
  });

  it("says so plainly when nothing fits", () => {
    const result = baselineRecommend(
      contextOf([edition("x", 10)], { entries: [planned("p", 10)] }),
      NOW
    );
    assert.match(result.summary, /Nothing open fits/);
  });

  it("mentions the stretch events in the summary", () => {
    const result = baselineRecommend(
      contextOf([edition("a", 10), edition("far", 40, { ladder: "National Series" })], {
        reach: { far: verdict("unlikely") },
      }),
      NOW
    );
    assert.match(result.summary, /1 higher-level event is shown apart as a stretch/);
  });

  it("writes reasons from AITA's own gloss, with no dashes and no promises", () => {
    const context = contextOf([edition("a", 10, { ladder: "Super Series" })]);
    const reason = reasonFor(context.candidates[0], "points", context);
    assert.match(reason, /Super Series: national-level events/);
    assert.doesNotMatch(reason, /[—–]|guarantee|will get in/i);
  });
});

// ─── What the model may and may not do ────────────────────────────────────────

describe("validating the model's wording", () => {
  const context = contextOf(
    [
      edition("a", 10, { ladder: "National Series", deadline: 8 }),
      edition("b", 30),
      edition("c", 31),
      edition("d", 60),
    ],
    { reach: { a: verdict("likely") } }
  );
  const good = (picks: unknown[], summary = "A steady run of events across the weeks ahead.") => ({
    summary,
    picks,
  });
  const say = (slug: string, reason = "Open to enter in Sonipat, Haryana.") => ({ slug, reason });
  const season = baselineRecommend(context, NOW);
  const recommended = tier(season, "recommended");

  it("keeps the sentences the checks allow and marks the answer as the model's", () => {
    const result = validateModelOutput(
      good(recommended.map((slug: string) => say(slug, "Championship Series in Sonipat."))),
      context,
      NOW
    );
    assert.equal(result.source, "ai");
    const worded = result.items.filter((i: any) => i.tier === "recommended");
    assert.ok(worded.length > 0);
    assert.ok(worded.every((i: any) => /in Sonipat/.test(i.reason)));
  });

  it("changes none of the season: the events, the tiers and the order are the code's", () => {
    const result = validateModelOutput(
      good([
        say("d", "Championship Series in Sonipat."),
        say("a", "National Series in Sonipat."),
        ...recommended.map((slug: string) => say(slug)),
      ]),
      context,
      NOW
    );
    assert.deepEqual(
      result.items.map((i: any) => [i.slug, i.tier]),
      season.items.map((i: any) => [i.slug, i.tier])
    );
  });

  it("ignores a sentence for an event that is not in the season", () => {
    const { stats } = inspectModelOutput(
      good([...recommended.map((slug: string) => say(slug)), say("ghost")]),
      context,
      NOW
    );
    assert.equal(stats.dropped, 1);
  });

  it("ignores a second sentence for the same event, keeping the first", () => {
    const first = recommended[0]!;
    const { result, stats } = inspectModelOutput(
      good([
        say(first, "First, in Sonipat."),
        say(first, "Second, in Sonipat."),
        ...recommended.slice(1).map((s: string) => say(s)),
      ]),
      context,
      NOW
    );
    assert.equal(stats.dropped, 1);
    assert.match(result.items.find((i: any) => i.slug === first).reason, /First/);
  });

  it("uses the code's own sentence for an event the model said nothing about", () => {
    const { result, stats } = inspectModelOutput(good([say(recommended[0]!)]), context, NOW);
    assert.equal(stats.reasonsMissing, season.items.length - 1);
    const other = result.items.find((i: any) => i.slug === recommended[1]!);
    assert.equal(other.reason, season.items.find((i: any) => i.slug === recommended[1]!).reason);
  });

  const replaced = (reason: string) => {
    const { result } = inspectModelOutput(
      good([say(recommended[0]!, reason), ...recommended.slice(1).map((s: string) => say(s))]),
      context,
      NOW
    );
    return result.items.find((i: any) => i.slug === recommended[0]!).reason;
  };
  const code = season.items.find((i: any) => i.slug === recommended[0]!).reason;

  it("replaces a sentence that promises a place", () => {
    assert.equal(replaced("You will get in, guaranteed."), code);
  });
  it("replaces a sentence that names a price", () => {
    assert.equal(replaced("A cheap trip at ₹5,000."), code);
  });
  it("replaces a sentence that says one field is stronger or easier", () => {
    assert.equal(replaced("A weaker field than the others."), code);
  });
  it("replaces a sentence containing a number that is not in the data", () => {
    assert.equal(replaced("Play 99 matches here."), code);
  });
  it("holds spelled-out numbers to the same test as digits", () => {
    assert.equal(replaced("Nine matches in one week."), code);
  });
  it("does not mistake the pronoun one for a quantity", () => {
    assert.notEqual(replaced("One of the Championship Series events in Sonipat."), code);
  });
  it("replaces a sentence that guesses the child's gender", () => {
    assert.equal(replaced("He will enjoy the courts."), code);
  });
  it("turns dashes into commas, because this site does not use them", () => {
    assert.doesNotMatch(replaced("Championship Series — in Sonipat."), /[—–]/);
  });

  it("never lets the model word a stretch or a cautious option, which report what is known", () => {
    const withStretch = contextOf(
      [
        edition("ok", 10),
        edition("far", 40, { ladder: "National Series" }),
        edition("ss", 70, { ladder: "Super Series" }),
      ],
      { reach: { far: verdict("unlikely") } }
    );
    const built = baselineRecommend(withStretch, NOW);
    const { result } = inspectModelOutput(
      good([
        say("ok"),
        say("far", "A great opportunity in Sonipat."),
        say("ss", "A great event in Sonipat."),
      ]),
      withStretch,
      NOW
    );
    for (const slug of ["far", "ss"]) {
      assert.equal(
        result.items.find((i: any) => i.slug === slug).reason,
        built.items.find((i: any) => i.slug === slug).reason
      );
    }
  });

  it("counts a sentence that failed, and one that failed only on a name", () => {
    const multi = contextOf([
      edition("jaipur", 10, { city: "Jaipur", state: "Rajasthan" }),
      edition("pune", 30, { city: "Pune", state: "Maharashtra" }),
    ]);
    const { stats } = inspectModelOutput(
      good([say("jaipur", "Close to home in Pune."), say("pune", "Entries close in 99 days.")]),
      multi,
      NOW
    );
    assert.equal(stats.reasonsReplaced, 2);
    assert.equal(stats.foreignNames, 1);
  });

  it("replaces a summary that is not grounded, or names a place nowhere in the data", () => {
    const ungrounded = validateModelOutput(
      good(
        recommended.map((s: string) => say(s)),
        "Fourteen events in Goa."
      ),
      context,
      NOW
    );
    assert.doesNotMatch(ungrounded.summary, /Goa|Fourteen/);
    const own = "Events in Sonipat across the weeks ahead.";
    assert.equal(
      validateModelOutput(
        good(
          recommended.map((s: string) => say(s)),
          own
        ),
        context,
        NOW
      ).summary,
      own
    );
  });

  it("rejects an answer that is not the agreed shape", () => {
    assert.equal(validateModelOutput({ nonsense: true }, context, NOW), null);
    assert.equal(validateModelOutput("text", context, NOW), null);
    assert.equal(inspectModelOutput({ nonsense: true }, context, NOW).stats.malformed, true);
  });

  it("rejects an answer in which nothing usable was said", () => {
    assert.equal(validateModelOutput(good([]), context, NOW), null);
    assert.equal(validateModelOutput(good([say("ghost")]), context, NOW), null);
  });

  it("knows when there is nothing for a model to say", () => {
    const onlyStretch = contextOf([edition("far", 40, { ladder: "National Series" })], {
      reach: { far: verdict("unlikely") },
    });
    const items = baselineRecommend(onlyStretch, NOW).items;
    assert.equal(hasWordableItems(items, onlyStretch), false);
    assert.equal(hasWordableItems(season.items, context), true);
  });
});

describe("names in a sentence", () => {
  const at = (
    slug: string,
    offset: number,
    city: string,
    state: string,
    ladder = "Championship Series"
  ) => ({
    ...edition(slug, offset, { ladder, state }),
    city,
    name: `AITA ${slug} (${city})`,
  });
  const context = contextOf(
    [
      at("jaipur", 10, "Jaipur", "Rajasthan"),
      at("pune", 30, "Pune", "Maharashtra", "National Series"),
      at("delhi", 60, "New Delhi", "Delhi"),
    ],
    { state: "Haryana", reach: { pune: verdict("likely") } }
  );
  const ask = (slug: string, reason: string, ctx = context) => {
    const wordable = baselineRecommend(ctx, NOW).items.filter((i: any) => i.tier === "recommended");
    const result = validateModelOutput(
      {
        summary: "A steady run of events across the weeks ahead.",
        picks: wordable.map((i: any) => ({
          slug: i.slug,
          reason: i.slug === slug ? reason : "Open in Sonipat.",
        })),
      },
      ctx,
      NOW
    );
    return result.items.find((i: any) => i.slug === slug).reason;
  };

  it("keeps a sentence that names its own city, state and level", () => {
    const reason = "National Series in Pune, Maharashtra.";
    assert.equal(ask("pune", reason), reason);
  });
  it("keeps the child's own state, which is what 'close to home' refers to", () => {
    const reason = "Outside Haryana, but a National Series.";
    assert.equal(ask("pune", reason), reason);
  });
  it("replaces a sentence that puts the event in another event's city", () => {
    const result = ask("jaipur", "Close to home in Delhi.");
    assert.doesNotMatch(result, /Delhi/);
  });
  it("replaces a sentence that names a state it is not in", () => {
    assert.notEqual(
      ask("jaipur", "A Championship Series in Gujarat."),
      "A Championship Series in Gujarat."
    );
  });
  it("replaces a sentence that names a level the event is not", () => {
    assert.notEqual(
      ask("jaipur", "A Super Series event in Jaipur."),
      "A Super Series event in Jaipur."
    );
  });
  it("does not mistake a city for its state, or the reverse", () => {
    assert.equal(ask("delhi", "In New Delhi, Delhi."), "In New Delhi, Delhi.");
    assert.notEqual(
      ask("jaipur", "A Championship Series near Delhi."),
      "A Championship Series near Delhi."
    );
  });
  it("allows 'above Championship Series' as the comparison the prompt asks for", () => {
    const reason = "National Series is above Championship Series, so a place is earned.";
    assert.equal(ask("pune", reason), reason);
  });
  it("lets an event be named as the thing another fits around, when it is on the plan", () => {
    const withPlan = contextOf([at("jaipur", 10, "Jaipur", "Rajasthan")], {
      entries: [
        {
          editionSlug: "ludhiana",
          name: "AITA ludhiana (Ludhiana)",
          startDate: midnight(30),
          status: "shortlisted",
        },
      ],
    });
    const reason = "A fortnight before the Ludhiana event in Jaipur.";
    assert.equal(ask("jaipur", reason, withPlan), reason);
  });
});

// ─── What the model is sent ───────────────────────────────────────────────────

describe("what the model is sent", () => {
  const context = contextOf(
    [edition("a", 10, { surface: "Clay" }), edition("far", 40, { ladder: "National Series" })],
    { reach: { far: verdict("unlikely") } }
  );

  it("never includes the child's name", () => {
    const prompt = buildUserPrompt(context, NOW);
    assert.doesNotMatch(prompt, /Aarav/);
    assert.doesNotMatch(prompt, /firstName/);
    assert.match(SYSTEM_PROMPT, /only as "they"/);
  });

  it("sends the chosen season, not the whole calendar, and asks only for wording", () => {
    const data = JSON.parse(buildUserPrompt(context, NOW).split("\n\n")[1]);
    assert.deepEqual(
      data.picks.map((p: any) => p.slug),
      ["a", "far"]
    );
    assert.match(SYSTEM_PROMPT, /You do not choose events/);
    assert.equal(data.picks[0].surface, "Clay");
  });

  it("marks which sentences are the model's and which are fixed", () => {
    const data = JSON.parse(buildUserPrompt(context, NOW).split("\n\n")[1]);
    const wording = Object.fromEntries(data.picks.map((p: any) => [p.slug, p.wording]));
    assert.deepEqual(wording, { a: "yours", far: "fixed" });
  });

  it("limits the model to the events in the season, so none can be invented", () => {
    const schema = responseSchemaFor(["a", "b"]);
    assert.deepEqual(schema.properties.picks.items.properties.slug.enum, ["a", "b"]);
    assert.equal(schema.properties.picks.items.properties.tier, undefined);
    assert.deepEqual(schema.required, ["summary", "picks"]);
    assert.equal(
      responseSchemaFor(undefined).properties.picks.items.properties.slug.enum,
      undefined
    );
  });
});

// ─── The service: cached, limited, never empty ───────────────────────────────

describe("the recommendation service", () => {
  const events = [
    edition("a", 10, { ladder: "National Series" }),
    edition("b", 30),
    edition("c", 60),
  ];
  const reach = { a: verdict("likely") };

  const aiAnswer = {
    summary: "Three events spread across the weeks ahead.",
    picks: ["a", "b", "c"].map((slug) => ({ slug, reason: "Championship Series in Sonipat." })),
  };

  function harness(
    options: {
      overview?: OverviewOptions;
      model?: (system: string, user: string, opts?: any) => Promise<unknown>;
      loadCosts?: (userId: string, dependentId: string, slugs: string[]) => Promise<any>;
    } = {}
  ) {
    const state: any = {
      calls: 0,
      count: 0,
      stored: new Map<string, unknown>(),
      overview: overviewOf(events, { reach, ...(options.overview ?? {}) }),
      counts: {} as Record<string, number>,
      prompts: [] as string[],
      costCalls: [] as string[][],
    };
    const service = createRecommendationService({
      model: async (system: string, user: string, opts?: any) => {
        state.calls += 1;
        state.prompts.push(user);
        state.options = opts;
        return options.model ? options.model(system, user, opts) : aiAnswer;
      },
      store: {
        get: async (key: string) => state.stored.get(key) ?? null,
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
      metrics: {
        increment: async (name: string, by = 1) => {
          state.counts[name] = (state.counts[name] ?? 0) + by;
        },
      },
      ...(options.loadCosts
        ? {
            loadCosts: async (u: string, d: string, slugs: string[]) => {
              state.costCalls.push(slugs);
              return options.loadCosts!(u, d, slugs);
            },
          }
        : {}),
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

  it("tells the model only which events are in the season", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    assert.deepEqual([...state.options.slugs].sort(), ["a", "b", "c"]);
  });

  it("answers asking again with nothing changed from the saved answer, and spends nothing", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    const again = await service.generate("u1", "d1", { force: true });
    assert.equal(again.recommendations.unchanged, true);
    assert.equal(state.calls, 1);
    assert.equal(again.usage.used, 1);
    assert.equal(state.counts.unchanged, 1);
  });

  it("asks again, and spends another answer, once something has changed", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    state.overview = overviewOf(events, { reach, entries: [planned("b", 30)] });
    const again = await service.generate("u1", "d1", { force: true });
    assert.equal(again.recommendations.unchanged, undefined);
    assert.equal(state.calls, 2);
  });

  it("gives the code's own season, and the reason, when the model fails", async () => {
    const { service } = harness({
      model: async () => {
        throw new Error("offline");
      },
    });
    const answer = await service.generate("u1", "d1");
    assert.equal(answer.recommendations.source, "rules");
    assert.equal(answer.recommendations.fallbackReason, "ai-unavailable");
    assert.deepEqual(tier(answer.recommendations, "recommended").sort(), ["a", "b", "c"]);
    assert.equal(answer.usage.used, 0);
  });

  it("shows the same events and tiers with the model, without it, and when it fails", async () => {
    const withModel = await harness().service.generate("u1", "d1");
    const failed = await harness({
      model: async () => {
        throw new Error("x");
      },
    }).service.generate("u1", "d1");
    const strip = (r: any) => r.recommendations.items.map((i: any) => [i.slug, i.tier]);
    assert.deepEqual(strip(withModel), strip(failed));
  });

  it("falls back, and refunds, when the model's answer fails validation", async () => {
    const { service } = harness({ model: async () => ({ nonsense: true }) });
    const answer = await service.generate("u1", "d1");
    assert.equal(answer.recommendations.fallbackReason, "invalid-output");
    assert.equal(answer.usage.used, 0);
  });

  it("does not cache a fallback, so the next try can reach the model", async () => {
    let fail = true;
    const { state, service } = harness({
      model: async () => {
        if (fail) throw new Error("offline");
        return aiAnswer;
      },
    });
    await service.generate("u1", "d1");
    fail = false;
    const next = await service.generate("u1", "d1");
    assert.equal(next.recommendations.source, "ai");
    assert.equal(state.calls, 2);
  });

  it("stops at the daily limit, still gives the season, and never calls the model", async () => {
    const { state, service } = harness();
    state.count = DAILY_AI_CAP;
    const answer = await service.generate("u1", "d1");
    assert.equal(answer.recommendations.fallbackReason, "daily-limit");
    assert.equal(state.calls, 0);
    assert.ok(tier(answer.recommendations, "recommended").length > 0);
  });

  it("allows exactly the daily number of fresh answers", async () => {
    const { state, service } = harness();
    for (let i = 0; i < DAILY_AI_CAP; i += 1) {
      // Each ask follows a change, so none is answered from the cache.
      state.overview = overviewOf(events, { reach, entries: [planned(`x${i}`, 200 + i * 5)] });
      const answer = await service.generate("u1", "d1");
      assert.equal(answer.recommendations.source, "ai");
    }
    state.overview = overviewOf(events, { reach, entries: [planned("last", 400)] });
    const over = await service.generate("u1", "d1");
    assert.equal(over.recommendations.fallbackReason, "daily-limit");
  });

  it("does not call the model when there is nothing for it to say", async () => {
    const { state, service } = harness({
      overview: {
        reach: { a: verdict("unlikely"), b: verdict("unlikely"), c: verdict("unlikely") },
      },
    });
    const answer = await service.generate("u1", "d1");
    assert.equal(state.calls, 0);
    assert.equal(answer.recommendations.source, "rules");
    assert.deepEqual(tier(answer.recommendations, "reach").sort(), ["a", "b", "c"]);
    assert.equal(answer.usage.used, 0);
  });

  it("refuses, plainly, when no ranking is linked", async () => {
    const { service } = harness({ overview: { linkState: "not-linked" } });
    await assert.rejects(service.generate("u1", "d1"), /Link a ranking first/);
  });

  it("reads without spending anything", async () => {
    const { state, service } = harness();
    const before = await service.get("u1", "d1");
    assert.equal(before.recommendations, null);
    assert.equal(state.calls, 0);
    assert.equal(state.count, 0);
  });

  it("marks the answer stale when the plan changes, and hides what is no longer offered", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    state.overview = overviewOf(events, { reach, entries: [planned("b", 30)] });
    const read = await service.get("u1", "d1");
    assert.equal(read.recommendations.stale, true);
    assert.ok(!slugsOf(read.recommendations).includes("b"));
  });

  it("marks the answer stale when a preference, the budget, or a dismissal changes", async () => {
    for (const change of [{ goal: "home" as const }, { budget: 50000 }, { dismissed: ["b"] }]) {
      const { state, service } = harness();
      await service.generate("u1", "d1");
      state.overview = overviewOf(events, { reach, ...change });
      assert.equal(
        (await service.get("u1", "d1")).recommendations.stale,
        true,
        JSON.stringify(change)
      );
    }
  });

  it("marks the answer stale when what past draws say about an event changes", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    state.overview = overviewOf(events, { reach: { a: verdict("unlikely") } });
    assert.equal((await service.get("u1", "d1")).recommendations.stale, true);
  });

  it("hands the chat a saved answer only while it is current", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    assert.ok(await service.peekFresh("u1", state.overview));
    state.overview = overviewOf(events, { reach, goal: "home" });
    assert.equal(await service.peekFresh("u1", state.overview), null);
  });

  it("keeps one parent's answers away from another's", async () => {
    const { state, service } = harness();
    await service.generate("u1", "d1");
    assert.equal(await service.peekFresh("u2", state.overview), null);
  });

  describe("costs", () => {
    const costs = async () => ({
      a: { low: 10000, high: 20000 },
      b: { low: 10000, high: 20000 },
      c: { low: 10000, high: 20000 },
    });

    it("asks for no costs when the parent has set no budget and does not want 'close to home'", async () => {
      const { state, service } = harness({ loadCosts: costs });
      await service.generate("u1", "d1");
      assert.deepEqual(state.costCalls, []);
    });

    it("asks for costs, for the events and what is planned, when there is a budget", async () => {
      const { state, service } = harness({
        loadCosts: costs,
        overview: { budget: 45000, entries: [planned("p", 100)] },
      });
      const answer = await service.generate("u1", "d1");
      assert.deepEqual([...state.costCalls[0]].sort(), ["a", "b", "c", "p"].sort());
      assert.equal(tier(answer.recommendations, "recommended").length, 2);
      assert.match(answer.recommendations.notes.join(" "), /budget/);
    });

    it("asks for costs for the home goal, to prefer the cheaper trip", async () => {
      const { state, service } = harness({ loadCosts: costs, overview: { goal: "home" } });
      await service.generate("u1", "d1");
      assert.equal(state.costCalls.length, 1);
    });

    it("chooses the season without costs, and says so, when they cannot be estimated", async () => {
      const { service } = harness({
        loadCosts: async () => {
          throw new Error("no estimate");
        },
        overview: { budget: 45000 },
      });
      const answer = await service.generate("u1", "d1");
      assert.equal(tier(answer.recommendations, "recommended").length, 3);
      assert.match(answer.recommendations.notes.join(" "), /budget was not used/);
    });

    it("does not let a re-estimate make a saved answer look stale", async () => {
      let high = 20000;
      const { service } = harness({
        loadCosts: async () => ({ a: { low: 1, high }, b: { low: 1, high }, c: { low: 1, high } }),
        overview: { budget: 90000 },
      });
      await service.generate("u1", "d1");
      high = 25000;
      assert.equal((await service.get("u1", "d1")).recommendations.stale, false);
    });
  });
});

// ─── Counters ─────────────────────────────────────────────────────────────────

describe("counting what the recommender does", () => {
  const events = [edition("a", 10), edition("b", 30), edition("c", 60)];
  const good = {
    summary: "Three events spread across the weeks ahead.",
    picks: ["a", "b", "c"].map((slug) => ({ slug, reason: "Championship Series in Sonipat." })),
  };

  function counted(model?: () => Promise<unknown>) {
    const counts: Record<string, number> = {};
    const stored = new Map<string, unknown>();
    let used = 0;
    let overview: any = overviewOf(events);
    const service = createRecommendationService({
      model: async () => (model ? model() : good),
      store: {
        get: async (key: string) => stored.get(key) ?? null,
        set: async (key: string, value: unknown) => {
          stored.set(key, value);
        },
      },
      counter: {
        get: async () => used,
        increment: async () => ++used,
        decrement: async () => {
          used -= 1;
        },
      },
      now: () => NOW,
      loadOverview: async () => overview,
      metrics: {
        increment: async (name: string, by = 1) => {
          counts[name] = (counts[name] ?? 0) + by;
        },
      },
    });
    return { service, counts, change: (o: any) => (overview = o) };
  }

  it("counts a request, a model call and a model answer", async () => {
    const { service, counts } = counted();
    await service.generate("u1", "d1");
    assert.equal(counts.asked, 1);
    assert.equal(counts.model_called, 1);
    assert.equal(counts.answered_by_model, 1);
    assert.equal(counts.model_picks, 3);
    assert.equal(counts.cache_hit, undefined);
  });

  it("counts a repeat as a cache hit, and a forced repeat as unchanged", async () => {
    const { service, counts } = counted();
    await service.generate("u1", "d1");
    await service.generate("u1", "d1");
    await service.generate("u1", "d1", { force: true });
    assert.equal(counts.asked, 3);
    assert.equal(counts.cache_hit, 1);
    assert.equal(counts.forced, 1);
    assert.equal(counts.unchanged, 1);
    assert.equal(counts.model_called, 1);
  });

  it("counts a failed model, and why the rules answered", async () => {
    const { service, counts } = counted(async () => {
      throw new Error("offline");
    });
    await service.generate("u1", "d1");
    assert.equal(counts["fallback_ai-unavailable"], 1);
    assert.equal(counts.answered_by_model, undefined);
  });

  it("counts an answer that failed validation separately", async () => {
    const { service, counts } = counted(async () => ({ nonsense: true }));
    await service.generate("u1", "d1");
    assert.equal(counts["fallback_invalid-output"], 1);
  });

  it("counts what validation repaired", async () => {
    const { service, counts } = counted(async () => ({
      summary: "Two events across the weeks ahead.",
      picks: [
        { slug: "a", tier: "recommended", reason: "Close to home in Delhi." },
        { slug: "ghost", reason: "Not offered." },
        { slug: "b", reason: "Championship Series in Sonipat." },
      ],
    }));
    await service.generate("u1", "d1");
    assert.equal(counts.model_dropped, 1);
    assert.equal(counts.model_foreign_names, 1);
    assert.equal(counts.model_reasons_replaced, 1);
    assert.equal(counts.model_reasons_missing, 1);
  });

  it("counts an add as from a suggestion only when it was one", async () => {
    const { service, counts } = counted();
    await service.generate("u1", "d1");
    await service.noteAdded("u1", "d1", "a");
    await service.noteAdded("u1", "d1", "not-suggested");
    assert.equal(counts.added_from_suggestion, 1);
    assert.equal(counts.added_other, 1);
  });

  it("counts an add as other when nothing was ever suggested", async () => {
    const { service, counts } = counted();
    await service.noteAdded("u1", "d1", "a");
    assert.equal(counts.added_other, 1);
  });

  it("counts a dismissal", async () => {
    const { service, counts } = counted();
    await service.noteDismissed();
    assert.equal(counts.dismissed, 1);
  });

  it("never lets a failing counter break a request", async () => {
    const service = createRecommendationService({
      model: async () => good,
      store: { get: async () => null, set: async () => {} },
      counter: { get: async () => 0, increment: async () => 1, decrement: async () => {} },
      now: () => NOW,
      loadOverview: async () => overviewOf(events),
      metrics: {
        increment: async () => {
          throw new Error("redis down");
        },
      },
    });
    const answer = await service.generate("u1", "d1");
    assert.equal(answer.recommendations.source, "ai");
  });
});
