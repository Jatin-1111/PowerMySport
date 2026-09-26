import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "How It Works | PowerMySport for Parents",
  description:
    "How PowerMySport helps parents today: a stage-by-stage roadmap for each sport, a community of parents to ask, and support carrying the plan out, from verified experts to federation calendars and rankings.",
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
