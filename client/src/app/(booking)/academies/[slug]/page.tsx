import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { AcademyProfileClient } from "./AcademyProfileClient";

/**
 * Server component for `/academies/[slug]`. The interactive profile lives in
 * `AcademyProfileClient`; this shell exists so the route is not itself a client
 * component and can own server-only concerns like `metadata`.
 *
 * `noindex` is deliberate, and carried over from the sibling `layout.tsx` this
 * replaces: academy booking is on a waitlist, nothing links here, and the
 * profiles behind it are not ready to be a parent's first impression from a
 * search result. When `/academies` is a real directory again this wants
 * `generateMetadata` + `SportsActivityLocation`, not just an index flip.
 */
export const metadata: Metadata = noindexMetadata("Academy");

export default function Page() {
  return <AcademyProfileClient />;
}
