// The mechanical checks on a reading: is it the scheme the lead was about, is the
// year it is for out of date, and is the who-line free of cost wording. Each case
// below is one that was seen on a real reading, or the near miss of one.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  staleCycleReason,
  stripCostWording,
  titleMatchesLead,
} = require("../admin/services/dataSourceExtraction/opportunityChecks");
const {
  cleanOpportunityExtraction,
} = require("../admin/services/dataSourceExtraction/opportunity");

describe("titleMatchesLead", () => {
  it("refuses the wrong scheme that came from the same foundation's page", () => {
    // The real case: a lead for a sports scholarship, a draft of a college scheme.
    assert.equal(
      titleMatchesLead(
        "Murugappa Raising Talent Sports Scholarship (MRTSS)",
        "AMM Murugappa Chettiar Centenary Scholarship"
      ),
      false
    );
  });

  it("accepts the same scheme named a little differently", () => {
    assert.equal(titleMatchesLead("Khelo Football Trials", "India Khelo Football (IKF)"), true);
    assert.equal(
      titleMatchesLead("GIIS Global Sports Scholarship", "GIIS Global Sports Scholarship 2026-27"),
      true
    );
  });

  it("ignores words that only say what kind of thing it is", () => {
    assert.equal(
      titleMatchesLead("Sports Scholarship Scheme", "National Sports Scholarship Programme"),
      true,
      "nothing distinctive on either side means nothing to compare, so it does not block"
    );
    assert.equal(titleMatchesLead("Tata Sports Scholarship", "Reliance Sports Scholarship"), false);
  });

  it("does not block when a name has nothing distinctive to compare", () => {
    assert.equal(titleMatchesLead("The Scheme", "Anything At All"), true);
    assert.equal(titleMatchesLead("Khelo", ""), true);
  });

  it("is not fooled by an abbreviation in brackets or by a year", () => {
    assert.equal(
      titleMatchesLead(
        "ONGC Sports Scholarship 2026-27 (Podium Aspirants)",
        "ONGC Sports Scholarship"
      ),
      true
    );
  });
});

describe("staleCycleReason", () => {
  const NOW = new Date("2026-10-15T00:00:00Z");

  it("says a past cycle is out of date", () => {
    assert.match(staleCycleReason("2021-22", undefined, NOW), /2021-22.*out of date/);
    assert.match(staleCycleReason("2023", undefined, NOW), /out of date/);
  });

  it("leaves the current and the just-ended cycle alone", () => {
    assert.equal(staleCycleReason("2026-27", undefined, NOW), null);
    assert.equal(staleCycleReason("2025-26", undefined, NOW), null);
    assert.equal(staleCycleReason("2025-2026", undefined, NOW), null);
    assert.equal(staleCycleReason("2025", undefined, NOW), null);
  });

  it("reads the year a two-digit span ends in", () => {
    // 2024-25 ends 2025, which is not older than last year.
    assert.equal(staleCycleReason("2024-25", undefined, NOW), null);
    assert.match(staleCycleReason("2022-23", undefined, NOW), /out of date/);
  });

  it("says a document years old is out of date, and a recent one is not", () => {
    assert.match(staleCycleReason(undefined, "2021-12-03", NOW), /from 2021/);
    assert.equal(staleCycleReason(undefined, "2025-03-01", NOW), null);
  });

  it("says nothing when it has nothing to go on", () => {
    assert.equal(staleCycleReason(undefined, undefined, NOW), null);
    assert.equal(staleCycleReason("Rolling", undefined, NOW), null);
  });
});

describe("stripCostWording", () => {
  it("takes the free-entry clause out of the real IKF line", () => {
    assert.equal(
      stripCostWording(
        "Open to aspiring football players; participation is free for girls and underprivileged children with valid proof."
      ),
      "Open to aspiring football players"
    );
  });

  it("takes a trailing cost tail off a clause that is otherwise about who", () => {
    assert.equal(
      stripCostWording("Aspiring footballers of any age, and free for girls"),
      "Aspiring footballers of any age"
    );
  });

  it("keeps an income limit, which is a rule and not a cost", () => {
    const line =
      "Students with national/international sports repute, 70% academic marks, and annual family income under INR 5 Lacs.";
    assert.equal(stripCostWording(line), line.replace(/\.$/, ""));
  });

  it("leaves a line with no cost wording as it was", () => {
    assert.equal(
      stripCostWording("Grades 7 to 12, state level or above"),
      "Grades 7 to 12, state level or above"
    );
  });

  it("returns nothing when all that was said was about cost", () => {
    assert.equal(stripCostWording("Free for everyone."), undefined);
    assert.equal(stripCostWording(undefined), undefined);
  });
});

describe("cleaning a reading uses them", () => {
  const clean = (raw: Record<string, unknown>) => cleanOpportunityExtraction(raw, "admission");

  it("keeps cost wording out of the who-line, wherever the model put it", () => {
    const { fields } = clean({
      eligibility: { summary: "Open to aspiring players; participation is free for girls." },
    });
    assert.equal(fields.eligibility.summary, "Open to aspiring players");
  });

  it("warns when the rules read are for a year that is over", () => {
    const { warnings } = clean({ cycle: { label: "2021-22" } });
    assert.ok(warnings.some((w: string) => /2021-22.*out of date/.test(w)));
  });

  it("does not warn about a current cycle", () => {
    const year = new Date().getUTCFullYear();
    const { warnings } = clean({ cycle: { label: `${year}-${String(year + 1).slice(2)}` } });
    assert.equal(warnings.filter((w: string) => /out of date/.test(w)).length, 0);
  });
});
