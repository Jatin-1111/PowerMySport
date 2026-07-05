import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "FAQ — Common Questions About PowerMySport",
  description:
    "Answers to common questions about sports pathways, expert sessions, guidance plans, payments, and accounts on PowerMySport.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
