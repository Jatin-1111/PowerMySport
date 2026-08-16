import { permanentRedirect } from "next/navigation";

// ─── /resources/[sport] → /roadmap/[sport] ───────────────────────────────────
//
// The sport resource guide was rendered from the old generated `SportPathway`
// document, which no longer exists. Its replacement — the authored pathway — is
// the same subject at a different URL, so this is a 308 rather than a 404 or a
// stub: these URLs are indexed and linked from the rankings page, and a
// permanent redirect hands their link equity to the page that now answers the
// query.
//
// Kept as a route rather than a `next.config` rule so it lives next to the thing
// it points at and moves with it.

export default async function SportResourceRedirect({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  permanentRedirect(`/roadmap/${sport}`);
}
