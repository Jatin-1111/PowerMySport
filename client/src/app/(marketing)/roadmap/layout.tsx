import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Sports Pathway Explorer — Roadmap for Your Child",
  description:
    "Stage-by-stage sports pathways for Indian parents. Where your child is now, what to look for, the decisions ahead, and what to do next — written with coaches and experienced parents. Free to read.",
  alternates: {
    canonical: "/roadmap",
  },
  openGraph: {
    title: "Sports Pathway Explorer — Roadmap for Your Child",
    description:
      "Sports roadmaps for parents in India. Every stage answers the same five questions — where you are, what parents ask, what to look for, what to decide, what to do next.",
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
  ],
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
