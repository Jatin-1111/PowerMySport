import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "PowerMySport — Sports Career Planner for Parents",
  description:
    "Plan your child's sports career with AI-powered pathways, personalised guidance, and verified experts. State-specific roadmaps for 70+ sports across India. Free to explore.",
  openGraph: {
    title: "PowerMySport — Sports Career Planner for Parents",
    description:
      "Plan your child's sports career with AI-powered pathways, personalised guidance, and verified experts across India.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Navigation Header */}
      <Navigation variant="light" sticky />
      <div className="h-16" aria-hidden />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
