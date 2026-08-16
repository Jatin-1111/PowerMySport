import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = noindexMetadata(
  "Saved",
  "Venues, coaches and academies you have saved.",
);

export default function SavedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
