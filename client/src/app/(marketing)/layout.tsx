import { AIAssistantBubble } from "@/components/layout/AIAssistantBubble";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "PowerMySport | Guiding Every Sporting Journey",
  description:
    "Plan your child's sports journey with AI-powered pathways, personalised guidance, and verified experts. State-specific roadmaps for 70+ sports across India. Free to explore.",
  openGraph: {
    title: "PowerMySport | Guiding Every Sporting Journey",
    description:
      "Plan your child's sports journey with AI-powered pathways, personalised guidance, and verified experts across India.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `overflow-x-clip`, not `overflow-x-hidden`. Both stop sideways scroll, but
    // `hidden` computes the other axis to `auto`, which turns this div into a
    // scroll container and silently breaks `position: sticky` for every
    // descendant on every marketing page — the sticky rail on the resource pages
    // simply scrolled away. `clip` prevents overflow without creating a scroll
    // container, so sticky keeps resolving against the viewport.
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* Navigation Header */}
      <Navigation variant="light" sticky />
      <div className="h-16" aria-hidden />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Footer */}
      <Footer />

      {/* AI assistant entry point — floats bottom-right on all marketing pages */}
      <AIAssistantBubble />
    </div>
  );
}
