import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = noindexMetadata(
  "My Orders",
  "Track your PowerMySport shop orders.",
);

export default function ShopOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
