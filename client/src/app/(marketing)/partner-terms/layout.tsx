import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Partner Terms — Experts & Academies",
  description:
    "Onboarding terms and conditions for Experts and Academies on PowerMySport, including the 15% platform commission, payout timelines, verification, and termination.",
  alternates: {
    canonical: "/partner-terms",
  },
};

export default function PartnerTermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
