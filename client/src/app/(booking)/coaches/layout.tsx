import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Sports Coaches | Professional Coach Booking",
  description:
    "Connect with certified professional sports coaches for personalized training. The best coach booking platform for cricket, football, tennis, and more.",
  openGraph: {
    title: "Find Sports Coaches | Professional Coach Booking",
    description:
      "Connect with certified professional sports coaches for personalized training. The best coach booking platform.",
  },
};

export default function CoachesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <Navigation variant="dark" sticky />

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
