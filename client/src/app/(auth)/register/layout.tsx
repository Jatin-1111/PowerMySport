import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Create Your Account",
  ...NOINDEX_METADATA,
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
