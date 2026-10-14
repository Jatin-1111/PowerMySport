// The cost and the one-line "who can apply" on an admission or scholarship entry:
// how they are validated, how they are cleaned out of a model's reading, how
// their figure is checked against the quote, and how they come through review.
// No database.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  parseOpportunity,
  parseOpportunityDraft,
} = require("../shared/validation/opportunityFormat");
const {
  cleanOpportunityExtraction,
} = require("../admin/services/dataSourceExtraction/opportunity");
const { checkFigures } = require("../admin/services/dataSourceExtraction/quoteCheck");
const { applyChanges, proposedChanges } = require("../admin/services/opportunitySourceMerge");

const entry = (over: Record<string, unknown> = {}) => ({
  slug: "ikf",
  track: "admission",
  category: "academy",
  title: "India Khelo Football",
  summary: "City trials for young footballers.",
  owner: { name: "India Khelo Football", type: "company" },
  sports: ["football"],
  geography: { scope: "india" },
  selection: "trials",
  benefit: { summary: "A route to clubs and scouts." },
  sources: [{ label: "Trials", url: "https://example.org/trials" }],
  lastVerifiedOn: "2026-10-03",
  ...over,
});

describe("validation", () => {
  it("accepts a fee with its amount and currency, and a one-line who-can-apply", () => {
    const parsed = parseOpportunity(
      entry({
        cost: { kind: "fee", amount: 125, currency: "INR", note: "City round only" },
        eligibility: { summary: "Aspiring footballers of any age" },
      })
    );
    assert.equal(parsed.ok, true, parsed.errors?.join("; "));
    assert.equal(parsed.value.cost.amount, 125);
    assert.equal(parsed.value.eligibility.summary, "Aspiring footballers of any age");
  });

  it("does not require either field, because most sources do not state a cost", () => {
    const parsed = parseOpportunity(entry());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.cost, undefined);
  });

  it("refuses a fee with no figure, so the page cannot show a bare word", () => {
    const parsed = parseOpportunity(entry({ cost: { kind: "fee", note: "A small fee" } }));
    assert.equal(parsed.ok, false);
    assert.match(parsed.errors.join(" "), /fee needs an amount/i);
  });

  it("refuses an amount on something that is not a fee", () => {
    const parsed = parseOpportunity(
      entry({ cost: { kind: "free", amount: 0.5, currency: "INR" } })
    );
    assert.equal(parsed.ok, false);
    assert.match(parsed.errors.join(" "), /Only a fee has an amount/);
  });

  it("allows free and varies with just a note", () => {
    assert.equal(
      parseOpportunity(entry({ cost: { kind: "free", note: "Girls play free" } })).ok,
      true
    );
    assert.equal(parseOpportunity(entry({ cost: { kind: "varies", note: "By city" } })).ok, true);
  });

  it("refuses a who-can-apply line too long to read at a glance", () => {
    const parsed = parseOpportunity(entry({ eligibility: { summary: "x".repeat(161) } }));
    assert.equal(parsed.ok, false);
  });

  it("holds the same rules for a draft", () => {
    const draft = parseOpportunityDraft({
      slug: "ikf",
      track: "admission",
      category: "academy",
      title: "India Khelo Football",
      cost: { kind: "fee" },
    });
    assert.equal(draft.ok, false);
  });
});

describe("cleaning a reading", () => {
  const clean = (raw: Record<string, unknown>) => cleanOpportunityExtraction(raw, "admission");

  it("keeps a fee with its figure and the one-line who", () => {
    const { fields } = clean({
      eligibility: { summary: "Aspiring footballers", gender: "any" },
      cost: { kind: "fee", amount: 125, currency: "INR", note: "City round" },
    });
    assert.deepEqual(fields.cost, {
      kind: "fee",
      amount: 125,
      currency: "INR",
      note: "City round",
    });
    assert.equal(fields.eligibility.summary, "Aspiring footballers");
  });

  it("keeps a fee that came without a currency as varies, with a warning, rather than losing it", () => {
    const result = clean({ cost: { kind: "fee", amount: 125, note: "Registration" } });
    assert.deepEqual(result.fields.cost, { kind: "varies", note: "Registration" });
    assert.ok(result.warnings.some((w: string) => /cost\.amount/.test(w)));
  });

  it("drops an amount the model attached to free", () => {
    const { fields } = clean({
      cost: { kind: "free", amount: 0, currency: "INR", note: "No fee" },
    });
    assert.deepEqual(fields.cost, { kind: "free", note: "No fee" });
  });

  it("drops a kind outside the list, with a warning, and sets no cost", () => {
    const result = clean({ cost: { kind: "cheap", note: "Low" } });
    assert.equal(result.fields.cost, undefined);
    assert.ok(result.warnings.some((w: string) => /cost\.kind/.test(w)));
  });

  it("sets no cost when the source did not say, instead of inventing free", () => {
    assert.equal(clean({ title: "IKF" }).fields.cost, undefined);
  });

  it("cuts a who-can-apply line to the length the page can show", () => {
    const { fields } = clean({ eligibility: { summary: "w".repeat(400) } });
    assert.ok(fields.eligibility.summary.length <= 160);
  });
});

describe("figure check", () => {
  it("passes a fee whose amount is in its own quote", () => {
    const figures = checkFigures(
      { cost: { kind: "fee", amount: 125, currency: "INR" } },
      { cost: "Registration fee is ₹125 for the city round" }
    );
    assert.equal(figures.cost, "ok");
  });

  it("flags a fee whose amount is not in its quote", () => {
    const figures = checkFigures(
      { cost: { kind: "fee", amount: 150, currency: "INR" } },
      { cost: "Registration fee is ₹125 for the city round" }
    );
    assert.equal(figures.cost, "mismatch");
  });

  it("has nothing to check for free or varies", () => {
    assert.deepEqual(
      checkFigures({ cost: { kind: "free", note: "Girls play free" } }, { cost: "Free for girls" }),
      {}
    );
  });
});

describe("review", () => {
  const current = { cost: { kind: "free", note: "Old" }, eligibility: { ageMin: 8 } };
  const extracted = {
    cost: { kind: "fee", amount: 125, currency: "INR", note: "City round" },
    eligibility: { summary: "Aspiring footballers", ageMin: 8 },
  };

  it("proposes the cost as one row and the summary as its own", () => {
    const changes = proposedChanges(current, extracted, {}, null);
    const paths = changes.map((change: { path: string }) => change.path).sort();
    assert.deepEqual(paths, ["cost", "eligibility.summary"]);
  });

  it("applies the whole cost or none of it", () => {
    const changes = proposedChanges(current, extracted, {}, null);
    const kept = applyChanges(current, changes, new Set(["cost"]));
    assert.deepEqual(kept.cost, extracted.cost);
    assert.equal((kept.eligibility as Record<string, unknown>).summary, undefined);
    const none = applyChanges(current, changes, new Set());
    assert.deepEqual(none.cost, current.cost);
  });

  it("carries the figure check onto the cost row", () => {
    const changes = proposedChanges(
      current,
      extracted,
      { cost: "Registration fee is ₹125" },
      { quotes: {}, figures: { cost: "ok" }, shared: {}, against: "none" }
    );
    const row = changes.find((change: { path: string }) => change.path === "cost");
    assert.equal(row.figureCheck, "ok");
  });
});
