import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find the Right Sport for Your Child | PowerMySport",
  description:
    "Answer 20 questions and get a personalised sport recommendation for your child — based on personality, physical traits, budget, and goals.",
  alternates: { canonical: "https://www.powermysport.com/pathway" },
};

export default function PathwayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
