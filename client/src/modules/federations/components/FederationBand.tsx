import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";

import { fetchFederations } from "../services/fetchFederations";
import { FederationCard } from "./FederationCard";

// ─── "Who governs this sport" ────────────────────────────────────────────────
//
// The forward link from a pathway to the bodies that actually run its
// competitions. The pathway tells a parent what stage their child is at and what
// decision is coming; the federation tells them who sets the rules that decision
// runs into — age cut-offs, registration order, the official calendar.
//
// Sport-scoped rather than stage-scoped: a governing body is a fact about the
// sport, true at every stage, so it reads once under the whole pathway instead
// of repeating inside six stage panels.

export async function FederationBand({
  sportSlug,
  sportName,
}: {
  sportSlug: string;
  sportName: string;
}) {
  const federations = await fetchFederations(sportSlug);

  // Most sports have no curated federation yet. Render nothing rather than an
  // empty "who governs this" heading, which reads as missing content on a page
  // whose credibility is the whole product.
  if (federations.length === 0) return null;

  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 max-w-2xl">
          <div className="mb-3">
            <SectionLabel label="Who runs the competitions" color="green" />
          </div>
          <h2 className="font-title text-2xl font-bold text-slate-900 sm:text-3xl">
            The bodies that govern {sportName} in India
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Once your child starts competing, someone else&apos;s rules decide what they can enter
            and when. These are the organisations that set them — age categories, registration
            order, and the official calendar the season is built from.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {federations.map((federation) => (
            <li key={federation.slug}>
              <FederationCard federation={federation} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
