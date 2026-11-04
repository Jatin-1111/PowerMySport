import { ImageResponse } from "next/og";
import { getRankingSport, resolveCombo, comboLabel } from "@/modules/rankings/config/rankings";
import { OG_CONTENT_TYPE, OG_SIZE, ogFrame } from "@/modules/shared/ui/ogImage";

/**
 * Names the list, never a player.
 *
 * These lists are lists of children. The page itself shows names because that
 * is what the federation publishes and what a parent came for, but a preview
 * image is different: it is copied into chat apps and cached by crawlers that
 * never saw the page. So this carries the list and nothing else.
 */
export const alt = "Federation ranking list on PowerMySport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ sport: string; category: string; subcategory: string }>;
}) {
  const { sport, category, subcategory } = await params;
  const rankingSport = getRankingSport(sport);
  const combo = rankingSport ? resolveCombo(rankingSport, category, subcategory) : null;
  const label = combo ? comboLabel(combo) : "Federation rankings";

  return new ImageResponse(
    ogFrame({
      eyebrow: rankingSport?.federation.acronym ?? "Rankings",
      headline: `${label} rankings`,
      subline: "Every published week, with movement and what the next level costs.",
    }),
    size
  );
}
