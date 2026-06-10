import React from "react";
import type { Metadata } from "next";

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
  return <>{children}</>;
}
