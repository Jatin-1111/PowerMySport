import type { Metadata } from "next";
import React from "react";

/**
 * Unlike its `(auth)` siblings, this page is deliberately **indexable**.
 *
 * The Aug 2026 indexing remediation noindexed the whole auth group as a block.
 * That is right for `forgot-password`/`reset-password` — they are token-bearing
 * and have no search value — but it cost us the one auth URL people actually
 * search for. "powermysport login" is the highest-intent navigational query a
 * returning user types, and with the page hidden Google not only failed to rank
 * it, it started telling searchers in an AI Overview that the product "does not
 * use a traditional password login portal" and pointing them at /assessment.
 *
 * There is no privacy argument for hiding this one: the URL is public, carries
 * no personal data, and is linked from the sitewide header. Compare the player
 * ranking pages, where the noindex is load-bearing for a real DPDP obligation.
 */
export const metadata: Metadata = {
  title: "Log In",
  description:
    "Log in to PowerMySport to pick up your child's sports pathway, view personalised guidance, and manage expert sessions and bookings.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
