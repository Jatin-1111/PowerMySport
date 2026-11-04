import { ImageResponse } from "next/og";
import { fetchEdition } from "@/modules/pathway/services/tournamentEditionPage";
import { OG_CONTENT_TYPE, OG_SIZE, ogFrame } from "@/modules/shared/ui/ogImage";

/**
 * A tournament link that shows which tournament.
 *
 * This is the one image route that fetches, because a slug like
 * "aita-championship-series-delhi-2026-08-14" is not a title anyone would
 * write. It reuses `fetchEdition`, so it shares the page's cache entry and its
 * `tournament-editions` tag rather than opening a second path to the API.
 *
 * A miss falls back to the generic frame instead of printing the slug: a
 * preview reading "aita-championship-series-delhi-2026-08-14" is worse than one
 * that simply says what the site is.
 */
export const alt = "Tournament on PowerMySport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await fetchEdition(slug);
  const edition = detail?.edition;

  if (!edition) {
    return new ImageResponse(
      ogFrame({
        eyebrow: "Tournament",
        headline: "Tournament calendar",
        subline: "Dates, entry deadlines and fact sheets, from the federation's own calendar.",
      }),
      size
    );
  }

  // `state` arrives from the event's own page and is not always present; `city`
  // comes off the calendar cell. Either can be missing, so both are optional
  // here rather than assumed.
  const where = [edition.city, edition.state].filter(Boolean).join(", ");
  const when = edition.startDate
    ? new Date(edition.startDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return new ImageResponse(
    ogFrame({
      eyebrow: edition.level ? `${edition.level} tournament` : "Tournament",
      headline: edition.name,
      subline: [when, where].filter(Boolean).join(" · ") || undefined,
    }),
    size
  );
}
