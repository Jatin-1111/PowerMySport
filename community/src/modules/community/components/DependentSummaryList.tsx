import { MapPin, Trophy, Users } from "lucide-react";

import type { CommunityDependentSummary } from "@/modules/community/types";

/**
 * The competition category, as a draw sheet would print it.
 *
 * Gender and age band are one label rather than two chips because that is what
 * they are everywhere a parent has met them before: no federation runs a "U-14"
 * event, they run Boys U-14 and Girls U-14. Splitting them would make a reader
 * reassemble a phrase they already know.
 *
 * Plural, for the same reason — the category is named after the field of
 * entrants, not after the one child. Either half can be missing, and the label
 * degrades to whichever half we have.
 */
export const categoryLabel = (dependent: CommunityDependentSummary): string | null => {
  const { gender, ageBand } = dependent;
  if (gender && ageBand) return `${gender}s ${ageBand}`;
  return ageBand || gender || null;
};

/**
 * Whether we know anything publishable about this child at all.
 *
 * Exported because the Discover card counts children ("2 children") while this
 * component lists them. Two different predicates would let a card promise a
 * second child that the modal one tap later does not show.
 */
export const hasSomethingToShow = (dependent: CommunityDependentSummary): boolean =>
  Boolean(dependent.sport || dependent.ageBand || dependent.gender || dependent.city);

/**
 * A member's family in one line, for a card in the grid.
 *
 * ── Why two children do not become "the first child, +1" ──
 *
 * They did. The card read the oldest-added child's category and city and
 * presented them as the family's, with the second child reduced to a bare `+1`.
 * That is a guess wearing the clothes of a fact: nothing about being added first
 * makes a child the one a stranger should be shown, and the parent has no way to
 * tell which one we picked.
 *
 * So one child renders as itself, and two or more roll up to the family. The
 * count is honest about what it is not saying, the cities still carry the "are
 * they near me" signal, and the sport chips directly below the line already show
 * every sport across the children. The per-child detail is one tap away in the
 * modal, which is the surface built to hold it.
 *
 * Fixed length matters too: this line is `line-clamp-1` inside a narrow card, so
 * a format that grows with the number of children truncates instead of informing.
 */
export const familyLine = (dependents: CommunityDependentSummary[] | undefined): string | null => {
  // The same predicate the modal lists by, so a card promising "2 children"
  // cannot open a modal showing one.
  const shown = (dependents ?? []).filter(hasSomethingToShow);
  if (!shown.length) return null;

  const cities = Array.from(
    new Set(shown.map((dependent) => dependent.city).filter((city): city is string => !!city))
  );
  // Two cities fit; past that the line is better off counting than listing.
  const cityPart =
    cities.length > 2
      ? `${cities.slice(0, 2).join(", ")} +${cities.length - 2}`
      : cities.join(", ");

  if (shown.length === 1) {
    const only = shown[0] as CommunityDependentSummary;
    return [categoryLabel(only), only.city].filter(Boolean).join(" · ") || null;
  }

  return [`${shown.length} children`, cityPart].filter(Boolean).join(" · ");
};

/**
 * "Tennis · Boys U-14 · Chandigarh" — a member's children, as another parent
 * sees them.
 *
 * ── Why this is its own component ──
 *
 * Three surfaces render the same profile (the Discover modal, the member modal
 * opened from chat and Q&A, and the /members/[userId] page). The whole point of
 * publishing children is that a parent recognises a peer at a glance, and a
 * glance only works if the line looks the same everywhere it appears.
 *
 * ── What is not here ──
 *
 * The child's name, their exact age, their date of birth. The server never
 * sends them. If this component ever grows a fourth field, that is the bar it
 * has to clear: could a stranger use it to pick this specific child out?
 */
export function DependentSummaryList({
  dependents,
  className = "",
}: {
  dependents: CommunityDependentSummary[] | undefined;
  className?: string;
}) {
  const shown = (dependents || []).filter(hasSomethingToShow);

  if (!shown.length) {
    return null;
  }

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Users size={12} />
        {shown.length === 1 ? "Their child" : "Their children"}
      </p>
      <ul className="flex flex-col gap-2">
        {shown.map((dependent, index) => (
          // Index as the key, because there is deliberately no id here: the
          // server sends an anonymous summary, and giving each child a stable
          // public identifier is exactly what this shape is avoiding. The list
          // is read-only and never reorders, so the index is stable in practice.
          <li
            key={index}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
          >
            {dependent.sport && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Trophy size={13} className="shrink-0 text-amber-500" />
                {dependent.sport}
              </span>
            )}
            {categoryLabel(dependent) && (
              <span className="inline-flex rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 ring-1 ring-slate-200">
                {categoryLabel(dependent)}
              </span>
            )}
            {dependent.city && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <MapPin size={12} className="shrink-0 text-emerald-500" />
                {dependent.city}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DependentSummaryList;
