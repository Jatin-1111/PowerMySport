import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { normalizeStateName } from "@/lib/indianStates";
import { SportResourceArticle } from "@/modules/resources/components/SportResourceArticle";
import { StatePreparing } from "@/modules/resources/components/StatePreparing";
import { DEFAULT_RESOURCE_STATE, sportFromSlug } from "@/modules/resources/config";
import type { SportPathway } from "@/modules/sports/services/pathway";

// ─── Data ─────────────────────────────────────────────────────────────────────
//
// Fetched server-side rather than through `pathwayApi`, which is built on the
// browser axios instance. A resource page's whole job is to be readable and
// indexable without JavaScript, so the content has to exist in the HTML.
//
// ── On the state parameter ──
//
// `GET /pathways` REQUIRES a valid Indian state or UT (pathwayController.ts) and
// caches one document per `sport_state` pair, so there is no national variant to
// ask for. A state therefore always goes on the wire, defaulted when the reader
// hasn't chosen one.
//
// This is not the architecture the codebase intends. `SportBasePath` (sport-level,
// state-independent) and `SportStatePath` (the state overlay — association,
// academies, fees, schemes, calendar) both exist as models precisely so that a
// page like this one could read the base and layer the overlay. Both collections
// are currently EMPTY: nothing has run `generateSportBasePaths`. Until they're
// populated, the only real source is the monolithic per-state cache, which means
// content that ought to be identical everywhere — benchmarks, coach guidance,
// talent signals — was generated separately per state and drifts between them.
// Migrating this fetch to the split models is what makes the canonical page
// genuinely state-independent.

const FETCH_TIMEOUT_MS = 15_000;

async function fetchPathway(
  sportName: string,
  state: string,
): Promise<SportPathway | null> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  const params = new URLSearchParams({ sport: sportName, state });
  try {
    // An uncached sport×state pair makes the API generate the pathway inline,
    // which can take far longer than a page render should wait. Bounded so a
    // cold pair renders a 404 the reader can retry rather than hanging — and the
    // generation still completes server-side, so the retry is warm.
    const res = await fetch(`${apiBase}/pathways?${params.toString()}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success && body?.data ? (body.data as SportPathway) : null;
  } catch {
    return null;
  }
}

/**
 * The reader's chosen state, canonicalised, or `undefined` if they didn't choose
 * a real one.
 *
 * Validated here rather than left to the API, which answers 400 for a name it
 * doesn't recognise — and a 400 became a 404 for the whole page. So a typo, a
 * crawler probing `?state=xyz`, or a link written before the switcher spoke the
 * server's spelling ("Jammu & Kashmir") all resolve to the default guide with the
 * "pick your state" banner rather than a dead end.
 */
function readState(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? normalizeStateName(trimmed) : undefined;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}): Promise<Metadata> {
  const { sport } = await params;
  const entry = sportFromSlug(sport);
  if (!entry) return { title: "Sport guide — PowerMySport" };

  const title = `${entry.name} pathway in India — a parent's guide | PowerMySport`;
  const description = `Every stage of ${entry.name} in India: the ages, the standard to reach, what a year costs, which schemes help pay for it, and how to judge a coach.`;

  return {
    title,
    description,
    // Every `?state=` variant canonicalises back to the bare path. The switcher
    // scopes the local sections without minting a near-duplicate URL per state —
    // 10 sports × 28 states is 280 pages whose differences are mostly generator
    // noise, which is exactly the thin-content pattern that got this site's
    // indexing flagged in Search Console before.
    alternates: { canonical: `/resources/${entry.slug}` },
    openGraph: {
      title,
      description,
      url: `/resources/${entry.slug}`,
      type: "article",
      siteName: "PowerMySport",
    },
  };
}

// Deliberately no `generateStaticParams`. Prerendering all ten sports at build
// time would ask the API to AI-generate every uncached sport×state pair while the
// build waits on it. On-demand rendering plus ISR gets the same cached HTML
// without making a cold cache a build failure.

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SportResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sport } = await params;
  const entry = sportFromSlug(sport);
  if (!entry) notFound();

  const chosenState = readState((await searchParams).state);
  const state = chosenState ?? DEFAULT_RESOURCE_STATE;
  const pathway = await fetchPathway(entry.name, state);

  // No pathway means the generator hasn't produced one for this pair yet.
  //
  // On the canonical URL that's a 404: an empty guide is worse than none, and it
  // keeps a thin page out of the index. On a state the reader picked it is not —
  // the fetch above already started the generation, so answering 404 would throw
  // the article away to say "not found" about something that is being written.
  if (!pathway || pathway.levels.length === 0) {
    if (!chosenState) notFound();
    return (
      <StatePreparing
        sportSlug={entry.slug}
        sportName={entry.name}
        state={state}
        defaultState={DEFAULT_RESOURCE_STATE}
      />
    );
  }

  return (
    <SportResourceArticle
      pathway={pathway}
      sportSlug={entry.slug}
      sportName={entry.name}
      state={state}
      stateWasChosen={!!chosenState}
    />
  );
}
