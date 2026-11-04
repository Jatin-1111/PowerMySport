/**
 * Declarative multi-step flows.
 *
 * Nine flows in this app hand-rolled their own step machine, using four different
 * representations of "which step am I on" (an index into an array, a numeric
 * 1..3, a typed union, a per-problem lookup). None of them put the step in the
 * URL, so in every one of them the browser Back button left the flow instead of
 * stepping back, a refresh dropped the user to the beginning, no step was
 * linkable, and drop-off could not be attributed to a step because there was no
 * URL to attribute it to.
 *
 * The step resolution below is pure and knows nothing about React or the router.
 * That is what makes it testable as a table, and what lets `useFlow` be a thin
 * binding rather than the place the rules live.
 */

export type FlowStepName = string;

export type FlowDefinition<TStep extends FlowStepName, TContext> = {
  /** Stable id, used for the search-param name and for analytics. */
  id: string;
  /** Ordered step names. Order is the flow. */
  steps: readonly TStep[];
  /**
   * Per-step entry conditions. A step with no entry condition is always
   * enterable. Conditions gate *entry*, so they are what stops someone opening
   * `?step=confirm` in a fresh tab and skipping the flow.
   */
  canEnter?: Partial<Record<TStep, (context: TContext) => boolean>>;
  /**
   * Per-step skip conditions. A step whose predicate returns true for the
   * current context is transparent: you never land on it, navigation hops over
   * it, and it is excluded from the progress count. This models a branchy
   * questionnaire (e.g. "skip the water-comfort question unless the sport is
   * aquatic") without the caller re-deriving next/prev walks.
   */
  skipWhen?: Partial<Record<TStep, (context: TContext) => boolean>>;
  /** Search param carrying the step. Defaults to "step". */
  param?: string;
};

export const defineFlow = <TStep extends FlowStepName, TContext>(
  definition: FlowDefinition<TStep, TContext>
): FlowDefinition<TStep, TContext> => definition;

/** The search param a flow stores its step in. */
export const flowParam = <TStep extends FlowStepName, TContext>(
  flow: FlowDefinition<TStep, TContext>
): string => flow.param ?? "step";

/** Whether the step at `index` is skipped for the current context. */
export const isStepSkipped = <TStep extends FlowStepName, TContext>(
  flow: FlowDefinition<TStep, TContext>,
  index: number,
  context: TContext
): boolean => {
  const step = flow.steps[index];
  return step !== undefined && (flow.skipWhen?.[step]?.(context) ?? false);
};

/** Indices of the steps that are not skipped, in order. */
export const effectiveIndices = <TStep extends FlowStepName, TContext>(
  flow: FlowDefinition<TStep, TContext>,
  context: TContext
): number[] => {
  const out: number[] = [];
  for (let i = 0; i < flow.steps.length; i += 1) {
    if (!isStepSkipped(flow, i, context)) out.push(i);
  }
  return out;
};

/**
 * The nearest non-skipped index at or after `from`, walking in `dir`. Falls
 * back to the opposite direction when the walk runs off the end (so a skipped
 * final step resolves to the last real one, not to nothing).
 */
export const settleOnUnskipped = <TStep extends FlowStepName, TContext>(
  flow: FlowDefinition<TStep, TContext>,
  from: number,
  dir: 1 | -1,
  context: TContext
): number => {
  const total = flow.steps.length;
  let i = from;
  while (i >= 0 && i < total && isStepSkipped(flow, i, context)) i += dir;
  if (i >= 0 && i < total) return i;
  // Ran off the end — walk the other way from `from`.
  i = from - dir;
  while (i >= 0 && i < total && isStepSkipped(flow, i, context)) i -= dir;
  return Math.max(0, Math.min(total - 1, i));
};

/**
 * The furthest step index that `context` permits entering.
 *
 * Walks forward and stops at the first step whose condition fails, rather than
 * picking the highest passing step: a later step passing its own condition does
 * not mean the user may skip the one before it.
 */
export const furthestReachableIndex = <TStep extends FlowStepName, TContext>(
  flow: FlowDefinition<TStep, TContext>,
  context: TContext
): number => {
  let furthest = 0;

  for (let i = 1; i < flow.steps.length; i += 1) {
    // A skipped step is never landed on, so its own guard is irrelevant — walk
    // past it without letting it advance or block `furthest`.
    if (isStepSkipped(flow, i, context)) continue;
    const guard = flow.canEnter?.[flow.steps[i]];
    if (guard && !guard(context)) break;
    furthest = i;
  }

  return furthest;
};

