import React from "react";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PowerMySport | Organizing the Unorganized Sports Sector",
  description:
    "PowerMySport is solving the biggest problem for parents by organizing the sports sector. Discover the right pathways, book venues, and find professional coaches for your child's sports journey.",
  openGraph: {
    title: "PowerMySport | Organizing the Unorganized Sports Sector",
    description:
      "Solving the biggest problem for parents by organizing the sports sector. Find and book the best sports venues, certified coaches, and academies.",
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

