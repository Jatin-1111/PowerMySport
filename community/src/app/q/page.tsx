import QnAFeedClient from "@/modules/community/components/page/QnAFeedClient";
import { Suspense } from "react";

export default function CommunityQnAPage() {
  return (
    <Suspense
      fallback={
        <div className="community-page-shell">
          <div className="community-content-wrap rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
            <p className="mt-4 text-sm text-slate-500">
              Loading knowledge feed...
            </p>
          </div>
        </div>
      }
    >
      <QnAFeedClient />
    </Suspense>
  );
}
