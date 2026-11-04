"use client";

import type { TraitGroup } from "@/modules/player/utils/dependentPageModel";
import Link from "next/link";

interface DependentTraitsProps {
  name: string;
  groups: TraitGroup[];
  discoverHref: string;
}

/**
 * How the child moves and plays, as short sentences under three plain headings. These used to be
 * a wall of unlabelled pills; each group now says what its lines describe.
 */
export function DependentTraits({ name, groups, discoverHref }: DependentTraitsProps) {
  return (
    <section
      aria-labelledby="about-heading"
      id="about"
      className="border-hairline scroll-mt-24 border-t pt-10"
    >
      <h2
        id="about-heading"
        className="font-editorial text-ink text-2xl font-light tracking-tight sm:text-3xl"
      >
        About {name}
      </h2>
      <p className="text-ink-body mt-2 max-w-[56ch] text-pretty">
        What the assessment found out about how {name} moves, plays and competes. These answers
        shape the sports we suggest.
      </p>

      {groups.length > 0 ? (
        <div className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-ink font-medium">{group.title}</h3>
              <ul className="divide-hairline border-hairline mt-2 divide-y border-y">
                {group.items.map((item) => (
                  <li key={item} className="text-ink-body py-2.5 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-hairline mt-6 max-w-lg rounded-xl border border-dashed px-5 py-6">
          <p className="text-ink font-medium">Nothing here yet</p>
          <p className="text-ink-body mt-1 text-pretty text-sm">
            Take the assessment to add how {name} moves and plays.
          </p>
          <Link
            href={discoverHref}
            className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink mt-4 inline-block text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Take the assessment
          </Link>
        </div>
      )}
    </section>
  );
}
