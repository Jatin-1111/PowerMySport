import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Parental Consent",
  description:
    "Parental consent requirements for minors using PowerMySport's coaching, booking, and guidance services.",
  alternates: {
    canonical: "/parental-consent",
  },
};

export default function ParentalConsentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
