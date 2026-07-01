import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Book Venues, Coaches & Academies | PowerMySport",
  description:
    "Find and book top sports venues, certified coaches, and elite academies — all in one place.",
  openGraph: {
    title: "Book Sports | PowerMySport",
    description:
      "Discover and book venues, coaches, and academies for every sport.",
  },
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navigation sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
