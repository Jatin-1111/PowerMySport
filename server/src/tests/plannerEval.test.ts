/* eslint-disable @typescript-eslint/no-var-requires */
// The evaluation harness is only worth trusting if it can tell a bad answer from a good
// one, so these tests do three things: prove each rule check really catches the break it
// names, hold the rules-only recommender to a clean sheet across every synthetic child
// (a regression gate that runs with the rest of the suite, no model, no network), and
// check that the report says what the numbers mean.

import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
const { describe, it } = require("node:test");

const { EVAL_CHILDREN } = require("../evals/plannerRecommendations/children");
const {
  contextFor,
  loadCalendar,
  nowFor,
  runModel,
  runRules,
} = require("../evals/plannerRecommendations/harness");
const { labelKey, loadLabels } = require("../evals/plannerRecommendations/labels");
const { renderMarkdown, summarize } = require("../evals/plannerRecommendations/report");
const { scoreResult } = require("../evals/plannerRecommendations/score");
const { baselineRecommend } = require("../client/services/plannerRecommendations/baseline");

const calendar = loadCalendar();
const child = (id: string) => EVAL_CHILDREN.find((profile: { id: string }) => profile.id === id)!;

/** A rules answer for a child, edited into the break being tested. */
const answerFor = (id: string) => {
  const context = contextFor(child(id), calendar);
  return { context, result: baselineRecommend(context, nowFor(calendar)) };
};

describe("the frozen calendar", () => {
  it("holds the whole upcoming junior calendar, with the fields the rules read", () => {
    assert.ok(calendar.editions.length >= 50);
    assert.match(calendar.frozenOn, /^\d{4}-\d{2}-\d{2}$/);
    for (const edition of calendar.editions) {
      assert.ok(edition.slug, `${edition.name} has no slug`);
      assert.ok(edition.startDate, `${edition.name} has no start date`);
    }
    // The signed page link is never kept.
    assert.equal(
      calendar.editions.filter(
        (edition: { official?: { pageUrl?: string } }) => edition.official?.pageUrl
      ).length,
      0
    );
  });

  it("is a calendar the profiles can be judged against: every profile has something to choose from, or a reason it has not", () => {
    for (const profile of EVAL_CHILDREN) {
      const context = contextFor(profile, calendar);
      if (profile.id === "u14-none-left") {
        assert.equal(context.allowanceLeft, 0);
      } else {
        assert.ok(context.candidates.length > 0, `${profile.id} has no candidates`);
      }
    }
  });
});

describe("the synthetic children", () => {
  it("have unique ids and a reason each", () => {
    const ids = EVAL_CHILDREN.map((profile: { id: string }) => profile.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const profile of EVAL_CHILDREN) assert.ok(profile.why.length > 10, profile.id);
  });

  it("cover every age group, every goal, and the edges the rules turn on", () => {
    const groups = new Set(EVAL_CHILDREN.map((p: { ageGroup: string }) => p.ageGroup));
    const goals = new Set(EVAL_CHILDREN.map((p: { goal: string }) => p.goal));
    assert.deepEqual([...groups].sort(), ["U-12", "U-14", "U-16", "U-18"]);
    assert.deepEqual([...goals].sort(), ["experience", "home", "points"]);
    const ranks = EVAL_CHILDREN.map((p: { rank: number | null }) => p.rank);
    assert.ok(ranks.includes(75) && ranks.includes(76), "the top-75 bar needs both sides");
    assert.ok(ranks.includes(null), "an unranked child");
    assert.ok(EVAL_CHILDREN.some((p: { playedEarlier?: number }) => p.playedEarlier === 25));
    assert.ok(EVAL_CHILDREN.some((p: { state: string | null }) => p.state === null));
    assert.ok(EVAL_CHILDREN.some((p: { blockedRanges?: unknown[] }) => p.blockedRanges?.length));
    assert.ok(
      EVAL_CHILDREN.some((p: { plannedPositions?: number[] }) => p.plannedPositions?.length)
    );
  });
});

describe("the rules-only recommender, across every child", () => {
  it("breaks no rule for any of them", () => {
    for (const profile of EVAL_CHILDREN) {
      const run = runRules(profile, calendar);
      assert.equal(
        run.score.violationTotal,
        0,
        `${profile.id} broke a rule: ${JSON.stringify(run.score.violations)}`
      );
    }
  });
});

