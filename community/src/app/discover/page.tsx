import { Suspense } from "react";
import DiscoverPageClient from "@/modules/community/components/discover/DiscoverPageClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Discover Groups, Topics & Players",
  description:
    "Discover sports groups, trending topics, and players to connect with on the PowerMySport community.",
  path: "/discover",
});

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500">
          Loading discover...
        </div>
      }
    >
      <DiscoverPageClient />
    </Suspense>
  );
}
