import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Content Policy",
  description:
    "PowerMySport's content policy covering community guidelines, prohibited content, and moderation on the PowerMySport platform.",
  alternates: {
    canonical: "/content-policy",
  },
};

export default function ContentPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
