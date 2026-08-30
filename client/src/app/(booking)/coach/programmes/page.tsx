import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { CoachProgrammesClient } from "./CoachProgrammesClient";

/**
 * Server shell for `/coach/programmes`, matching the pattern used by
 * `/coaches/[coachId]`: the route itself stays a server component so it can own
 * `metadata`, and the interactive view lives in a client component.
 *
 * noindex — this is a signed-in coach's own management console.
 */
export const metadata: Metadata = noindexMetadata("My coaching programmes");

export default function Page() {
  return <CoachProgrammesClient />;
}
