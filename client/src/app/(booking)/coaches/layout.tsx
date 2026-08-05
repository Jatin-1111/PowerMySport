import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Sports Coach Booking — Launching Soon",
  description:
    "Personalised training with certified sports coaches is launching soon on PowerMySport. Join the waitlist to get notified when coach booking opens.",
  alternates: {
    canonical: "/coaches",
  },
  openGraph: {
    title: "Sports Coach Booking — Launching Soon",
    description:
      "Personalised training with certified sports coaches is launching soon. Join the waitlist.",
  },
};

export default function CoachesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navigation variant="dark" sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
