import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { ProgrammeDetailClient } from "./ProgrammeDetailClient";

/**
 * Server shell for `/programmes/[offeringId]`, matching the pattern used by
 * `/coaches/[coachId]`: the route stays a server component so it can own
 * `metadata`, and the interactive view is a client component that reads the id
 * with `useParams` — which also sidesteps Next 16's async `params`.
 *
 * noindex for now, consistent with the rest of the coach booking surface, which
 * is still gated behind a waitlist.
 */
export const metadata: Metadata = noindexMetadata("Coaching programme");

export default function Page() {
  return <ProgrammeDetailClient />;
}
