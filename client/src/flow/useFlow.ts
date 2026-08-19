"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  flowParam,
  resolveStep,
  settleOnUnskipped,
  type FlowDefinition,
  type FlowStepName,
  type ResolvedStep,
} from "./defineFlow";

/**
 * Binds a flow definition to the URL.
 *
 * The URL is the source of truth for the active step, which is the whole point:
 * Back steps back, refresh keeps your place, a step is linkable, and analytics
 * has a distinct URL per step to attribute drop-off to. None of that needed
 * building — it comes free once the step stops living in `useState`.
 */

export type FlowController<TStep extends FlowStepName> =
  ResolvedStep<TStep> & {
    /** +1 when the last move was forward, -1 backward. For transitions. */
    direction: number;
    goToStep: (step: TStep | number) => void;
    next: () => void;
    back: () => void;
  };

export const useFlow = <TStep extends FlowStepName, TContext>(
  flow: FlowDefinition<TStep, TContext>,
  context: TContext,
): FlowController<TStep> => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = flowParam(flow);

  const resolved = resolveStep(flow, searchParams.get(param), context);

  // Transition direction, derived by adjusting state during render — React's
  // documented pattern for "recompute when an input changes". Refs are not
  // usable here: reading or writing one during render is exactly the case that
  // makes a component fail to update. Deriving it from the resolved index rather
  // than from the move that caused it also keeps the animation correct when the
  // user navigates with the browser's own Back button, which never calls goToStep.
  const [previousIndex, setPreviousIndex] = useState(resolved.index);
  const [direction, setDirection] = useState(1);

  if (previousIndex !== resolved.index) {
    setDirection(resolved.index > previousIndex ? 1 : -1);
    setPreviousIndex(resolved.index);
  }

  // The values the navigation callbacks need, kept in a ref so that
  // `goToStep`/`next`/`back` can be STABLE across renders. Without it they close
  // over `searchParams`/`resolved.index`/etc. and change identity on every
  // navigation, forcing every consumer that wraps them in a
  // `useCallback`/`useEffect` to list them as dependencies and rebuild each step.
  //
  // Synced in an effect, not during render: writing a ref while rendering is
  // impure (and `react-hooks/refs` rightly rejects it — this project compiles
  // with the React Compiler, which assumes pure renders). Declared BEFORE the
  // clamp effect below so that, on any given render, the ref is already fresh by
  // the time that effect calls `writeStep` — effects run in declaration order.
  const latest = useRef({ pathname, searchParams, flow, context, index: resolved.index });
  useEffect(() => {
    latest.current = { pathname, searchParams, flow, context, index: resolved.index };
  });

  const writeStep = useCallback(
    (index: number, mode: "push" | "replace") => {
      const { pathname, searchParams, flow } = latest.current;
      const params = new URLSearchParams(searchParams.toString());
      // Step 1 is the default, so it stays out of the URL — a bare /checkout
      // link should not have to carry ?step=review to mean the beginning.
      if (index === 0) params.delete(param);
      else params.set(param, flow.steps[index]);

      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [param, router],
  );

  // A URL asking for a step the context does not allow gets corrected, with
  // `replace` rather than `push` so the unreachable step does not become a
  // history entry the Back button returns to.
  useEffect(() => {
    if (resolved.clamped) writeStep(resolved.index, "replace");
  }, [resolved.clamped, resolved.index, writeStep]);

  const goToStep = useCallback(
    (target: TStep | number) => {
      const { flow } = latest.current;
      const index =
        typeof target === "number" ? target - 1 : flow.steps.indexOf(target);
      if (index < 0 || index >= flow.steps.length) return;
      // User-initiated moves push, so Back walks the flow rather than leaving it.
      writeStep(index, "push");
    },
    [writeStep],
  );

  const next = useCallback(() => {
    // Hop to the next step that is not skipped for the current context.
    const { flow, context, index } = latest.current;
    const target = settleOnUnskipped(flow, index + 1, 1, context);
    if (target !== index) goToStep(target + 1);
  }, [goToStep]);

  const back = useCallback(() => {
    const { flow, context, index } = latest.current;
    const target = settleOnUnskipped(flow, index - 1, -1, context);
    if (target !== index) goToStep(target + 1);
  }, [goToStep]);

  return { ...resolved, direction, goToStep, next, back };
};
