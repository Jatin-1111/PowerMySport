import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { roadmapHref, sportFromSlug } from "../data/sports";

// ─── Back to the sport's pathway ─────────────────────────────────────────────
//
// This used to restore a URL from `localStorage["pms_roadmap_return_url"]`,
// written by the old pathway explorer. That explorer was deleted in the CMS
// rebuild and nothing writes the key any more — so the link replayed whatever
// URL a reader happened to save before the teardown, forever. For anyone who
// used the site back then that was a `/roadmap?sport=Tennis&state=…` link, a
// URL shape the site no longer serves.
//
// Derived from the sport instead. No stored state, nothing to go stale.
//
// `hasPathway` has to be told to us: whether a sport's guide is *published* is a
// CMS fact only the server knows, and the sport registry is the list we are
// willing to publish, not what exists. Pointing at `/roadmap/badminton` off the
// registry alone is a 404.

export function BackToRoadmapLink({
  sportSlug,
  hasPathway = false,
  className,
}: {
  sportSlug?: string;
  /** Does this sport have a published pathway? Resolved server-side. */
  hasPathway?: boolean;
  className?: string;
}) {
  const sportName = hasPathway && sportSlug ? sportFromSlug(sportSlug)?.name : undefined;

  return (
    <Link
      href={hasPathway && sportSlug ? roadmapHref(sportSlug) : "/roadmap"}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-xs font-medium text-white/35 transition hover:text-white/65"
      }
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {sportName ? `Back to the ${sportName} pathway` : "Back to sport pathways"}
    </Link>
  );
}
