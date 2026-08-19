import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { CoachDetailClient } from "./CoachDetailClient";

/**
 * Server component for `/coaches/[coachId]`. The interactive detail view lives
 * in `CoachDetailClient`; this shell exists so the route is not itself a client
 * component and can own server-only concerns like `metadata`.
 *
 * `noindex` is deliberate, and carried over from the sibling `layout.tsx` this
 * replaces: coach booking is on a waitlist and `/coaches` redirects to
 * `/booking`, so nothing links here. It also used to inherit `/coaches`'s
 * canonical, which told Google every coach profile was a duplicate of the
 * waitlist page.
 */
export const metadata: Metadata = noindexMetadata("Coach Profile");

export default function Page() {
  return <CoachDetailClient />;
}
