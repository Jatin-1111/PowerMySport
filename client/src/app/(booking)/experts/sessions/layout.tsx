import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * A parent's own booked sessions. Sits under `/experts` only for URL tidiness —
 * it is private, and it previously inherited `/experts`'s canonical, pointing
 * every session page at the public expert directory.
 */
export const metadata: Metadata = noindexMetadata(
  "My Expert Sessions",
  "Your booked 1:1 sessions with PowerMySport experts.",
);

export default function ExpertSessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
