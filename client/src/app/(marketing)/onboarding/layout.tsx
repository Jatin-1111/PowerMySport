import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "List Your Venue",
  ...NOINDEX_METADATA,
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
