// Unit tests for reading an admission or scholarship out of a source: the
// cleaning that stands between the model's JSON and our schema, and the
// compare-and-apply logic behind the review screen. No database, no model.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  cleanOpportunityExtraction,
} = require("../admin/services/dataSourceExtraction/opportunity");
const {
  applyChanges,
  proposedChanges,
  withSource,
} = require("../admin/services/opportunitySourceMerge");

describe("cleanOpportunityExtraction", () => {
  it("keeps valid fields and drops invalid ones with a warning", () => {
    const result = cleanOpportunityExtraction(
      {
        title: "Khelo India athlete scholarship",
        category: "government",
        selection: "lottery",
        owner: { name: "SAI", type: "central-government" },
        eligibility: { ageMin: 12, ageMax: "eighteen", level: "Medal at KIYG" },
        benefit: {
          summary: "₹6.28 lakh a year",
          amount: { value: 628000, currency: "INR", period: "year" },
        },
        cycle: {
          opensOn: "2026-13-01",
          keyDates: [
            { label: "Games begin", date: "2026-05-04" },
            { label: "Bad", date: "May" },
          ],
        },
        _citations: { title: "Khelo India Athletes", nonsense: "ignored" },
      },
      "scholarship"
    );

    assert.equal(result.fields.title, "Khelo India athlete scholarship");
    assert.equal(result.fields.selection, undefined);
    assert.deepEqual(result.fields.eligibility, { ageMin: 12, level: "Medal at KIYG" });
    assert.deepEqual(result.fields.cycle, {
      keyDates: [{ label: "Games begin", date: "2026-05-04" }],
    });
    assert.equal(result.fields.benefit.amount.value, 628000);
    assert.deepEqual(result.citations, { title: "Khelo India Athletes" });
    assert.ok(result.warnings.some((w: string) => w.includes("selection")));
  });

  it("refuses a category from the other track", () => {
    const result = cleanOpportunityExtraction({ title: "X", category: "college" }, "scholarship");
    assert.equal(result.fields.category, undefined);
  });

  it("drops an amount that is missing its currency or period", () => {
    const result = cleanOpportunityExtraction(
      { benefit: { summary: "Some money", amount: { value: 5000 } } },
      "scholarship"
    );
    assert.deepEqual(result.fields.benefit, { summary: "Some money" });
  });

  it("keeps only sports we support", () => {
    const result = cleanOpportunityExtraction({ sports: ["tennis", "curling"] }, "admission");
    assert.deepEqual(result.fields.sports, ["tennis"]);
  });

  it("returns nothing, with a reason, for a non-object", () => {
    const result = cleanOpportunityExtraction(["not", "an", "object"], "admission");
    assert.deepEqual(result.fields, {});
    assert.equal(result.warnings.length, 1);
  });
});

describe("proposedChanges / applyChanges", () => {
  const current = {
    title: "DU sports quota",
    summary: "Old summary.",
    eligibility: { level: "Old level", income: "No limit" },
    steps: ["Apply", "Trial"],
    sources: [{ label: "Old", url: "https://old.example" }],
    status: "published",
  };

  it("lists one row per changed field, one level into nested objects", () => {
    const changes = proposedChanges(
      current,
      {
        title: "DU sports quota",
        summary: "New summary.",
        eligibility: { level: "New level" },
        steps: ["Apply", "Trial", "Seat allotted"],
      },
      { summary: "quote for summary", eligibility: "quote for eligibility" }
    );
    assert.deepEqual(
      changes.map((c: { path: string }) => c.path),
      ["summary", "eligibility.level", "steps"]
    );
    assert.equal(changes[1].current, "Old level");
    assert.equal(changes[1].citation, "quote for eligibility");
  });

  it("never proposes clearing a field the source did not mention", () => {
    const changes = proposedChanges(current, { summary: "New summary." });
    assert.ok(!changes.some((c: { path: string }) => c.path.startsWith("eligibility")));
  });

  it("never proposes changes to identity, status or sources", () => {
    const changes = proposedChanges(current, {
      slug: "hijack",
      status: "draft",
      sources: [],
      lastVerifiedOn: "2020-01-01",
    });
    assert.deepEqual(changes, []);
  });

  it("applies only the kept rows and leaves siblings alone", () => {
    const changes = proposedChanges(current, {
      summary: "New summary.",
      eligibility: { level: "New level" },
    });
    const next = applyChanges(current, changes, new Set(["eligibility.level"]));
    assert.equal(next.summary, "Old summary.");
    assert.deepEqual(next.eligibility, { level: "New level", income: "No limit" });
  });

  it("builds a new entry from nothing", () => {
    const changes = proposedChanges(null, {
      title: "New",
      owner: { name: "SAI", type: "federation" },
    });
    const next = applyChanges(null, changes, new Set(["title", "owner.name", "owner.type"]));
    assert.deepEqual(next, { title: "New", owner: { name: "SAI", type: "federation" } });
  });
});

describe("withSource", () => {
  it("puts the new source first and replaces an older listing of the same link", () => {
    const next = withSource(
      [
        { label: "Other", url: "https://a.example" },
        { label: "Old label", url: "https://b.example" },
      ],
      { label: "Bulletin 2026-27", url: "https://b.example", publishedOn: "2026-06-01" }
    );
    assert.deepEqual(
      next.map((s: { url: string }) => s.url),
      ["https://b.example", "https://a.example"]
    );
    assert.equal(next[0].label, "Bulletin 2026-27");
  });
});
