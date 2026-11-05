import { useEffect, useState } from "react";

export interface Async<T> {
  /** idle: not asked for yet (disabled or waiting for the first refresh). */
  status: "idle" | "loading" | "ready" | "error";
  data: T | undefined;
}

/**
 * One independent piece of data for a screen. Each piece loads and fails on its own, so a slow or
 * failing call never blanks the rest of the page, and data already on screen stays while a
 * refresh runs.
 *
 * `refreshKey` is bumped by the screen (on focus, on pull to refresh). The piece does not load
 * while it is 0, so a screen that bumps the key on its first focus loads everything exactly once.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean; refreshKey: number }
): Async<T> {
  const { enabled = true, refreshKey } = options;
  const [state, setState] = useState<Async<T>>({ status: "idle", data: undefined });

  useEffect(() => {
    if (!enabled || refreshKey === 0) {
      setState((s) => (enabled ? s : { status: "idle", data: undefined }));
      return;
    }
    let alive = true;
    setState((s) => ({ status: s.data === undefined ? "loading" : s.status, data: s.data }));
    fn()
      .then((data) => {
        if (alive) setState({ status: "ready", data });
      })
      .catch(() => {
        if (alive) setState((s) => ({ status: "error", data: s.data }));
      });
    return () => {
      alive = false;
    };
    // fn is recreated each render by design; the caller's deps say when to load again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshKey, ...deps]);

  return state;
}
