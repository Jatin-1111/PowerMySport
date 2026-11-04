/* eslint-disable @typescript-eslint/no-var-requires */
// The words that describe a child are declared once, in packages/shared-types/src/child.ts.
//
// They used to be typed out by hand in up to ten places; a value added in one and missed in
// another made a save fail or a chip disappear. This pins the model and the validation to the
// shared lists, and fails if anyone types one of the lists out again.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, describe, it } = require("node:test");

const shared = require("@powermysport/shared-types");
const { Player } = require("../client/models/Player");
const { addDependentSchema, updateDependentSchema } = require("../middleware/schemas");
const redis = require("../config/redis").default;

after(() => {
  redis.disconnect();
});

const LISTS: Array<[string, readonly string[], string]> = [
  ["ambition", shared.CHILD_AMBITIONS, "ambition"],
  ["budget range", shared.CHILD_BUDGET_RANGES, "budgetRange"],
  ["weekly hours", shared.CHILD_WEEKLY_HOURS, "weeklyHoursCategory"],
  ["experience level", shared.CHILD_EXPERIENCE_LEVELS, "experienceLevel"],
  ["training type", shared.CHILD_TRAINING_TYPES, "trainingType"],
  ["gender", shared.CHILD_GENDERS, "gender"],
];

describe("the child vocabulary", () => {
  for (const [name, values, field] of LISTS) {
    it(`the model stores exactly the shared ${name} values`, () => {
      assert.deepEqual([...Player.schema.path(field).enumValues].sort(), [...values].sort());
    });
  }

  for (const [name, values, field] of LISTS.filter(([, , f]) => f !== "gender")) {
    it(`the validation accepts every shared ${name} value and nothing else`, () => {
      for (const value of values) {
        assert.equal(updateDependentSchema.safeParse({ [field]: value }).success, true, value);
      }
      assert.equal(updateDependentSchema.safeParse({ [field]: "not-a-value" }).success, false);
      assert.equal(
        addDependentSchema.safeParse({ name: "Riya", [field]: "not-a-value" }).success,
        false
      );
    });
  }

  it("is not typed out by hand anywhere else in the apps", () => {
    const root = path.resolve(__dirname, "../../..");
    const copies = [
      '"fun" | "competitive"',
      '"under-3k" | "3k-7k"',
      '"1-3" | "4-7"',
      '"beginner" | "intermediate" | "competitive"',
      '"self" | "club" | "academy" | "private"',
      '"MALE" | "FEMALE" | "OTHER"',
    ];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", "dist", ".next", ".git", "tests", "migrations"].includes(entry.name))
          continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "shared-types") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf8");
          for (const copy of copies) {
            if (text.includes(copy)) found.push(`${path.relative(root, full)}: ${copy}`);
          }
        }
      }
    };
    for (const app of ["server/src", "client/src", "admin/src", "community/src"]) {
      const dir = path.join(root, app);
      if (fs.existsSync(dir)) walk(dir);
    }

    assert.deepEqual(
      found,
      [],
      `These re-declare a child vocabulary list; import it from @powermysport/shared-types instead:\n${found.join("\n")}`
    );
  });
});
