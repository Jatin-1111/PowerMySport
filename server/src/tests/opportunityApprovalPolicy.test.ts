// The approval policy, rule by rule. Each test starts from a reading that passes
// everything and breaks exactly one thing, so a failing test names the rule.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  APPROVAL_RULES,
  MAX_AGE_SHIFT_YEARS,
  MAX_AMOUNT_FACTOR,
  MAX_DATE_SHIFT_DAYS,
  MAX_ROWS_PER_UPDATE,
  evaluateApproval,
  officialSource,
} = require("../admin/services/opportunityApprovalPolicy");

const NOW = new Date("2026-10-15T00:00:00Z");

/** A reading that passes every rule, for a new entry from a lead. */
const base = (over: Record<string, unknown> = {}) => ({
  kind: "new",
  now: NOW,
  changes: [
    { path: "title", proposed: "Khelo Football Trials" },
    { path: "summary", proposed: "City trials for young footballers." },
    { path: "cost", proposed: { kind: "fee", amount: 125, currency: "INR" } },
  ],
  citations: {
    title: "Khelo Football Trials",
    summary: "City trials that connect young footballers to clubs.",
    cost: "Players pay a single registration fee of ₹125.",
  },
  checks: {
    against: "page-text",
    quotes: { title: "found", summary: "found", cost: "found" },
    figures: { cost: "ok" },
    shared: {},
  },
  conflicts: {},
  sourceUrls: ["https://indiakhelofootball.com/trials"],
  ownerName: "India Khelo Football",
  vettedDomains: [],
  cycleLabel: "2026-27",
  sourcePublishedOn: "2026-09-01",
  titleMatchesLead: true,
  duplicateOf: null,
  publishable: { ok: true, errors: [] },
  findings: [],
  ...over,
});

const failedBy = (over: Record<string, unknown>) => evaluateApproval(base(over)).failed;

describe("a reading that satisfies everything", () => {
  it("passes, and reports every rule", () => {
    const verdict = evaluateApproval(base());
    assert.equal(verdict.pass, true);
    assert.deepEqual(verdict.failed, []);
    assert.equal(verdict.rules.length, APPROVAL_RULES.length);
    assert.deepEqual(
      verdict.rules.map((r: { id: string }) => r.id).sort(),
      APPROVAL_RULES.map((r: { id: string }) => r.id).sort()
    );
  });

  it("describes every rule in terms an editor can act on", () => {
    for (const rule of APPROVAL_RULES) {
      assert.ok(rule.label.length > 20, `${rule.id} has a real label`);
    }
  });
});

describe("source rules", () => {
  it("official-source: refuses an aggregator, a social post, and an unknown host", () => {
    assert.deepEqual(failedBy({ sourceUrls: ["https://www.buddy4study.com/scheme"] }), [
      "official-source",
    ]);
    assert.deepEqual(failedBy({ sourceUrls: ["https://facebook.com/page/posts/1"] }), [
      "official-source",
    ]);
    assert.deepEqual(failedBy({ sourceUrls: ["https://totally-unrelated.example/x"] }), [
      "official-source",
    ]);
  });

  it("official-source: needs a source at all, and every source must be official", () => {
    assert.deepEqual(failedBy({ sourceUrls: [] }), ["official-source"]);
    assert.deepEqual(
      failedBy({
        sourceUrls: ["https://indiakhelofootball.com/a", "https://buddy4study.com/b"],
      }),
      ["official-source"]
    );
  });

  it("officialSource: accepts government and university sites, vetted hosts and the organiser's own", () => {
    assert.equal(officialSource("https://yas.gov.in/x", undefined, []).ok, true);
    assert.equal(officialSource("https://sportsauthorityofindia.nic.in/x", undefined, []).ok, true);
    assert.equal(officialSource("https://admission.jmi.ac.in/x", undefined, []).ok, true);
    assert.equal(officialSource("https://some.example/x", undefined, ["some.example"]).ok, true);
    assert.equal(officialSource("https://ammfoundation.org/x", "A.M.M. Foundation", []).ok, true);
    assert.equal(
      officialSource("https://indiakhelofootball.com/x", "India Khelo Football", []).ok,
      true
    );
  });

  it("officialSource: does not take a similar-looking host for the organiser's", () => {
    assert.equal(
      officialSource("https://ammfoundation-fake.example/x", "A.M.M. Foundation", []).ok,
      false
    );
    assert.equal(
      officialSource("https://tnasportsagency.com/x", "Tennis Federation", []).ok,
      false
    );
  });

  it("current: refuses rules for a year that is over, and an old document", () => {
    assert.deepEqual(failedBy({ cycleLabel: "2021-22" }), ["current"]);
    assert.deepEqual(failedBy({ sourcePublishedOn: "2021-12-03" }), ["current"]);
  });
});

