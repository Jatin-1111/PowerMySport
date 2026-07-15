import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Get Expert Sports Guidance — Problem Solver for Your Child",
  description:
    "Tell us your child's challenge — a weakness to fix, a tournament to prepare for, or a level to break through — and get a personalised action plan. AI-powered, free to use.",
  alternates: {
    canonical: "https://www.powermysport.com/consult",
  },
  openGraph: {
    title: "Get Expert Sports Guidance — Problem Solver for Your Child",
    description:
      "Describe your child's sports challenge and get a targeted plan in under 2 minutes. AI-powered, state-specific, completely free.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  keywords: [
    "sports guidance for parents India",
    "fix my child's weakness in sport",
    "tournament preparation plan India",
    "AI sports consultation for kids",
    "child sports problem solver",
    "youth sports coaching advice India",
  ],
};

export default function ConsultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
