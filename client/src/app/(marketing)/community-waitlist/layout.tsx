import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Join the PowerMySport Community Waitlist",
  description:
    "Be first to access PowerMySport's community features — connect with parents, coaches, and experts planning youth sports journeys.",
  alternates: {
    canonical: "/community-waitlist",
  },
};

export default function CommunityWaitlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