describe("evidence rules", () => {
  it("every-field-quoted: a field with no quote holds the item", () => {
    const verdict = evaluateApproval(
      base({ citations: { title: "Khelo Football Trials", summary: "..." } })
    );
    assert.ok(verdict.failed.includes("every-field-quoted"));
    assert.match(
      verdict.rules.find((r: { id: string }) => r.id === "every-field-quoted").detail,
      /cost/
    );
  });

  it("every-field-quoted: nothing read is not a pass", () => {
    assert.ok(failedBy({ changes: [] }).includes("every-field-quoted"));
  });

  it("quotes-verified: only 'found' counts, not partial, scattered, unmatched or missing", () => {
    for (const status of ["partial", "scattered", "unmatched", "missing"]) {
      const verdict = evaluateApproval(
        base({
          checks: {
            against: "page-text",
            quotes: { title: "found", summary: status, cost: "found" },
            figures: { cost: "ok" },
            shared: {},
          },
        })
      );
      assert.deepEqual(verdict.failed, ["quotes-verified"], status);
    }
  });

  it("quotes-verified: a source whose text could not be compared is not verified", () => {
    assert.ok(
      failedBy({ checks: { against: "none", quotes: {}, figures: {}, shared: {} } }).includes(
        "quotes-verified"
      )
    );
    assert.ok(failedBy({ checks: null }).includes("quotes-verified"));
  });

  it("quotes-verified: a PDF's text counts when the quote was found in it", () => {
    assert.deepEqual(
      failedBy({
        checks: {
          against: "pdf-text",
          quotes: { title: "found", summary: "found", cost: "found" },
          figures: { cost: "ok" },
          shared: {},
        },
      }),
      []
    );
  });

  it("figures-match: a figure not in its quote, or never checked, holds the item", () => {
    assert.deepEqual(
      failedBy({
        checks: {
          against: "page-text",
          quotes: { title: "found", summary: "found", cost: "found" },
          figures: { cost: "mismatch" },
          shared: {},
        },
      }),
      ["figures-match"]
    );
    assert.deepEqual(
      failedBy({
        checks: {
          against: "page-text",
          quotes: { title: "found", summary: "found", cost: "found" },
          figures: {},
          shared: {},
        },
      }),
      ["figures-match"]
    );
  });

  it("quotes-not-shared: one quote across several fields holds the item", () => {
    assert.deepEqual(
      failedBy({
        checks: {
          against: "page-text",
          quotes: { title: "found", summary: "found", cost: "found" },
          figures: { cost: "ok" },
          shared: { summary: 3 },
        },
      }),
      ["quotes-not-shared"]
    );
  });

  it("no-conflicts: documents that disagree hold the item", () => {
    assert.deepEqual(failedBy({ conflicts: { cost: [{ url: "x", label: "y", value: 1 }] } }), [
      "no-conflicts",
    ]);
  });
});

describe("record rules", () => {
  it("complete: an entry that could not be published is held, with the reasons", () => {
    const verdict = evaluateApproval(
      base({ publishable: { ok: false, errors: ["sports: pick at least one sport"] } })
    );
    assert.deepEqual(verdict.failed, ["complete"]);
    assert.match(verdict.rules.find((r: { id: string }) => r.id === "complete").detail, /sport/);
  });

  it("plausible: a warning holds the item, a note does not", () => {
    assert.deepEqual(
      failedBy({
        findings: [{ severity: "warning", message: "The window closed on 2026-08-03." }],
      }),
      ["plausible"]
    );
    assert.deepEqual(failedBy({ findings: [{ severity: "note", message: "No steps." }] }), []);
  });

  it("right-scheme: a title that does not match the lead, or a duplicate, holds a new entry", () => {
    assert.deepEqual(failedBy({ titleMatchesLead: false }), ["right-scheme"]);
    assert.deepEqual(failedBy({ duplicateOf: "Khelo Football Trials" }), ["right-scheme"]);
  });

  it("right-scheme: does not apply to an update, and a reading not from a lead is not penalised", () => {
    assert.deepEqual(failedBy({ titleMatchesLead: undefined }), []);
    const ordinary = base({
      kind: "update",
      titleMatchesLead: false,
      duplicateOf: "X",
      changes: [
        { path: "summary", current: "old", proposed: "new" },
        {
          path: "cost",
          current: undefined,
          proposed: { kind: "fee", amount: 125, currency: "INR" },
        },
      ],
    });
    assert.deepEqual(evaluateApproval(ordinary).failed, []);
  });
});

