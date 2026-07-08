import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Discover Sports Academies | Top Sports Training",
  description:
    "Explore and join the best sports academies. Find verified programs for basketball, cricket, football, and more for all age groups.",
  openGraph: {
    title: "Discover Sports Academies | Top Sports Training",
    description:
      "Explore and join the best sports academies. Find verified programs for basketball, cricket, football, and more for all age groups.",
  },
};

export default function AcademiesLayout({
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
