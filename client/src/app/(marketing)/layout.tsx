"use client";

import React from "react";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";


export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <Navigation variant="light" sticky />

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
