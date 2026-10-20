import {
  MyChildBoard,
  MyChildComposite,
  MyChildMemory,
} from "@/modules/marketing/components/marketing/MyChildCombined";
import { MyChildTabs } from "@/modules/marketing/components/marketing/MyChildTabs";
import {
  MyChildCard,
  MyChildSources,
  MyChildTimeline,
} from "@/modules/marketing/components/marketing/MyChildSections";
import type { Metadata } from "next";

// Review page for the homepage "My Child" section options. Not linked from
// anywhere and kept out of search; delete it once one is chosen.
export const metadata: Metadata = {
  title: "Section lab",
  robots: { index: false, follow: false },
};

function Label({ children }: { children: string }) {
  return (
    <p className="bg-ink px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
      {children}
    </p>
  );
}

export default function SectionLabPage() {
  return (
    <main className="bg-paper">
      <Label>A. One example child as a card</Label>
      <MyChildCard />

      <Label>B. The same child as a timeline</Label>
      <MyChildTimeline />

      <Label>C. Five tabs, one per part of the picture</Label>
      <MyChildTabs />

      <Label>D. Where each fact came from</Label>
      <MyChildSources />

      <Label>E. Dark memory panel (Claude) with ruled entries (Linear)</Label>
      <MyChildMemory />

      <Label>F. A board of notes (Pinterest masonry, Figma off-axis notes)</Label>
      <MyChildBoard />

      <Label>G. Three product panels crossing the band edge (Stripe, Notion)</Label>
      <MyChildComposite />
    </main>
  );
}
