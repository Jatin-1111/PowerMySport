import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Careers at PowerMySport",
  description:
    "Join PowerMySport's engineering, design, and operations team building India's sports pathway platform for parents and young athletes.",
  alternates: {
    canonical: "/careers",
  },
};

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
