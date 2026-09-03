import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

import DashboardLayoutShell from "./LayoutShell";

/**
 * The real layout is a `"use client"` component (auth store, notifications,
 * nav state), which cannot export `metadata`. This server wrapper exists purely
 * to hold the SEO directives for the whole `/dashboard` tree.
 *
 * These routes are also disallowed in robots.txt. The `noindex` is not
 * redundant: a disallowed URL that is linked from anywhere can still be indexed
 * URL-only, and it is the tag — not the disallow — that gets it dropped.
 */
export const metadata: Metadata = noindexMetadata("Dashboard", "Your PowerMySport dashboard.");

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
