import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Health & Liability Waiver",
  description:
    "PowerMySport's health and liability waiver for booking sports sessions, coaching, and venue activities.",
  alternates: {
    canonical: "/health-waiver",
  },
};

export default function HealthWaiverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
