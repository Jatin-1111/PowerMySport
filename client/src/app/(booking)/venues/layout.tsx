import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sports Venue Booking | Book Turf & Courts Online",
  description:
    "Find and book the best sports venues near you. PowerMySport is the premium venue booking platform sports players use to book turf, courts, and fields instantly.",
  openGraph: {
    title: "Sports Venue Booking | Book Turf & Courts Online",
    description:
      "Find and book the best sports venues near you. Book turf, courts, and fields instantly.",
  },
};

export default function VenuesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