describe("catching a rule break", () => {
  const withItems = (
    id: string,
    edit: (items: Array<{ slug: string; tier: string; reason: string }>, context: any) => void
  ) => {
    const { context, result } = answerFor(id);
    const items = result.items.map((item: object) => ({ ...item })) as any[];
    edit(items, context);
    return scoreResult(context, { ...result, items });
  };

  it("an event that was never offered", () => {
    const score = withItems("u14-mid-points", (items) =>
      items.push({ slug: "ghost", tier: "consider", reason: "Invented." })
    );
    assert.equal(score.violations.notOffered, 1);
  });

  it("the same event twice", () => {
    const score = withItems("u14-mid-points", (items) => items.push({ ...items[0]! }));
    assert.equal(score.violations.duplicate, 1);
  });

  it("two recommended events on the same days", () => {
    const score = withItems("u14-mid-points", (items, context) => {
      const first = context.candidates.find((c: { slug: string }) => c.slug === items[0]!.slug);
      const span = (c: { startDate: string; endDate?: string }): [number, number] => [
        Date.parse(c.startDate),
        Date.parse(c.endDate ?? c.startDate),
      ];
      const [firstStart, firstEnd] = span(first);
      const twin = context.candidates.find(
        (c: { slug: string; startDate: string; endDate?: string }) => {
          const [start, end] = span(c);
          return c.slug !== first.slug && start <= firstEnd && end >= firstStart;
        }
      );
      assert.ok(twin, "this calendar has two events sharing days");
      // It may already be an option: promote it, do not list it twice.
      const at = items.findIndex((item) => item.slug === twin.slug);
      if (at >= 0) items.splice(at, 1);
      items.push({ slug: twin.slug, tier: "recommended", reason: "Championship Series." });
    });
    assert.ok(score.violations.overlap >= 1);
  });

  it("an event inside the parent's blocked dates", () => {
    const { context, result } = answerFor("u14-exam-month");
    const blocked = calendar.editions.find(
      (e: { startDate: string; slug?: string }) =>
        e.startDate.startsWith("2026-11") &&
        e.slug &&
        !context.candidates.some((c: { slug: string }) => c.slug === e.slug)
    );
    assert.ok(blocked);
    // It is not even a candidate, so it is both: never offered and inside blocked dates.
    const forced = {
      ...context,
      candidates: [
        ...context.candidates,
        {
          slug: blocked.slug,
          name: blocked.name,
          startDate: blocked.startDate,
          endDate: blocked.endDate,
          deadline: null,
          inHomeState: false,
        },
      ],
    };
    const score = scoreResult(forced, {
      ...result,
      items: [
        ...result.items,
        { slug: blocked.slug, tier: "consider", reason: "Championship Series." },
      ],
    });
    assert.ok(score.violations.insideBlocked >= 1);
  });

  it("more recommended events than yearly entries left", () => {
    const { context, result } = answerFor("u14-3-left");
    const crowded = { ...context, allowanceLeft: 1 };
    const score = scoreResult(crowded, result);
    assert.equal(score.violations.overAllowance, 1);
  });

  it("options offered when no entry is left", () => {
    const { context, result } = answerFor("u14-none-left");
    const score = scoreResult(context, {
      ...result,
      items: [
        { slug: context.candidates[0].slug, tier: "consider", reason: "Championship Series." },
      ],
    });
    assert.equal(score.violations.suggestedWithNoAllowance, 1);
  });

  it("a reason that promises a place", () => {
    const score = withItems("u14-mid-points", (items) => {
      items[0]!.reason = "Guaranteed to get in.";
    });
    assert.equal(score.violations.ungroundedReason, 1);
  });

  it("a reason that names another event's city", () => {
    const score = withItems("u14-mid-points", (items, context) => {
      const own = context.candidates.find((c: { slug: string }) => c.slug === items[0]!.slug);
      const other = context.candidates.find(
        (c: { city?: string }) => c.city && c.city !== own.city
      );
      items[0]!.reason = `Close to home in ${other.city}.`;
    });
    assert.equal(score.violations.ungroundedReason, 1);
  });

  it("nothing recommended when something fitted", () => {
    const { context, result } = answerFor("u14-mid-points");
    const score = scoreResult(context, { ...result, items: [] });
    assert.equal(score.violations.emptyWithRoom, 1);
  });

  it("but not when the allowance is genuinely spent", () => {
    const { context, result } = answerFor("u14-none-left");
    assert.equal(scoreResult(context, result).violations.emptyWithRoom, 0);
  });
});

