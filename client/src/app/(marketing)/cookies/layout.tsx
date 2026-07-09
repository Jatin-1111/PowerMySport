import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How PowerMySport uses essential cookies to keep you signed in and secure, plus anonymous analytics — no ads, no personal data sold.",
  alternates: {
    canonical: "/cookies",
  },
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
