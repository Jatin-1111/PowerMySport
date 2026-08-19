import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { VenueDetailClient } from "./VenueDetailClient";

/**
 * Server component for `/venues/[venueId]`. The interactive detail view lives in
 * `VenueDetailClient`; this shell exists so the route is not itself a client
 * component and can own server-only concerns like `metadata`.
 *
 * `noindex` is deliberate, and carried over from the sibling `layout.tsx` this
 * replaces: venue booking is on a waitlist, `/venues` redirects to `/booking`,
 * so nothing links here. When booking relaunches this wants `generateMetadata`
 * plus a `SportsActivityLocation` block with the real address and opening hours
 * — a product decision, not an index flip.
 */
export const metadata: Metadata = noindexMetadata("Venue");

export default function Page() {
  return <VenueDetailClient />;
}
