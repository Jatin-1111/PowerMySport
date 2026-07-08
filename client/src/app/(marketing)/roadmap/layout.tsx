import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Sports Pathway Explorer — Roadmap for Your Child",
  description:
    "Explore step-by-step sports pathways for 70+ sports across all 28 Indian states. From beginner to elite — benchmarks, costs, trials, schemes, and expert tips. Free, instant, state-specific.",
  alternates: {
    canonical: "/roadmap",
  },
  openGraph: {
    title: "Sports Pathway Explorer — Roadmap for Your Child",
    description:
      "AI-powered sports roadmaps for parents. Any sport, any state in India. Benchmarks, costs, government schemes, and expert guidance — free to explore.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  keywords: [
    "sports pathway India",
    "sports roadmap for kids",
    "how to become a professional athlete India",
    "youth sports development India",
    "Khelo India pathway",
    "cricket pathway India",
    "badminton roadmap India",
    "football journey path India",
    "state sports academy India",
  ],
};

export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
