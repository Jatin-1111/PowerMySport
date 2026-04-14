import QnAFeedClient from "@/modules/community/components/page/QnAFeedClient";
import { Suspense } from "react";

export default function CommunityQnAPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading knowledge feed...</p>
          </div>
        </div>
      }
    >
      <QnAFeedClient />
    </Suspense>
  );
}
