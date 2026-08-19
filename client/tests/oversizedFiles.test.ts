import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import budget from "./oversizedFiles.json";

/**
 * A ratchet on the size of files in `src/app`.
 *
 * R6's target is that `src/app` holds routing and composition only — no file
 * over ~400 lines. Fifty files exceed that today, 43,000 lines between them, the
 * largest at 2,210. Splitting them in one sweep is the exact thing the audit
 * warned against: a refactor with no functional change, touching every
 * high-traffic page at once, on a codebase whose signed-in paths cannot be
 * exercised in CI. So the audit's prescription was to split each page when it is
 * next opened for real work.
 *
 * That prescription needs a mechanism, or "next time" never arrives and the list
 * quietly grows. This is the mechanism:
 *
 *   - A new file over the limit fails. The debt cannot grow by count.
 *   - An existing oversized file that gets LONGER fails. The debt cannot grow by
 *     size, so the pages already too big are now one-way valves.
 *   - A file that drops under the limit fails until its entry is deleted, which
 *     makes progress visible in the diff and stops the budget rotting.
 *
 * The numbers here are debt, not a standard. Every deleted line is a win and
 * every deleted entry is a page that came back under control.
 */

const LIMIT = 400;
const SRC = path.resolve(__dirname, "../src");
const recorded = budget as Record<string, number>;

const lineCount = (rel: string) =>
  fs.readFileSync(path.join(SRC, rel), "utf8").split("\n").length;

const actual = (() => {
  const found: Record<string, number> = {};
  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        const rel = path.relative(SRC, full).split(path.sep).join("/");
        const n = fs.readFileSync(full, "utf8").split("\n").length;
        if (n > LIMIT) found[rel] = n;
      }
    }
  })(path.join(SRC, "app"));
  return found;
})();

it("reads a non-empty budget", () => {
  // Guards against the ratchet passing vacuously if the JSON is emptied or the
  // walk stops finding files.
  expect(Object.keys(recorded).length).toBeGreaterThan(0);
});

it("has no new oversized file in src/app", () => {
  const added = Object.keys(actual)
    .filter((f) => !(f in recorded))
    .map((f) => `${f} (${actual[f]} lines)`);
  expect(
    added,
    `New file(s) over ${LIMIT} lines in src/app. src/app is for routing and composition: move the logic into src/modules/<feature>/ and keep the route as a shell.`,
  ).toEqual([]);
});

describe("existing oversized files do not grow", () => {
  it.each(Object.entries(recorded))("%s (budget %i lines)", (file, max) => {
    if (!fs.existsSync(path.join(SRC, file))) return; // handled below
    expect(
      lineCount(file),
      `${file} is over the ${LIMIT}-line limit already; it must not get longer. Extract the part you are adding to into src/modules/ instead, and lower the number in tests/oversizedFiles.json.`,
    ).toBeLessThanOrEqual(max);
  });
});

it("has no stale budget entries", () => {
  // Deleting the entry is how progress gets recorded, so this failing is good
  // news with one edit attached.
  const stale = Object.keys(recorded)
    .filter((f) => !(f in actual))
    .map((f) =>
      fs.existsSync(path.join(SRC, f))
        ? `${f} is now ${lineCount(f)} lines — under the limit, so delete its entry`
        : `${f} no longer exists — delete its entry`,
    );
  expect(stale).toEqual([]);
});
