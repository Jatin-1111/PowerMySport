import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

/**
 * Per-user shop state. These routes were neither disallowed in robots.txt nor
 * noindexed, and inherited the homepage canonical on top of that.
 */
export const metadata: Metadata = noindexMetadata("Cart", "Your PowerMySport shop cart.");

export default function ShopCartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
