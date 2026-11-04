import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = noindexMetadata(
  "Notifications",
  "Your PowerMySport notifications."
);

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  // This route sits outside the (marketing) group, so it brings its own site chrome.
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Navigation variant="light" sticky />
      <div className="h-16" aria-hidden />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
