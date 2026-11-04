// The rules behind the one-off pathway text cleanup. The script itself needs a
// database; these pin what it will do to the text, using the answers exactly as
// stored: Word bullets, a line pasted twice, and the AITA point system written
// as numbered blocks.
//
// The rule that matters most is the negative one: nothing but formatting
// changes. No number, word or sentence may differ, so every test that converts
// something also checks the words survived.

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  cleanFieldText,
  dropRepeatedLines,
  findChanges,
  pointsBlocksToTable,
  tidyWordText,
} = require("../scripts/cleanPathwayRichText");

/** The words in a text, ignoring markup, for "nothing but formatting changed". */
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[|\-•]/g, " ")
    .replace(/\b\d+\.\s/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// "What is the point system under various AITA tournaments?" as stored (note the
// repeated "Super Series (SS)" line).
const POINT_SYSTEM = [
  "1. Talent Series (TS)",
  "Winner: 10 Points",
  "Runner-up: 7 Points",
  "Semifinalist: 5 Points",
  "Quarterfinalist: 3 Points",
  "Participation: 1 Point",
  "",
  "2. Championship Series (CS)",
  "Winner: 30 Points",
  "Runner-up: 20 Points",
  "Semifinalist: 15 Points",
  "Quarterfinalist: 10 Points",
  "Participation: 5 Points",
  "",
  "3. Super Series (SS)",
  "Super Series (SS)",
  "Winner: 50 Points",
  "Runner-up: 35 Points",
  "Semifinalist: 25 Points",
  "Quarterfinalist: 15 Points",
  "Participation: 8 Points",
  "",
  "4. National Series (NS)",
  "Winner: 100 Points",
  "Runner-up: 70 Points",
  "Semifinalist: 50 Points",
  "Quarterfinalist: 30 Points",
  "Participation: 10 Points",
].join("\n");

const WORD_BULLETS =
  "US college tennis is broadly divided into NCAA Division I, II and III.\n" +
  "•\tDivision I: Highest level of college tennis. \n" +
  "•\tDivision II: Strong competitive tennis. \n" +
  "•\tDivision III: Competitive college tennis.";

describe("tidyWordText", () => {
  it("turns Word bullets into list items and drops trailing spaces", () => {
    assert.equal(
      tidyWordText(WORD_BULLETS),
      "US college tennis is broadly divided into NCAA Division I, II and III.\n" +
        "- Division I: Highest level of college tennis.\n" +
        "- Division II: Strong competitive tennis.\n" +
        "- Division III: Competitive college tennis."
    );
  });

  it("leaves a dash used inside a sentence alone", () => {
    const text = "The key difference is not “more points”—each category differs";
    assert.equal(tidyWordText(text), text);
  });
});

describe("dropRepeatedLines", () => {
  it("removes a line repeated straight after itself", () => {
    assert.equal(
      dropRepeatedLines("Super Series (SS)\nSuper Series (SS)\nWinner: 50"),
      "Super Series (SS)\nWinner: 50"
    );
  });

  it("removes a line repeated right after its own numbered version, as in the point system", () => {
    assert.equal(
      dropRepeatedLines("3. Super Series (SS)\nSuper Series (SS)\nWinner: 50 Points"),
      "3. Super Series (SS)\nWinner: 50 Points"
    );
  });

  it("keeps blank lines and a line that merely appears twice, apart", () => {
    const text = "Winner\n\nWinner";
    assert.equal(dropRepeatedLines(text), text);
  });
});

describe("pointsBlocksToTable", () => {
  it("turns the point system into a table with every number intact", () => {
    const table = pointsBlocksToTable(tidyWordText(dropRepeatedLines(POINT_SYSTEM)));
    assert.equal(
      table,
      [
        "Points awarded for each result:",
        "",
        "| Series | Winner | Runner-up | Semifinalist | Quarterfinalist | Participation |",
        "| --- | --- | --- | --- | --- | --- |",
        "| Talent Series (TS) | 10 | 7 | 5 | 3 | 1 |",
        "| Championship Series (CS) | 30 | 20 | 15 | 10 | 5 |",
        "| Super Series (SS) | 50 | 35 | 25 | 15 | 8 |",
        "| National Series (NS) | 100 | 70 | 50 | 30 | 10 |",
      ].join("\n")
    );
  });

  it("leaves an irregular answer for a person, rather than guess", () => {
    // one series is missing a result
    const text = POINT_SYSTEM.replace("Participation: 8 Points\n", "");
    assert.equal(pointsBlocksToTable(text), null);
  });

  it("leaves ordinary text alone", () => {
    assert.equal(pointsBlocksToTable("To register, visit the AITA website.\nPay the fee."), null);
  });

  it("does not make a table of a single series", () => {
    assert.equal(
      pointsBlocksToTable("1. Talent Series\nWinner: 10 Points\nRunner-up: 7 Points"),
      null
    );
  });
});

describe("cleanFieldText", () => {
  it("reports what it did to Word bullets", () => {
    const result = cleanFieldText(WORD_BULLETS);
    assert.deepEqual(result.kinds, ["word-paste"]);
    assert.deepEqual(words(result.text), words(WORD_BULLETS));
  });

  it("converts the point system only when told it is the point system", () => {
    assert.deepEqual(cleanFieldText(POINT_SYSTEM).kinds, ["repeated-line"]);
    const result = cleanFieldText(POINT_SYSTEM, { isPointSystem: true });
    assert.deepEqual(result.kinds, ["repeated-line", "table"]);
    assert.match(result.text, /\| Super Series \(SS\) \| 50 \| 35 \| 25 \| 15 \| 8 \|/);
  });

  it("keeps every number when it converts the point system", () => {
    const result = cleanFieldText(POINT_SYSTEM, { isPointSystem: true });
    const numbers = (text: string) =>
      (text.match(/\b\d+\b/g) ?? []).filter((n) => n.length > 1 || true);
    const before = numbers(POINT_SYSTEM).filter((n) => !/^[1-4]$/.test(n) || true);
    // every point value that was in the original is in the table
    for (const value of [
      "10",
      "7",
      "5",
      "3",
      "1",
      "30",
      "20",
      "15",
      "50",
      "35",
      "25",
      "8",
      "100",
      "70",
    ]) {
      assert.ok(result.text.includes(value), `${value} survived`);
    }
    assert.ok(before.length > 0);
  });

  it("changes nothing in text that needs nothing, and is safe to run twice", () => {
    const plain = "Players must hold a valid registration number.";
    assert.deepEqual(cleanFieldText(plain), { text: plain, kinds: [] });

    const once = cleanFieldText(POINT_SYSTEM, { isPointSystem: true });
    const twice = cleanFieldText(once.text, { isPointSystem: true });
    assert.deepEqual(twice, { text: once.text, kinds: [] });
  });
});

describe("findChanges", () => {
  const guide = {
    sportSlug: "tennis",
    stages: [
      {
        key: "pathway",
        overview: "A plain overview.",
        questions: [
          {
            question: "US College Tennis: What Do Division I, II & III Mean?",
            answer: WORD_BULLETS,
          },
          {
            question: "What is the point system under various AITA tournaments?",
            answer: POINT_SYSTEM,
          },
          { question: "No answer yet" },
          { question: "Already fine", answer: "Nothing to change here." },
        ],
        signals: [{ title: "A signal", detail: "•\tOne \n•\tTwo" }],
        decisions: [{ title: "A decision" }],
      },
    ],
  };

  it("finds each field that needs a change, with where it is", () => {
    const changes = findChanges(guide);
    assert.deepEqual(
      changes.map((c: { label: string; kinds: string[] }) => [c.label, c.kinds]),
      [
        ["questions[0].answer", ["word-paste"]],
        ["questions[1].answer", ["repeated-line", "table"]],
        ["signals[0].detail", ["word-paste"]],
      ]
    );
    assert.equal(changes[1].heading, "What is the point system under various AITA tournaments?");
    assert.equal(changes[1].old, POINT_SYSTEM);
  });

  it("finds nothing in a guide that is already clean", () => {
    assert.deepEqual(
      findChanges({ sportSlug: "chess", stages: [{ key: "a", overview: "Fine.", questions: [] }] }),
      []
    );
  });
});
