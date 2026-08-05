import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Log In",
  ...NOINDEX_METADATA,
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
