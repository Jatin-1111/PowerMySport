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
