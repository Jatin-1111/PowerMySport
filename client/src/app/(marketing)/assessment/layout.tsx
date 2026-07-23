import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started | PowerMySport",
  description:
    "Tell us whether you already know your child's sport or need help finding the right fit — we'll build the right plan either way.",
  alternates: { canonical: "https://www.powermysport.com/assessment" },
};

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