describe("change rules, for an update to a live entry", () => {
  const update = (changes: unknown[], over: Record<string, unknown> = {}) => {
    const citations: Record<string, string> = {};
    const quotes: Record<string, string> = {};
    const figures: Record<string, string> = {};
    for (const change of changes as Array<{ path: string }>) {
      const top = change.path.split(".")[0]!;
      citations[top] = "a quote";
      quotes[top] = "found";
      if (
        [
          "eligibility.ageMin",
          "eligibility.ageMax",
          "benefit.amount",
          "cost",
          "cycle.opensOn",
          "cycle.closesOn",
          "cycle.keyDates",
        ].includes(change.path)
      ) {
        figures[change.path] = "ok";
      }
    }
    return base({
      kind: "update",
      changes,
      citations,
      checks: { against: "page-text", quotes, figures, shared: {} },
      titleMatchesLead: undefined,
      ...over,
    });
  };

  it("passes a small, ordinary update", () => {
    const verdict = evaluateApproval(
      update([
        { path: "cycle.closesOn", current: "2026-12-01", proposed: "2026-12-15" },
        { path: "steps", current: ["a"], proposed: ["a", "b"] },
      ])
    );
    assert.equal(verdict.pass, true, verdict.failed.join(", "));
  });

  it("identity-stable: never changes what the entry is, unseen", () => {
    for (const path of [
      "title",
      "category",
      "owner.name",
      "geography.scope",
      "sports",
      "allSports",
      "selection",
      "eligibility.gender",
    ]) {
      const verdict = evaluateApproval(update([{ path, current: "a", proposed: "b" }]));
      assert.ok(verdict.failed.includes("identity-stable"), path);
    }
  });

  it("no-big-swing: an amount or fee that more than doubles or halves is held", () => {
    const held = evaluateApproval(
      update([
        {
          path: "benefit.amount",
          current: { value: 100000 },
          proposed: { value: 100000 * (MAX_AMOUNT_FACTOR + 1) },
        },
      ])
    );
    assert.ok(held.failed.includes("no-big-swing"));
    const halved = evaluateApproval(
      update([
        {
          path: "cost",
          current: { amount: 1000 },
          proposed: { amount: 1000 / (MAX_AMOUNT_FACTOR + 1) },
        },
      ])
    );
    assert.ok(halved.failed.includes("no-big-swing"));
    const ok = evaluateApproval(
      update([{ path: "benefit.amount", current: { value: 100000 }, proposed: { value: 150000 } }])
    );
    assert.ok(!ok.failed.includes("no-big-swing"));
  });

  it("no-big-swing: an age bound or a window date that moves too far is held", () => {
    assert.ok(
      evaluateApproval(
        update([
          { path: "eligibility.ageMax", current: 14, proposed: 14 + MAX_AGE_SHIFT_YEARS + 1 },
        ])
      ).failed.includes("no-big-swing")
    );
    assert.ok(
      !evaluateApproval(
        update([{ path: "eligibility.ageMax", current: 14, proposed: 15 }])
      ).failed.includes("no-big-swing")
    );
    const far = new Date(
      Date.parse("2026-12-01T00:00:00Z") + (MAX_DATE_SHIFT_DAYS + 5) * 86_400_000
    )
      .toISOString()
      .slice(0, 10);
    assert.ok(
      evaluateApproval(
        update([{ path: "cycle.closesOn", current: "2026-12-01", proposed: far }])
      ).failed.includes("no-big-swing")
    );
  });

  it("no-big-swing: a value that did not exist before is not a swing", () => {
    assert.ok(
      !evaluateApproval(
        update([{ path: "benefit.amount", current: undefined, proposed: { value: 999999 } }])
      ).failed.includes("no-big-swing")
    );
  });

  it("small-update: a rewrite is held", () => {
    const many = Array.from({ length: MAX_ROWS_PER_UPDATE + 1 }, (_, i) => ({
      path: "keyFacts",
      current: [`a${i}`],
      proposed: [`b${i}`],
    }));
    assert.ok(evaluateApproval(update(many)).failed.includes("small-update"));
  });

  it("a new entry is not held by change rules", () => {
    const verdict = evaluateApproval(base());
    for (const id of ["identity-stable", "no-big-swing", "small-update"]) {
      assert.ok(verdict.rules.find((r: { id: string }) => r.id === id).ok, id);
    }
  });
});

describe("several broken rules", () => {
  it("lists every one that failed, so an editor sees the whole picture", () => {
    const verdict = evaluateApproval(
      base({
        cycleLabel: "2021-22",
        sourceUrls: ["https://buddy4study.com/x"],
        titleMatchesLead: false,
      })
    );
    assert.equal(verdict.pass, false);
    assert.deepEqual(verdict.failed.sort(), ["current", "official-source", "right-scheme"].sort());
  });
});
