import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Personalised Sports Guidance — Plan Built for Your Child",
  description:
    "Answer 4 questions about your child — age, goals, budget, personality — and get a personalised sports roadmap with cost breakdown, burnout risk, and next steps. Powered by AI, free to use.",
  alternates: {
    canonical: "/guidance",
  },
  openGraph: {
    title: "Personalised Sports Guidance — Plan Built for Your Child",
    description:
      "Get a personalised sports plan for your child in under 2 minutes. AI-powered, state-specific, completely free.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  keywords: [
    "personalised sports plan India",
    "AI sports guidance for kids",
    "child sports career planner",
    "sports guidance for parents India",
    "which sport should my child play",
    "youth sports planning India",
  ],
};

export default function GuidanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
