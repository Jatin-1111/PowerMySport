import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * Reached from a link in a private WhatsApp chat. The link is a credential, so the page is kept
 * out of search results and never passes the address on to another site.
 */
export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: "Continue from WhatsApp",
  referrer: "no-referrer",
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
