import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "How It Works — PowerMySport for Parents",
  description:
    "Learn how PowerMySport helps parents plan their child's sports career. Explore sport pathways, get personalised AI guidance, and connect with verified experts — in minutes.",
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
