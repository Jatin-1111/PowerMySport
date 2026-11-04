import { ImageResponse } from "next/og";
import { sportFromSlug } from "@/modules/pathway/data/sports";
import { OG_CONTENT_TYPE, OG_SIZE, ogFrame } from "@/modules/shared/ui/ogImage";

/**
 * A shared pathway link should name the sport it is about.
 *
 * The sport name comes from the local registry rather than a fetch: the slug is
 * already the key, the registry is the same one the page renders from, and an
 * image route that fetches would turn every crawler's preview request into an
 * API call against a cluster that has run out of room once already.
 */
export const alt = "Sport pathway on PowerMySport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const known = sportFromSlug(sport);
  const name = known?.name ?? sport.replace(/-/g, " ");

  return new ImageResponse(
    ogFrame({
      eyebrow: "Pathway",
      headline: `${name} in India, stage by stage`,
      subline: "Where to start, what comes next, and what each level actually asks for.",
    }),
    size
  );
}
