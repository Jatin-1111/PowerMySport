import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About PowerMySport — Why We Built This",
  description:
    "PowerMySport was built for parents navigating India's fragmented sports system. Learn our mission: making sports journey planning structured, accessible, and parent-friendly.",
  alternates: {
    canonical: "/about",
  },
};

import { AboutPageContent } from "./AboutPageContent";

export default function AboutPage() {
  return <AboutPageContent />;
}
