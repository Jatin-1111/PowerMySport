import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guidance only suggests. The wizard used to PUT the parent's answers onto the child's profile
// after every run, silently. Any request that changes a child must go through the card the
// parent confirms (ProfileUpdateCard), so the wizard itself must not make one.
describe("the guidance wizard", () => {
  const source = readFileSync(join(__dirname, "ProblemWizardInner.tsx"), "utf8");

  it("does not write to a child's profile itself", () => {
    expect(source).not.toMatch(/auth\/dependents/);
    expect(source).not.toMatch(/\.put\(/);
    expect(source).not.toMatch(/updateDependent/);
  });

  it("hands the differing answers to the results screen as suggestions", () => {
    expect(source).toMatch(/profileSuggestions\(/);
    expect(source).toMatch(/suggestions=\{suggestions\}/);
  });
});
