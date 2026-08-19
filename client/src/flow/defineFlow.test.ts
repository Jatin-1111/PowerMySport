import { describe, expect, it } from "vitest";
import {
  buildStepGateFlow,
  defineFlow,
  flowParam,
  furthestReachableIndex,
  resolveStep,
} from "./defineFlow";

type CheckoutContext = { hasDetails: boolean; hasMethod: boolean };

const CHECKOUT = defineFlow<"review" | "payment" | "confirm", CheckoutContext>({
  id: "checkout",
  steps: ["review", "payment", "confirm"],
  canEnter: {
    payment: (c) => c.hasDetails,
    confirm: (c) => c.hasDetails && c.hasMethod,
  },
});

const ready: CheckoutContext = { hasDetails: true, hasMethod: true };
const detailsOnly: CheckoutContext = { hasDetails: true, hasMethod: false };
const empty: CheckoutContext = { hasDetails: false, hasMethod: false };

describe("flowParam", () => {
  it("defaults to step, and honours an override", () => {
    expect(flowParam(CHECKOUT)).toBe("step");
    expect(flowParam({ ...CHECKOUT, param: "stage" })).toBe("stage");
  });
});

describe("furthestReachableIndex", () => {
  it("stops at the first unmet condition rather than the highest passing one", () => {
    expect(furthestReachableIndex(CHECKOUT, empty)).toBe(0);
    expect(furthestReachableIndex(CHECKOUT, detailsOnly)).toBe(1);
    expect(furthestReachableIndex(CHECKOUT, ready)).toBe(2);
  });

  it("does not let a later passing step imply the one before it", () => {
    // confirm's condition passes here, but payment's does not, so the flow must
    // not treat confirm as reachable.
    const flow = defineFlow<"a" | "b" | "c", { b: boolean }>({
      id: "t",
      steps: ["a", "b", "c"],
      canEnter: { b: (c) => c.b },
    });
    expect(furthestReachableIndex(flow, { b: false })).toBe(0);
  });
});

describe("resolveStep", () => {
  it("defaults to the first step", () => {
    const r = resolveStep(CHECKOUT, null, ready);
    expect(r.step).toBe("review");
    expect(r.number).toBe(1);
    expect(r.isFirst).toBe(true);
    expect(r.clamped).toBe(false);
  });

  it("resolves a step by name", () => {
    expect(resolveStep(CHECKOUT, "payment", ready).step).toBe("payment");
    expect(resolveStep(CHECKOUT, "confirm", ready).number).toBe(3);
  });

  it("accepts a 1-based numeric string, for flows migrating off numeric state", () => {
    expect(resolveStep(CHECKOUT, "2", ready).step).toBe("payment");
    expect(resolveStep(CHECKOUT, 2, ready).step).toBe("confirm");
  });

  it("clamps a step the context does not allow", () => {
    // The reason the step can live in the URL at all: a fresh tab opened at
    // ?step=confirm must not skip the flow.
    const r = resolveStep(CHECKOUT, "confirm", empty);
    expect(r.step).toBe("review");
    expect(r.clamped).toBe(true);
  });

  it("clamps to the furthest reachable step, not to the beginning", () => {
    const r = resolveStep(CHECKOUT, "confirm", detailsOnly);
    expect(r.step).toBe("payment");
    expect(r.clamped).toBe(true);
  });

  it("does not report clamping when the requested step was allowed", () => {
    expect(resolveStep(CHECKOUT, "payment", detailsOnly).clamped).toBe(false);
  });

  it("is total — junk input still resolves to a real step", () => {
    for (const input of [
      "nonsense",
      "",
      "-5",
      "999",
      -1,
      99,
      null,
      undefined,
      "NaN",
    ]) {
      const r = resolveStep(CHECKOUT, input as never, ready);
      expect(CHECKOUT.steps).toContain(r.step);
      expect(r.number).toBeGreaterThanOrEqual(1);
      expect(r.number).toBeLessThanOrEqual(r.total);
    }
  });

  it("marks the last step", () => {
    expect(resolveStep(CHECKOUT, "confirm", ready).isLast).toBe(true);
    expect(resolveStep(CHECKOUT, "payment", ready).isLast).toBe(false);
  });

  it("treats a flow with no conditions as fully open", () => {
    const open = defineFlow<"a" | "b", undefined>({ id: "o", steps: ["a", "b"] });
    expect(resolveStep(open, "b", undefined).step).toBe("b");
  });
});

describe("buildStepGateFlow", () => {
  // A 5-step questionnaire where steps 1 and 3 are required and unanswered
  // unless listed in `answered`.
  const satisfied = (answered: Set<number>) => (i: number) =>
    ![0, 2].includes(i) || answered.has(i);

  it("reaches only as far as the answers allow", () => {
    const flow = buildStepGateFlow("q", 5, satisfied(new Set()));
    // step 1 (index 0) required and unanswered → cannot even reach step 2.
    expect(resolveStep(flow, "5", undefined).number).toBe(1);
  });

  it("lets progress advance as earlier steps are satisfied", () => {
    const flow = buildStepGateFlow("q", 5, satisfied(new Set([0])));
    // 1 answered, 2 is optional, 3 (index 2) required+unanswered → furthest is
    // step 3 itself (you can be ON the unmet step, just not past it).
    expect(resolveStep(flow, "5", undefined).number).toBe(3);
  });

  it("opens the whole flow once every required step is satisfied", () => {
    const flow = buildStepGateFlow("q", 5, satisfied(new Set([0, 2])));
    expect(resolveStep(flow, "5", undefined).number).toBe(5);
  });

  it("names steps by 1-based position so the URL reads naturally", () => {
    const flow = buildStepGateFlow("q", 3, () => true);
    expect(flow.steps).toEqual(["1", "2", "3"]);
    expect(resolveStep(flow, "2", undefined).step).toBe("2");
  });
});

describe("skipWhen — branchy flows", () => {
  type Ctx = { aquatic: boolean };
  const FLOW = defineFlow<"sport" | "water" | "budget", Ctx>({
    id: "known",
    steps: ["sport", "water", "budget"],
    // The water-comfort question only appears for aquatic sports.
    skipWhen: { water: (c) => !c.aquatic },
  });
  const dry: Ctx = { aquatic: false };
  const wet: Ctx = { aquatic: true };

  it("excludes a skipped step from the progress count", () => {
    // sport is step 1 of 2 when water is skipped, 1 of 3 when it is not.
    expect(resolveStep(FLOW, "sport", dry).total).toBe(2);
    expect(resolveStep(FLOW, "sport", wet).total).toBe(3);
  });

  it("settles a deep link onto a skipped step's nearest real neighbour", () => {
    // ?step=water with a dry context lands on budget (forward), not on the
    // hidden water step.
    const r = resolveStep(FLOW, "water", dry);
    expect(r.step).toBe("budget");
    expect(r.clamped).toBe(true);
  });

  it("keeps a skipped step reachable once the context enables it", () => {
    const r = resolveStep(FLOW, "water", wet);
    expect(r.step).toBe("water");
    expect(r.clamped).toBe(false);
  });

  it("numbers the last real step as the last, even when a later step is skipped", () => {
    // With water present but budget skipped, water is the final step.
    const flow = defineFlow<"sport" | "water" | "budget", Ctx>({
      id: "k2",
      steps: ["sport", "water", "budget"],
      skipWhen: { budget: () => true },
    });
    const r = resolveStep(flow, "water", wet);
    expect(r.isLast).toBe(true);
  });
});
