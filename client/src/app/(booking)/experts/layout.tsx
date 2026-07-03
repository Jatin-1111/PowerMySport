import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Sports Experts | Book 1:1 Guidance Sessions",
  description:
    "Browse verified sports experts and book paid 1:1 guidance sessions. Pay securely, schedule a time that works, and rate your expert after the session.",
  openGraph: {
    title: "Find Sports Experts | Book 1:1 Guidance Sessions",
    description:
      "Browse verified sports experts and book paid 1:1 guidance sessions on PowerMySport.",
  },
};

export default function ExpertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation variant="dark" sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
