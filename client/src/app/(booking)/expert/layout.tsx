import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expert Dashboard | PowerMySport",
  description:
    "Manage the sessions clients have booked with you, track earnings and ratings.",
};

export default function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation variant="dark" sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1 bg-slate-50">{children}</main>
      <Footer />
    </div>
  );
}