describe("describing an answer", () => {
  it("counts the events above Championship Series as out of reach", () => {
    const { context, result } = answerFor("u16-mid");
    const score = scoreResult(context, result);
    const recommended = result.items.filter(
      (item: { tier: string }) => item.tier === "recommended"
    );
    const reach = recommended.filter((item: { slug: string }) => {
      const ladder = context.candidates.find((c: { slug: string }) => c.slug === item.slug).ladder;
      return ["Super Series", "National Series", "Nationals"].includes(ladder);
    });
    assert.equal(score.diagnostics.reachCount, reach.length);
    assert.equal(score.diagnostics.recommended, recommended.length);
  });

  it("sees a repeated template as low variety", () => {
    const { context } = answerFor("u14-mid-points");
    const slugs = context.candidates.slice(0, 3).map((c: { slug: string }) => c.slug);
    const same = slugs.map((slug: string) => ({
      slug,
      tier: "consider",
      reason: "Open to enter at this rank.",
    }));
    const score = scoreResult(context, {
      source: "rules",
      generatedAt: "",
      goal: "points",
      summary: "",
      notes: [],
      items: same,
    });
    assert.equal(score.diagnostics.reasonVariety, 1 / 3);
  });

  it("measures how far apart the model's repeat answers are", () => {
    const profile = child("u14-mid-points");
    const first = runRules(profile, calendar);
    const second = { ...first, result: { ...first.result, items: first.result.items.slice(0, 2) } };
    const model = [first, second].map((run) => ({
      ...run,
      system: "model",
      model: { ms: 1, usage: null, promptChars: 1, stats: null, error: null },
    }));
    const summary = summarize("model", model, new Map());
    assert.ok(summary.model.stability < 1 && summary.model.stability > 0);
  });
});

describe("running the model path", () => {
  const profile = child("u14-mid-points");
  const usage = { model: "fake", promptTokens: 100, outputTokens: 50 };

  it("tells the model which events it may name, and scores a clean answer", async () => {
    const context = contextFor(profile, calendar);
    let offered: string[] | undefined;
    const run = await runModel(
      profile,
      calendar,
      async (_system: string, _user: string, options?: { slugs?: string[] }) => {
        offered = options?.slugs;
        const base = baselineRecommend(context, nowFor(calendar));
        return {
          value: {
            summary: base.summary,
            picks: base.items.map((item: { slug: string; tier: string; reason: string }) => ({
              ...item,
            })),
          },
          usage,
        };
      }
    );
    assert.equal(run.source, "ai");
    assert.equal(run.score.violationTotal, 0);
    assert.equal(run.model.usage.promptTokens, 100);
    assert.deepEqual(
      [...(offered ?? [])].sort(),
      context.candidates.map((c: { slug: string }) => c.slug).sort()
    );
  });

  it("falls back to the rules, and says why, when the model's answer is unusable", async () => {
    const run = await runModel(profile, calendar, async () => ({
      value: { nonsense: true },
      usage,
    }));
    assert.equal(run.source, "rules");
    assert.equal(run.fallbackReason, "invalid-output");
    assert.equal(run.score.violationTotal, 0);
  });

  it("falls back, and keeps the error, when the model call fails", async () => {
    const run = await runModel(profile, calendar, async () => {
      throw new Error("429 quota");
    });
    assert.equal(run.fallbackReason, "ai-unavailable");
    assert.match(run.model.error, /429/);
  });
});

describe("hand labels", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "labels-")), "labels.csv");

  it("reads Y and N, ignores blanks, and tolerates a missing file", () => {
    fs.writeFileSync(file, "child_id,event_slug,realistic\nkid,a,Y\nkid,b,N\nkid,c,\n,d,Y\n");
    const labels = loadLabels(file);
    assert.equal(labels.get(labelKey("kid", "a")), true);
    assert.equal(labels.get(labelKey("kid", "b")), false);
    assert.equal(labels.has(labelKey("kid", "c")), false);
    assert.equal(loadLabels(path.join(os.tmpdir(), "does-not-exist.csv")).size, 0);
  });

  it("turns labels into a realism figure for what was recommended", () => {
    const run = runRules(child("u14-mid-points"), calendar);
    const labels = new Map();
    const recommended = run.result.items.filter(
      (item: { tier: string }) => item.tier === "recommended"
    );
    labels.set(labelKey(run.childId, recommended[0].slug), true);
    labels.set(labelKey(run.childId, recommended[1].slug), false);
    const summary = summarize("rules", [run], labels);
    assert.equal(summary.realism.labelled, 2);
    assert.equal(summary.realism.precision, 0.5);
  });
});

describe("the report", () => {
  it("separates rule breaks from description, and says when realism is unmeasured", () => {
    const runs = EVAL_CHILDREN.map((profile: object) => runRules(profile, calendar));
    const text = renderMarkdown({
      label: "test",
      frozenOn: calendar.frozenOn,
      summaries: [summarize("rules", runs, new Map())],
      runs,
      notes: [],
    });
    assert.match(text, /## Violations \(must be zero\)/);
    assert.match(text, /## Diagnostics/);
    assert.match(text, /realism \(hand labels\) \| not measured/);
    assert.match(text, /u14-mid-points/);
  });
});
