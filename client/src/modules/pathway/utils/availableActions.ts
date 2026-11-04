import type { PathwayAction, PathwayGuide } from "../services/pathway";

// ─── Links to places that do not exist yet ───────────────────────────────────
//
// Pathway copy is written in the CMS and stored with the guide, so it keeps
// pointing at the academy finder, the coach finder and the equipment shop until
// someone edits every stage of every sport. None of the three is open to
// parents yet, and a chip that lands on a dead end is worse than no chip.
//
// Filtering here rather than in the CMS means existing guides are fixed at
// once, and re-enabling a destination is a one-line change below.

/** Destinations a parent cannot use yet. Matched against the link's href. */
const UNAVAILABLE_DESTINATIONS: RegExp[] = [
  /^\/booking\?(?:.*&)?tab=academies(?:&|$)/,
  /^\/booking\?(?:.*&)?tab=coaches(?:&|$)/,
  /^\/shop(?:[/?#]|$)/,
];

export function isUnavailableHref(href: string | undefined): boolean {
  if (!href) return false;
  return UNAVAILABLE_DESTINATIONS.some((pattern) => pattern.test(href.trim()));
}

const isAvailable = (action: PathwayAction): boolean => !isUnavailableHref(action.href);

/** The guide with every help chip and primary action to an unavailable page removed. */
export function withoutUnavailableLinks(guide: PathwayGuide): PathwayGuide {
  return {
    ...guide,
    stages: guide.stages.map(({ primaryAction, helpLinks, ...stage }) => ({
      ...stage,
      helpLinks: (helpLinks ?? []).filter(isAvailable),
      ...(primaryAction && isAvailable(primaryAction) ? { primaryAction } : {}),
    })),
  };
}
