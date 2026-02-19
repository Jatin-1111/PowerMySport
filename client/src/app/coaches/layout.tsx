"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";

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
