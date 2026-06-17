import React from "react";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PowerMySport Shop | Coming Soon",
  description: "Get ready to elevate your game with premium sports gear, customized equipment, and exclusive coaching bundles.",
};

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Navigation Header */}
      <Navigation variant="light" sticky />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
