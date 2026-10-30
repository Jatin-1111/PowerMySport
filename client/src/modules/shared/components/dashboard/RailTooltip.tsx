"use client";

import { useCallback, useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

interface Tip {
  label: string;
  top: number;
  left: number;
}

/**
 * A label beside an icon-only sidebar item, shown on hover and on keyboard focus.
 *
 * Drawn through a portal at fixed coordinates because the sidebar's list scrolls, and a scroll
 * container clips anything that sticks out of it sideways. The control already carries an
 * accessible name, so the tooltip is a visual aid and is hidden from assistive technology.
 */
export function useRailTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  const bind = useCallback(
    (label: string) => {
      const show = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
      };
      return {
        onMouseEnter: show,
        onFocus: show,
        onMouseLeave: () => setTip(null),
        onBlur: () => setTip(null),
      };
    },
    [setTip]
  );

  const tooltip =
    tip && typeof document !== "undefined"
      ? createPortal(
          <span
            aria-hidden="true"
            style={{ top: tip.top, left: tip.left }}
            className="bg-ink z-60 pointer-events-none fixed -translate-y-1/2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-white"
          >
            {tip.label}
          </span>,
          document.body
        )
      : null;

  const hide = useCallback(() => setTip(null), []);

  return { bind, hide, tooltip };
}
