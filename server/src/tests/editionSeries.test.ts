/* eslint-disable @typescript-eslint/no-var-requires */
// Pure unit tests for reading the series out of a tournament name.
//
// Every string here is a real name stem taken from production on 2026-09-17,
// not an invented one. The whole point of this parser is that it survives the
// vocabulary the federation actually uses, and a fixture set of tidy invented
// names would prove nothing about that.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { seriesFromEditionName, seriesLabel } = require("../shared/services/aita/editionSeries");

describe("the AITA junior ladder", () => {
  it("reads the rung and the printed grade", () => {
    const cs = seriesFromEditionName("AITA CS7 (Sonipat)");
    assert.equal(cs.ladder, "Championship Series");
    assert.equal(cs.grade, 7);
    assert.equal(cs.circuit, "AITA");
    assert.equal(cs.kind, "junior-ladder");

    const ts = seriesFromEditionName("AITA TS7 (Bengaluru)");
    assert.equal(ts.ladder, "Talent Series");
    assert.equal(ts.grade, 7);
  });

  it("handles a rung printed without a grade", () => {
    assert.deepEqual(seriesFromEditionName("AITA CS (Jaipur)"), {
      ladder: "Championship Series",
      grade: null,
      circuit: "AITA",
      kind: "junior-ladder",
    });
    assert.equal(seriesFromEditionName("AITA SS (Jorhat)").ladder, "Super Series");
    assert.equal(seriesFromEditionName("AITA NS (Belagavi)").ladder, "National Series");
  });

  it("does not confuse National Series with the Nationals", () => {
    // "NS" and "Nationals" are one letter apart in a name and a whole career
    // apart in practice: one is a weekly circuit event, the other is the
    // national championship a player qualifies for.
    assert.equal(seriesFromEditionName("AITA NS (Jalandhar)").ladder, "National Series");
    assert.equal(seriesFromEditionName("AITA Nationals").ladder, "Nationals");
    assert.equal(seriesFromEditionName("Nationals").ladder, "Nationals");
    assert.equal(seriesFromEditionName("National Tennis Championship").ladder, "Nationals");
  });

  it("reads the spelled-out form the official name uses", () => {
    assert.equal(
      seriesFromEditionName("Unrecognisable", "AITA CHAMPIONSHIP SERIES TOURNAMENT (SONIPAT)")
        .ladder,
      "Championship Series"
    );
    assert.equal(
      seriesFromEditionName("Unrecognisable", "AITA TALENT SERIES TOURNAMENT (BENGALURU)").ladder,
      "Talent Series"
    );
  });
});

describe("events a junior plan must not include", () => {
  it("keeps the senior prize-money circuit out of the ladder", () => {
    // These carry age groups of Men and Women. Reporting them as a ladder rung
    // would put an adult tournament in a twelve-year-old's plan.
    for (const name of ["AITA Rs 1 Lakh (Kolkata)", "AITA Rs 2.5 Lakh (Pune)"]) {
      const series = seriesFromEditionName(name);
      assert.equal(series.ladder, null);
      assert.equal(series.kind, "senior-prize-money");
    }
  });

  it("classifies masters and professional events", () => {
    assert.equal(seriesFromEditionName("ITF Masters (Delhi)").kind, "masters");
    assert.equal(seriesFromEditionName("AITA ITF Masters (Delhi)").kind, "masters");
    assert.equal(seriesFromEditionName("WTA 250 (Chennai)").kind, "pro-tour");
  });

  it("keeps the two professional tours apart", () => {
    // One rule matching (WTA|ATP) and returning "WTA" filed every ATP event
    // under the women's tour, which is both wrong and unnoticeable — each tour
    // has its own federation page to be sorted onto.
    const atp = seriesFromEditionName("ATP Challenger (Bengaluru)");
    assert.equal(atp.circuit, "ATP");
    assert.equal(atp.kind, "pro-tour");

    const wta = seriesFromEditionName("WTA 250 (Chennai)");
    assert.equal(wta.circuit, "WTA");
    assert.equal(wta.kind, "pro-tour");
  });

  it("recognises a UTR event without putting it on the ladder", () => {
    // No UTR calendar is sourced yet, so this pins the rule ahead of the data:
    // the first one ingested must not read as unknown, and must never come back
    // as a rung a junior is told to climb.
    const utr = seriesFromEditionName("UTR Pro Tennis Series (Pune)");
    assert.equal(utr.circuit, "UTR");
    assert.equal(utr.kind, "rating-circuit");
    assert.equal(utr.ladder, null);
    assert.equal(utr.grade, null);
  });

  it("does not let a prize-money name fall through to a ladder rule", () => {
    // "Rs 2.5 Lakh" contains no series token, but a sloppier rule order could
    // still reach one through a city or a stray letter pair.
    const series = seriesFromEditionName("AITA Rs 2.5 Lakh (Chandigarh)");
    assert.equal(series.ladder, null);
  });
});

describe("international junior events", () => {
  it("separates ITF from the Asian federation", () => {
    assert.equal(seriesFromEditionName("ITF Juniors (Chandigarh)").circuit, "ITF");
    assert.equal(seriesFromEditionName("AITA ITF Juniors (Delhi)").circuit, "ITF");
    assert.equal(seriesFromEditionName("AITA Asian (Ahmedabad)").circuit, "ATF");
    assert.equal(seriesFromEditionName("Asian U/12 (Bhubaneswar)").circuit, "ATF");
  });

  it("leaves an Asian letter grade out of the numeric grade", () => {
    // "Grade A" is a different scale from the number in CS7. One field cannot
    // mean both without meaning nothing.
    const series = seriesFromEditionName("Asian Grade A (Delhi)");
    assert.equal(series.grade, null);
    assert.equal(series.kind, "international-junior");
  });
});

describe("what it refuses to guess", () => {
  it("returns unknown rather than inventing a rung", () => {
    for (const name of ["AITA", "", "Some Club Open (Mohali)"]) {
      const series = seriesFromEditionName(name);
      assert.equal(series.ladder, null);
      assert.equal(series.kind, "unknown");
    }
  });

  it("never reads a series out of the city in brackets", () => {
    // A city called e.g. "Nashik" must not match a rule, and the bracketed
    // suffix is stripped before matching precisely so it cannot.
    assert.equal(seriesFromEditionName("Some Open (Nationals City)").ladder, null);
  });
});

describe("the label", () => {
  it("names the grade only when there is one", () => {
    assert.equal(seriesLabel(seriesFromEditionName("AITA CS7 (X)")), "Championship Series grade 7");
    assert.equal(seriesLabel(seriesFromEditionName("AITA CS (X)")), "Championship Series");
  });

  it("says something true for non-ladder events, or nothing at all", () => {
    assert.equal(
      seriesLabel(seriesFromEditionName("AITA Rs 1 Lakh (X)")),
      "AITA prize-money event"
    );
    assert.equal(seriesLabel(seriesFromEditionName("ITF Juniors (X)")), "ITF junior event");
    assert.equal(seriesLabel(seriesFromEditionName("ATP Challenger (X)")), "ATP tour event");
    assert.equal(seriesLabel(seriesFromEditionName("WTA 250 (X)")), "WTA tour event");
    assert.equal(seriesLabel(seriesFromEditionName("UTR Pro Series (X)")), "UTR rated event");
    assert.equal(seriesLabel(seriesFromEditionName("AITA")), null);
  });
});
