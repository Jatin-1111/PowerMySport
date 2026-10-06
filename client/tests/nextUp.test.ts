import { describe, expect, it } from "vitest";
import type { PlannerEdition } from "@powermysport/shared-types";

import { nextUp } from "@/modules/planner/utils/nextUp";
import type { SeasonPlanEntry } from "@/modules/planner/services/seasonPlan";

/**
 * "What do I do next" is the one line a parent reads first, so what is pinned is the
 * ways it can be wrong: a deadline reported after it passed, a deadline invented for
 * an event that publishes none, a withdrawal reminder for an event not entered, or an
 * event that has already started shown as upcoming.
 */

const TODAY = "2026-10-06";

const entry = (
  slug: string,
  start: string,
  status: SeasonPlanEntry["status"]
): SeasonPlanEntry => ({
  editionSlug: slug,
  name: `Event ${slug}`,
  startDate: `${start}T00:00:00.000Z`,
  status,
  addedAt: "2026-10-01T00:00:00.000Z",
});

const edition = (over: Partial<PlannerEdition> = {}): PlannerEdition => ({
  name: "x",
  startDate: "2026-10-20T00:00:00.000Z",
  ...over,
});

const run = (
  entries: SeasonPlanEntry[],
  editions: Record<string, PlannerEdition>,
  limit?: number
) =>
  nextUp({
    entries,
    calendar: new Map(Object.entries(editions)),
    today: TODAY,
    ...(limit ? { limit } : {}),
  });

describe("nextUp", () => {
  it("puts a deadline before the event it belongs to, and sorts by date", () => {
    const result = run([entry("a", "2026-10-20", "shortlisted")], {
      a: edition({ registrationDeadlineDate: "2026-10-09T00:00:00.000Z" }),
    });
    expect(result.map((item) => [item.kind, item.date, item.daysAway])).toEqual([
      ["enter-by", "2026-10-09", 3],
      ["event", "2026-10-20", 14],
    ]);
  });

  it("carries AITA's page and cut-off time on a deadline, so it can be acted on", () => {
    const [first] = run([entry("a", "2026-10-20", "shortlisted")], {
      a: edition({
        registrationDeadlineDate: "2026-10-09T00:00:00.000Z",
        official: {
          source: "factSheet",
          pageUrl: "https://aita.test/a",
          times: { entryCloses: "23:59" },
        },
      }),
    });
    expect(first).toMatchObject({ pageUrl: "https://aita.test/a", time: "23:59" });
  });

  it("invents no deadline for an event that publishes none", () => {
    const result = run([entry("a", "2026-10-20", "shortlisted")], { a: edition() });
    expect(result.map((item) => item.kind)).toEqual(["event"]);
  });

  it("does not report a deadline that has passed", () => {
    const result = run([entry("a", "2026-10-20", "shortlisted")], {
      a: edition({ registrationDeadlineDate: "2026-10-05T00:00:00.000Z" }),
    });
    expect(result.map((item) => item.kind)).toEqual(["event"]);
  });

  it("counts a deadline today as still to do", () => {
    const [first] = run([entry("a", "2026-10-20", "shortlisted")], {
      a: edition({ registrationDeadlineDate: "2026-10-06T00:00:00.000Z" }),
    });
    expect(first).toMatchObject({ kind: "enter-by", daysAway: 0 });
  });

  it("asks about entering only for events not yet entered, and withdrawing only for entered ones", () => {
    const editions = {
      a: edition({
        registrationDeadlineDate: "2026-10-09T00:00:00.000Z",
        official: { source: "factSheet", withdrawalDeadline: "2026-10-12" },
      }),
    };
    const shortlisted = run([entry("a", "2026-10-20", "shortlisted")], editions);
    expect(shortlisted.map((item) => item.kind)).toEqual(["enter-by", "event"]);

    const entered = run([entry("a", "2026-10-20", "entered")], editions);
    expect(entered.map((item) => item.kind)).toEqual(["withdraw-by", "event"]);
  });

  it("shows an event that has started as under way, today", () => {
    const [first] = run([entry("a", "2026-10-04", "entered")], {
      a: edition({ startDate: "2026-10-04T00:00:00.000Z", endDate: "2026-10-10T00:00:00.000Z" }),
    });
    expect(first).toMatchObject({ kind: "event", underWay: true, daysAway: 0 });
  });

  it("drops events that have finished, and played events", () => {
    const result = run(
      [entry("old", "2026-09-20", "entered"), entry("done", "2026-10-20", "played")],
      {
        old: edition({
          startDate: "2026-09-20T00:00:00.000Z",
          endDate: "2026-09-26T00:00:00.000Z",
        }),
      }
    );
    expect(result).toEqual([]);
  });

  it("is empty for an empty plan, and keeps only as many as asked for", () => {
    expect(run([], {})).toEqual([]);
    const many = run(
      ["a", "b", "c", "d"].map((slug, i) => entry(slug, `2026-10-${10 + i}`, "shortlisted")),
      {},
      2
    );
    expect(many).toHaveLength(2);
  });
});
