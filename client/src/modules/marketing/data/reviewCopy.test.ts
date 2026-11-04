import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { HOW_STEPS } from "./howItWorksSteps";
import { EXAMPLE_CHILD, MY_CHILD_ROWS } from "./myChildExample";

// The website review of 21 Oct 2026. These pin the wording the review asked for, so a later
// edit to one place does not quietly undo it.
describe("homepage copy from the 21 Oct review", () => {
  it("How it works uses the review's five headings, in order", () => {
    expect(HOW_STEPS.map((s) => s.title)).toEqual([
      "Select",
      "Understands",
      "Recommends",
      "Execute",
      "Learns",
    ]);
  });

  it("every step has a one-line description", () => {
    for (const step of HOW_STEPS) expect(step.body.length).toBeGreaterThan(30);
  });

  it("the My Child example card has the review's five rows", () => {
    expect(MY_CHILD_ROWS.map((r) => [r.label, r.summary])).toEqual([
      ["Profile", "Intermediate player, 2 years playing."],
      ["Goal", "Become a professional player."],
      ["Progress", "AITA rank: 150. Played 2 tournaments this year."],
      ["Tournament calendar", "Not created."],
      ["Open actions", "Check-in due for upcoming SS tournament."],
    ]);
  });

  it("the example child is old enough to have a rank and play a Super Series event", () => {
    expect(EXAMPLE_CHILD.summary).toMatch(/^13 years old/);
  });
});

describe("one name for the call to action", () => {
  const SRC = join(__dirname, "../../..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return files(full);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });

  it("no screen still says Get guidance; it is Talk to PMS everywhere", () => {
    const offenders = files(SRC)
      .filter((f) => /Get guidance/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f).split(sep).join("/"));

    expect(offenders).toEqual([]);
  });
});
