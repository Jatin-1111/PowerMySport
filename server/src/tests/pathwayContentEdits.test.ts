// The reviewed rewrites of the long chess answers. They are formatting only, so
// this holds each one to that: the words are the original's (apart from the
// closing "and" a bullet list makes redundant, and the numbers on the FIDE
// titles), no em dash survives, and each result fits the server's limits and
// needs no further tidying.

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { CHESS_FORMAT_EDITS } = require("../scripts/pathwayChessFormatEdits");
const { statusOf } = require("../scripts/applyPathwayContentEdits");
const { cleanFieldText } = require("../scripts/cleanPathwayRichText");

type Edit = {
  stageKey: string;
  label: string;
  kind: string;
  old: string;
  next: string;
};

/** Letters and digits only, so punctuation, dashes and layout drop out of the comparison. */
const tokens = (text: string) =>
  (text
    .toLowerCase()
    .replace(/’/g, "'")
    .match(/[a-z0-9']+/g) ?? []) as string[];

function difference(before: string[], after: string[]) {
  const count = (list: string[]) =>
    list.reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {});
  const a = count(before);
  const b = count(after);
  const removed: string[] = [];
  const added: string[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const delta = (b[key] ?? 0) - (a[key] ?? 0);
    for (let i = 0; i < Math.abs(delta); i += 1) (delta < 0 ? removed : added).push(key);
  }
  return { removed, added };
}

describe("chess format edits", () => {
  it("covers the ten long blocks, once each", () => {
    assert.equal(CHESS_FORMAT_EDITS.length, 10);
    const ids = CHESS_FORMAT_EDITS.map((e: Edit) => `${e.stageKey}/${e.label}`);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("changes the layout of every field", () => {
    for (const edit of CHESS_FORMAT_EDITS as Edit[]) {
      assert.notEqual(edit.next, edit.old, `${edit.stageKey}/${edit.label}`);
      assert.ok(edit.next.includes("\n"), `${edit.stageKey}/${edit.label} should be split up`);
    }
  });

  it("keeps the original's words: only a closing 'and' and the title numbers differ", () => {
    for (const edit of CHESS_FORMAT_EDITS as Edit[]) {
      const { removed, added } = difference(tokens(edit.old), tokens(edit.next));
      assert.ok(
        removed.every((word) => word === "and") && removed.length <= 1,
        `${edit.stageKey}/${edit.label} lost words: ${removed.join(", ")}`
      );
      assert.ok(
        added.every((word) => /^[1-4]$/.test(word)),
        `${edit.stageKey}/${edit.label} gained words: ${added.join(", ")}`
      );
    }
  });

  it("leaves no em dash", () => {
    for (const edit of CHESS_FORMAT_EDITS as Edit[]) {
      assert.ok(!edit.next.includes("—"), `${edit.stageKey}/${edit.label}`);
    }
  });

  it("fits the server's limits and needs no further tidying", () => {
    for (const edit of CHESS_FORMAT_EDITS as Edit[]) {
      const limit = edit.kind === "overview" ? 1500 : 2000;
      assert.ok(
        edit.next.length <= limit,
        `${edit.stageKey}/${edit.label} is ${edit.next.length} characters`
      );
      assert.deepEqual(cleanFieldText(edit.next).kinds, [], `${edit.stageKey}/${edit.label}`);
      assert.equal(edit.next, edit.next.trim());
    }
  });
});

describe("statusOf", () => {
  const edit = CHESS_FORMAT_EDITS[0] as Edit;

  it("says what the database holds relative to the reviewed text", () => {
    assert.equal(statusOf(edit, edit.old), "will change");
    assert.equal(statusOf(edit, edit.next), "already applied");
    assert.equal(
      statusOf(edit, "Someone edited this since."),
      "text has changed since it was reviewed"
    );
    assert.equal(statusOf(edit, undefined), "not found");
  });
});

const { TENNIS_POINTS_EDITS } = require("../scripts/pathwayTennisPointsEdits");

describe("tennis points edit", () => {
  const edit = TENNIS_POINTS_EDITS[0] as Edit;

  it("replaces the table that was live and fits the limit", () => {
    assert.equal(TENNIS_POINTS_EDITS.length, 1);
    assert.ok(edit.old.includes("| Talent Series (TS) | 10 | 7 | 5 | 3 | 1 |"));
    assert.ok(edit.next.length <= 2000);
    assert.equal(edit.next, edit.next.trim());
    assert.ok(!edit.next.includes("—"));
    assert.deepEqual(cleanFieldText(edit.next).kinds, []);
  });

  it("carries AITA's published figures, row by row", () => {
    const rows = edit.next.split("\n").filter((l) => l.startsWith("| ") && !l.includes("---"));
    const cells = (row: string) =>
      row
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
    const table = Object.fromEntries(rows.slice(1).map((r) => [cells(r)[0], cells(r).slice(1)]));
    assert.deepEqual(table["Talent Series (7 days)"], ["-", "2", "6", "8", "10", "12", "15"]);
    assert.deepEqual(table["Championship Series (3 days)"], ["-", "1", "3", "4", "6", "8", "10"]);
    assert.deepEqual(table["Championship Series (7 days)"], [
      "-",
      "4",
      "8",
      "10",
      "15",
      "20",
      "25",
    ]);
    assert.deepEqual(table["Super Series"], ["-", "5", "10", "20", "30", "40", "50"]);
    assert.deepEqual(table["National Series"], ["5", "10", "20", "30", "40", "50", "75"]);
    assert.deepEqual(table["Nationals"], ["20", "40", "60", "80", "100", "150", "200"]);
    for (const r of rows) assert.equal(cells(r).length, 8);
  });
});
