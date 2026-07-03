import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "AI Sports Guidance — A Roadmap for Your Young Athlete",
  description:
    "Answer a few quick questions and get a personalised sports roadmap for your child — guidance on the right sport, coaching style, weekly schedule, and next actions.",
  path: "/ai-guidance",
  keywords: [
    "AI sports guidance",
    "sports roadmap for kids",
    "which sport for my child",
    "youth athlete plan",
    "personalised sports plan",
  ],
});

export default function AiGuidanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