export type ResolvedStep<TStep extends FlowStepName> = {
  /** The step actually being shown. */
  step: TStep;
  index: number;
  /** 1-based, for progress display. */
  number: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  /**
   * True when the requested step was not reachable and the flow fell back to an
   * earlier one. Callers correct the URL on this, so a deep link that no longer
   * applies does not keep claiming to be a step the user is not on.
   */
  clamped: boolean;
};

/**
 * Resolve a requested step (typically from the URL) against the flow and context.
 *
 * Total: any input — a name, an unknown name, a number, null, or a step the
 * context does not allow — resolves to exactly one valid step.
 */
export const resolveStep = <TStep extends FlowStepName, TContext>(
  flow: FlowDefinition<TStep, TContext>,
  requested: string | number | null | undefined,
  context: TContext
): ResolvedStep<TStep> => {
  const total = flow.steps.length;

  let requestedIndex = 0;
  if (typeof requested === "number") {
    requestedIndex = requested;
  } else if (typeof requested === "string" && requested.length > 0) {
    const byName = flow.steps.indexOf(requested as TStep);
    if (byName >= 0) {
      requestedIndex = byName;
    } else {
      // Numeric strings are accepted so a 1-based `?step=2` keeps working for
      // flows migrating off numeric state.
      const parsed = Number.parseInt(requested, 10);
      requestedIndex = Number.isFinite(parsed) ? parsed - 1 : 0;
    }
  }

  const inRange = Math.min(Math.max(requestedIndex, 0), total - 1);
  const reachable = furthestReachableIndex(flow, context);
  const gated = Math.min(inRange, reachable);

  // If the resolved step is skipped for this context, settle onto the nearest
  // real one — forward first (the natural reading direction of a deep link).
  const index = settleOnUnskipped(flow, gated, 1, context);

  const effective = effectiveIndices(flow, context);
  const position = effective.indexOf(index);

  return {
    step: flow.steps[index],
    index,
    // Progress is counted over the steps that actually appear, so a branch that
    // skips two questions shows "3 of 5", not "3 of 7".
    number: position >= 0 ? position + 1 : 1,
    total: effective.length || total,
    isFirst: position <= 0,
    isLast: position === effective.length - 1,
    // Clamped when we did not land on the requested in-range step, whether
    // because the gate held us back or because the target was skipped.
    clamped: index !== inRange,
  };
};

/**
 * Build a flow whose steps are gated by a per-step satisfaction predicate:
 * step `i` is enterable only when every step before it is satisfied.
 *
 * This is the shape a linear questionnaire needs — you may only be on question 5
 * if questions 1–4 are answered — without each caller re-deriving the
 * accumulate-forward logic. Steps are named by their 1-based position, so the
 * URL reads `?step=3` and `resolveStep`'s numeric handling lines up.
 */
export type StepGateOptions<TContext> = {
  param?: string;
  /**
   * Which steps are skipped for the current context. A skipped step is
   * transparent to both the gate (it never blocks) and navigation (it is hopped
   * over) — see `skipWhen` on the flow definition.
   */
  isStepSkipped?: (stepIndex: number, context: TContext) => boolean;
};

export const buildStepGateFlow = <TContext>(
  id: string,
  stepCount: number,
  isStepSatisfied: (stepIndex: number, context: TContext) => boolean,
  options: StepGateOptions<TContext> = {}
): FlowDefinition<string, TContext> => {
  const steps = Array.from({ length: stepCount }, (_, i) => String(i + 1));
  const { param, isStepSkipped } = options;

  const canEnter: Record<string, (context: TContext) => boolean> = {};
  for (let i = 1; i < stepCount; i += 1) {
    // Every earlier step must be satisfied — but a skipped step imposes no
    // requirement, since the user was never shown it. `furthestReachableIndex`
    // stops at the first failure, and this predicate is a superset of the
    // previous step's, so the forward walk lands on the right step either way.
    canEnter[steps[i]] = (context) => {
      for (let j = 0; j < i; j += 1) {
        if (isStepSkipped?.(j, context)) continue;
        if (!isStepSatisfied(j, context)) return false;
      }
      return true;
    };
  }

  const skipWhen: Record<string, (context: TContext) => boolean> | undefined = isStepSkipped
    ? Object.fromEntries(
        steps.map((name, i) => [name, (context: TContext) => isStepSkipped(i, context)])
      )
    : undefined;

  return defineFlow<string, TContext>({ id, steps, canEnter, skipWhen, param });
};
