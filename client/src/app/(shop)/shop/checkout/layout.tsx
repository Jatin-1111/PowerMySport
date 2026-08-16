import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = noindexMetadata(
  "Shop Checkout",
  "Complete your PowerMySport shop order.",
);

export default function ShopCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
