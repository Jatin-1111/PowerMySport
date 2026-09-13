import { BadgeCheck, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PathwayContributor } from "../services/pathway";

// ─── "Contributed by" ────────────────────────────────────────────────────────
//
// The credit for a pathway written by someone outside the team.
//
// It renders in two shapes, decided entirely by whether the API sent a
// `profile`. The server resolves that, and deliberately omits it for anyone who
// is no longer publicly bookable — so this component never has to ask whether a
// link is safe to show, and there is no state where it offers "Book a session"
// for someone the booking flow would turn away.
//
//   · with a profile — photo, verified badge, and a booking button
//   · without one    — the same byline, and their own site if they gave one
//
// The written credit is identical either way. A contributor does not lose their
// name on our site because their verification lapsed.
//
// Placed below the stages rather than in the hero on purpose: the page's first
// job is to answer a parent's question, and a byline above the answer reads as
// an advertisement for the author. Below it, having just been useful, it reads
// as what it is — the person who can help next.

export function PathwayContributorCard({
  contributor,
  sportName,
}: {
  contributor: PathwayContributor;
  sportName: string;
}) {
  const { name, organisation, url, blurb, profile } = contributor;

  return (
    <aside className="premium-shadow rounded-2xl border border-white/70 bg-white/80 p-5 backdrop-blur-sm sm:p-6">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
        {sportName} pathway contributed by
      </p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {profile?.photoUrl && (
            <Image
              src={profile.photoUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          )}

          <div className="min-w-0">
            <p className="font-title flex items-center gap-1.5 text-lg font-bold text-slate-900">
              {name}
              {profile && (
                <BadgeCheck
                  className="h-4 w-4 shrink-0 text-emerald-600"
                  aria-label="Verified on PowerMySport"
                />
              )}
            </p>

            {organisation && (
              <p className="text-sm font-semibold text-slate-600">
                {url ? (
                  // Contributor-supplied and off-site, so it carries the usual
                  // external-link precautions.
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="hover:text-power-orange inline-flex items-center gap-1 transition"
                  >
                    {organisation}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  organisation
                )}
              </p>
            )}

            {blurb && <p className="mt-1 text-sm leading-relaxed text-slate-500">{blurb}</p>}
          </div>
        </div>

        {profile && (
          <Link
            href={profile.href}
            className="bg-power-orange-solid inline-flex shrink-0 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            {profile.ctaLabel}
          </Link>
        )}
      </div>
    </aside>
  );
}
