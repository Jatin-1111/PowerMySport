import { Navigation } from "@/components/layout/Navigation";
import { NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure checkout for sports venue, coach, and academy bookings.",
  ...NOINDEX_METADATA,
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navigation sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
