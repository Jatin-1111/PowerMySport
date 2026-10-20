import {
  HowStepper,
  HowScrollStory,
} from "@/modules/marketing/components/marketing/HowItWorksInteractive";
import {
  HowBento,
  HowColumns,
  HowSpecimens,
  HowStaircase,
} from "@/modules/marketing/components/marketing/HowItWorksVariants";
import { JourneySteps } from "@/modules/marketing/components/marketing/JourneySteps";
import type { Metadata } from "next";

// Review page for the homepage "How it works" options. Not linked from anywhere
// and kept out of search; delete it once one is chosen.
export const metadata: Metadata = {
  title: "How it works lab",
  robots: { index: false, follow: false },
};

function Label({ children }: { children: string }) {
  return (
    <p className="bg-ink px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
      {children}
    </p>
  );
}

export default function HowLabPage() {
  return (
    <main className="bg-paper">
      <Label>A. Five ruled columns</Label>
      <HowColumns />

      <Label>B. A staircase, one hairline along every step</Label>
      <HowStaircase />

      <Label>C. A stepper: pick a step, read its detail</Label>
      <HowStepper />

      <Label>D. One example conversation (Intercom, Slack)</Label>
      <JourneySteps />

      <Label>E. Each step beside what the parent sees</Label>
      <HowSpecimens />

      <Label>F. Scroll story: a giant numeral changes as each step is read</Label>
      <HowScrollStory />

      <Label>G. Asymmetric bento, swipes sideways on a phone</Label>
      <HowBento />
    </main>
  );
}
