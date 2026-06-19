import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | PowerMySport",
  description: "Learn how PowerMySport is organizing the unorganized sports sector to help parents chart the perfect athletic journey for their children.",
};

import { AboutPageContent } from "./AboutPageContent";

export default function AboutPage() {
  return <AboutPageContent />;
}
