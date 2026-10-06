"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the screen is wide enough to put the event detail beside the calendar.
 *
 * Below this width the detail opens as a dialog instead, because a panel stacked
 * under a tall calendar would open somewhere the parent is not looking.
 *
 * Read with `useSyncExternalStore` so it follows the window being resized without
 * an effect copying it into state, and so it is `false` on the server and on the
 * first paint, which is the narrow layout and the safe one to start from.
 */
const QUERY = "(min-width: 1024px)";

const supported = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribe = (onChange: () => void): (() => void) => {
  if (!supported()) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

export const useIsWide = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => (supported() ? window.matchMedia(QUERY).matches : false),
    () => false
  );
