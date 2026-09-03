import { AIAssistantBubble } from "@/components/layout/AIAssistantBubble";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import React from "react";

/**
 * No `metadata` export here on purpose.
 *
 * This is a chrome-only layout shared by ~30 unrelated pages — rankings,
 * legal, resources, the homepage. It used to export the homepage's title,
 * description and a *partial* `openGraph` block, which caused two problems:
 *
 *  - Next.js merges `openGraph` by replacing the whole object, so a partial one
 *    here dropped `og:image`, `og:url`, `og:site_name` and `og:type` from every
 *    marketing page that did not redefine them.
 *  - A plain string `title` in a child segment is run through the parent's
 *    `%s | PowerMySport` template, so pages without their own title rendered
 *    "PowerMySport | Guiding Every Sporting Journey | PowerMySport".
 *
 * Each page now owns its title/description/canonical, and anything that does
 * not falls back cleanly to the root layout's defaults.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    // `overflow-x-clip`, not `overflow-x-hidden`. Both stop sideways scroll, but
    // `hidden` computes the other axis to `auto`, which turns this div into a
    // scroll container and silently breaks `position: sticky` for every
    // descendant on every marketing page — the sticky rail on the resource pages
    // simply scrolled away. `clip` prevents overflow without creating a scroll
    // container, so sticky keeps resolving against the viewport.
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* Navigation Header */}
      <Navigation variant="light" sticky />
      <div className="h-16" aria-hidden />

      {/* Main Content */}
      <main className="flex flex-1 flex-col">{children}</main>

      {/* Footer */}
      <Footer />

      {/* AI assistant entry point — floats bottom-right on all marketing pages */}
      <AIAssistantBubble />
    </div>
  );
}
