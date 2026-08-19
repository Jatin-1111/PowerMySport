import type {
  PathwayGuide,
  PathwayGuideSummary,
  PathwayStageSummary,
} from "./pathway";
import { pathwaySportRank } from "../data/sports";

// ─── Server-side pathway fetch ───────────────────────────────────────────────
//
// Fetched here rather than through `pathwayApi`, which is built on the browser
// axios instance. The pathway's whole job is to be readable and indexable
// without JavaScript, so the content has to be in the HTML the server sends.
//
// Nothing behind these endpoints generates anything — they read published
// documents — so a plain ISR cache is the right shape and a cold page is fast.

const REVALIDATE_SECONDS = 3600;

const apiBase = (): string =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function fetchPathwayGuide(
  sport: string,
): Promise<PathwayGuide | null> {
  const params = new URLSearchParams({ sport });
  try {
    const res = await fetch(`${apiBase()}/pathways/guide?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    // 404 is the normal answer for a sport whose pathway isn't published yet.
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success && body?.data ? (body.data as PathwayGuide) : null;
  } catch {
    return null;
  }
}

/**
 * A short cache, deliberately — one minute, not the hour a stage body gets.
 *
 * This list is prerendered at build time, when the API is usually unreachable,
 * so a fresh deploy bakes in "no pathways published yet". It is also the list
 * that changes the moment an admin presses Publish. An hour of either is too
 * long for the page that decides whether a sport is visible at all.
 */
const INDEX_REVALIDATE_SECONDS = 60;

export async function fetchPublishedPathways(): Promise<PathwayGuideSummary[]> {
  try {
    const res = await fetch(`${apiBase()}/pathways/guides`, {
      next: { revalidate: INDEX_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body?.success && Array.isArray(body.data)
      ? (body.data as PathwayGuideSummary[])
      : [];
  } catch {
    return [];
  }
}

// ─── The index's own view of the pathways ────────────────────────────────────
//
// `/roadmap` used to render one link per sport off a summary that carried a name
// and a stage count and nothing else. That made the index a door rather than a
// map: a parent could not see what was behind it, and every click landed them on
// stage one regardless of how old their child is.
//
// ── What has to stay true at fifty sports ──
//
// This page has ten pathways today and is meant to have many more, so the cost
// of building it must not grow with the number of sports.
//
//   · The stage list is now part of the `/pathways/guides` response, so the
//     whole picker — every sport, every stage, every age range — is ONE request
//     whether ten sports are published or two hundred. The obvious alternative,
//     reading each guide in turn, was fifty round-trips and half a megabyte of
//     overviews and answers to render a grid of names.
//
//   · The question preview has its own endpoint. It needs a few questions from
//     EVERY published sport, and the obvious way to get them — open each guide
//     and keep two — is the same fifty round-trips by another name. The server
//     flattens them in one aggregation instead, so this is also one request at
//     any number of sports.

export interface PathwayIndexEntry {
  sportSlug: string;
  sportName: string;
  stageCount: number;
  /** Empty only if an older API response carried no stages — then a plain link. */
  stages: PathwayStageSummary[];
  updatedAt?: string;
}

export interface PathwayIndexQuestion {
  question: string;
  stageKey: string;
  stageName: string;
  sportSlug: string;
  sportName: string;
}

export interface PathwayIndex {
  sports: PathwayIndexEntry[];
  /** Real answered questions, for the preview band. */
  questions: PathwayIndexQuestion[];
}

/** How many questions the band shows at once. */
const PREVIEW_QUESTIONS = 9;

/** How long one selection of questions stays put, in milliseconds. */
const ROTATION_WINDOW_MS = 10 * 60 * 1000;

/** Per-sport question lists, as `/api/pathways/questions` returns them. */
export interface QuestionsBySport {
  sportSlug: string;
  sportName: string;
  questions: Array<{ question: string; stageKey: string; stageName: string }>;
}

async function fetchAnsweredQuestions(): Promise<QuestionsBySport[]> {
  try {
    const res = await fetch(`${apiBase()}/pathways/questions`, {
      next: { revalidate: INDEX_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body?.success && Array.isArray(body.data)
      ? (body.data as QuestionsBySport[])
      : [];
  } catch {
    return [];
  }
}

/**
 * The whole pool, interleaved one question per sport at a time.
 *
 * Interleaving is what stops the band being six Tennis questions: taking a
 * sport's whole list before starting the next means the first nine come from the
 * two or three sports whose answers happen to be written. Round-robin puts every
 * published sport in the first pass, so the band shows the breadth of what has
 * been written rather than the depth of one entry.
 *
 * Sports are visited in curated order, so when there are more sports than slots
 * the ones the site leads with are the ones that appear.
 */
export function interleave(
  bySport: QuestionsBySport[],
): PathwayIndexQuestion[] {
  const lists = [...bySport]
    .sort(
      (a, b) => pathwaySportRank(a.sportSlug) - pathwaySportRank(b.sportSlug),
    )
    .map((sport) =>
      sport.questions.map((q) => ({
        ...q,
        sportSlug: sport.sportSlug,
        sportName: sport.sportName,
      })),
    );

  const pool: PathwayIndexQuestion[] = [];
  const deepest = Math.max(0, ...lists.map((list) => list.length));
  for (let round = 0; round < deepest; round += 1) {
    for (const list of lists) {
      const item = list[round];
      if (item) pool.push(item);
    }
  }
  return pool;
}

/**
 * A rotating window of `count` questions from `pool`.
 *
 * The band shows nine and the pool will hold hundreds, so a fixed first nine
 * would mean the other however-many are written and never seen — and a parent
 * who comes back to the page reads the same six lines they already read. The
 * window walks forward instead, wrapping at the end, so over a day the band
 * works through everything that has been written.
 *
 * Stepped by a ten-minute bucket rather than per request. Two reasons: the page
 * is statically rendered and revalidated, so per-request rotation is not a thing
 * it can actually do; and a band that is different on every reload reads as a
 * page that cannot make up its mind, not as a page with a lot of content.
 */
export function rotateQuestions(
  pool: PathwayIndexQuestion[],
  count: number,
  now: number,
): PathwayIndexQuestion[] {
  if (pool.length <= count) return pool;
  const start =
    (Math.floor(now / ROTATION_WINDOW_MS) * count) % pool.length;
  // Read circularly, so the window never returns a short final page.
  return Array.from(
    { length: count },
    (_, i) => pool[(start + i) % pool.length] as PathwayIndexQuestion,
  );
}

export async function fetchPathwayIndex(
  /** Injected so the rotation is testable and the caller owns the clock. */
  now: number = Date.now(),
): Promise<PathwayIndex> {
  const [summaries, answered] = await Promise.all([
    fetchPublishedPathways(),
    fetchAnsweredQuestions(),
  ]);

  if (summaries.length === 0) return { sports: [], questions: [] };

  const sports: PathwayIndexEntry[] = summaries.map((summary) => ({
    sportSlug: summary.sportSlug,
    sportName: summary.sportName,
    stageCount: summary.stageCount,
    stages: summary.stages ?? [],
    ...(summary.updatedAt ? { updatedAt: summary.updatedAt } : {}),
  }));

  return {
    sports,
    questions: rotateQuestions(interleave(answered), PREVIEW_QUESTIONS, now),
  };
}
