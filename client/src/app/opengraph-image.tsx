import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFrame } from "@/modules/shared/ui/ogImage";

/**
 * The site-wide social preview.
 *
 * Every route inherits this unless it declares its own, which matters for one
 * route in particular: /rankings/[sport]/players/[regNo] deliberately does NOT
 * get a generated image. That page is about a named child, is already noindex
 * for the same reason, and an image carrying their name and rank would travel
 * further than the page itself — into a WhatsApp group, a link preview, a
 * crawler's cache. It inherits this generic frame instead, which says nothing
 * about who it is for.
 */
export const alt = "PowerMySport — plan your child's sports journey";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    ogFrame({
      headline: "Plan your child's sports journey",
      subline: "Sport pathways, federation rankings and verified experts. Built for India.",
    }),
    size
  );
}
