import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Contact Us — PowerMySport",
  description:
    "Get in touch with the PowerMySport team. We're here to help parents, coaches, and venue owners with any questions.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
