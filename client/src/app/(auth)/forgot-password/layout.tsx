import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Reset Your Password",
  ...NOINDEX_METADATA,
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
