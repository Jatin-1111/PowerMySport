import { Suspense } from "react";
import CommunityHomeClient from "@/modules/community/components/page/CommunityHomeClient";

export default function CommunityPage() {
    return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="flex animate-pulse flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-power-orange" />
            <p className="mt-4 text-sm text-slate-500">Loading Community...</p>
            </div>
          </div>
      }
    >
      <CommunityHomeClient />
    </Suspense>
  );
}
