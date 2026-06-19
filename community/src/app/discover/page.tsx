import { Suspense } from "react";
import { Metadata } from "next";
import DiscoverPageClient from "@/modules/community/components/discover/DiscoverPageClient";

export const metadata: Metadata = {
  title: "Discover - PowerMySport Community",
  description: "Discover new communities and players on PowerMySport.",
};

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading discover...</div>}>
      <DiscoverPageClient />
    </Suspense>
  );
}
