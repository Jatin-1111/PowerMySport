import { noindexMetadata } from "@/lib/seo";
import { queryKeys } from "@/lib/query/keys";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
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
 *
 * It now also prefetches the venue on the server and hands it to
 * `VenueDetailClient` already hydrated into the React Query cache (same query
 * key: `queryKeys.discovery.venue`), so a fresh navigation here doesn't pay a
 * second, client-only fetch after the JS loads — the first render already has
 * the venue. `GET /venues/:venueId` is a public, unauthenticated endpoint (also
 * Redis-cached for 60s server-side), so this fetch needs no cookies/auth
 * forwarding. If it fails for any reason, this falls through and
 * `VenueDetailClient`'s own `useQuery` fetches it client-side exactly as
 * before — the prefetch is a pure optimization, never a hard dependency.
 */
export const metadata: Metadata = noindexMetadata("Venue");

export default async function Page({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  const queryClient = new QueryClient();
  await queryClient
    .prefetchQuery({
      queryKey: queryKeys.discovery.venue(venueId),
      queryFn: async () => {
        const response = await discoveryApi.getVenueById(venueId);
        return response.success ? (response.data ?? null) : null;
      },
    })
    .catch(() => undefined);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VenueDetailClient />
    </HydrationBoundary>
  );
}
