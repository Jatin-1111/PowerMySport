import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  formatStageGuideIssues,
  StageGuideSchema,
} from "../shared/validation/stageGuideFormat";

const examplePath = path.join(
  __dirname,
  "../shared/validation/stageGuide.tennis.example.json",
);
const example = JSON.parse(readFileSync(examplePath, "utf8")) as unknown;

/** The example is the template authors copy — it must always be valid. */
test("the shipped tennis example matches the format", () => {
  const parsed = StageGuideSchema.safeParse(example);
  if (!parsed.success) {
    assert.fail(
      `Example is invalid:\n${formatStageGuideIssues(parsed.error).join("\n")}`,
    );
  }
  assert.equal(parsed.data.sport.slug, "tennis");
  assert.ok(parsed.data.stages.length >= 4);
  // Defaults fill in, so readers never have to null-check the arrays.
  const first = parsed.data.stages[0]!;
  assert.deepEqual(first.funding, []);
  assert.ok(Array.isArray(first.readinessChecklist));
});

const valid = () => JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
const stagesOf = (g: Record<string, unknown>) =>
  g.stages as Array<Record<string, unknown>>;
/** Index into the stages of a throwaway clone; the example always has these. */
const stage = (g: Record<string, unknown>, i: number) => stagesOf(g)[i]!;

test("stage numbers must run 1..n with no gaps", () => {
  const g = valid();
  stage(g, 2).number = 9;
  const parsed = StageGuideSchema.safeParse(g);
  assert.equal(parsed.success, false);
  assert.match(
    formatStageGuideIssues(parsed.error!).join("\n"),
    /Expected number 3, got 9/,
  );
});

test("duplicate stage keys are rejected", () => {
  const g = valid();
  stage(g, 1).key = stage(g, 0).key;
  const parsed = StageGuideSchema.safeParse(g);
  assert.equal(parsed.success, false);
  assert.match(formatStageGuideIssues(parsed.error!).join("\n"), /Duplicate stage key/);
});

test("movingUp cannot point at a stage that doesn't exist", () => {
  const g = valid();
  stage(g, 0).movingUp = { toStageKey: "nowhere", criteria: [] };
  const parsed = StageGuideSchema.safeParse(g);
  assert.equal(parsed.success, false);
  assert.match(formatStageGuideIssues(parsed.error!).join("\n"), /No stage has key "nowhere"/);
});

test("summary repeating shortDescription is rejected", () => {
  // The most common authoring slip: the panel restating the stage list.
  const g = valid();
  stage(g, 0).summary = "Explore if tennis is right for your child!";
  const parsed = StageGuideSchema.safeParse(g);
  assert.equal(parsed.success, false);
  assert.match(
    formatStageGuideIssues(parsed.error!).join("\n"),
    /summary repeats shortDescription/,
  );
});

test("a guide with no sources is rejected", () => {
  const g = valid();
  g.sources = [];
  const parsed = StageGuideSchema.safeParse(g);
  assert.equal(parsed.success, false);
  assert.match(
    formatStageGuideIssues(parsed.error!).join("\n"),
    /At least one source is required/,
  );
});

test("issues are reported with a usable path", () => {
  const g = valid();
  (stage(g, 3).funding as Array<Record<string, unknown>>)[0]!.benefit = "";
  const parsed = StageGuideSchema.safeParse(g);
  assert.equal(parsed.success, false);
  const issues = formatStageGuideIssues(parsed.error!);
  assert.ok(
    issues.some((i) => i.startsWith("stages[3].funding[0].benefit:")),
    `Expected a pathed issue, got:\n${issues.join("\n")}`,
  );
});

test("an unknown formatVersion is refused rather than half-read", () => {
  const g = valid();
  g.formatVersion = 2;
  assert.equal(StageGuideSchema.safeParse(g).success, false);
});
