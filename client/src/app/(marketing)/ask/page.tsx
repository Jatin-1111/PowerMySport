import type { Metadata } from "next";

import { AskWorkspace } from "@/modules/guidance/components/ask/AskWorkspace";

/**
 * The full-page assistant. It is behind login, so there is nothing here for a
 * crawler to index; `noindex` keeps it out of results without hiding the links
 * it contains. The page itself is a static shell: the chat loads inside it, so
 * it is ready the instant a navigation lands (which is what lets the homepage
 * card morph into it).
 */
export const metadata: Metadata = {
  title: "Ask PowerMySport AI",
  description:
    "Ask about a sport, a pathway stage or an upcoming tournament, and get answers from PowerMySport's guides and listings.",
  robots: { index: false, follow: true },
};

export default function AskPage() {
  return <AskWorkspace />;
}
