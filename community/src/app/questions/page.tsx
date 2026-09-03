import QnAFeedClient from "@/modules/community/components/page/QnAFeedClient";
import { Suspense } from "react";
import { buildMetadata, fetchPublicData } from "@/lib/seo";
import {
  breadcrumbSchema,
  itemListSchema,
  JsonLd,
} from "@/modules/community/components/seo/JsonLd";

export const metadata = buildMetadata({
  title: "Sports Q&A — Ask & Answer Community Questions",
  description:
    "Ask sports questions and get answers from parents. Browse advice on coaching, training, equipment, injuries, nutrition, and tournaments.",
  path: "/questions",
});

interface QuestionRow {
  id: string;
  title?: string;
  content?: string;
}

export default async function CommunityQnAPage() {
  // Same reasoning as /blog: the feed is client-rendered, so the crawler needs
  // the list restated in schema to see this page has anything on it.
  const recent = await fetchPublicData<{ items?: QuestionRow[] }>(
    "/community/posts?page=1&limit=20"
  );

  const questions = (recent?.items ?? [])
    .map((row) => ({ id: row.id, name: row.title || row.content || "" }))
    .filter((row) => row.name);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Community", path: "/" },
            { name: "Q&A", path: "/questions" },
          ]),
          ...(questions.length
            ? [
                itemListSchema({
                  name: "Latest questions in the PowerMySport community",
                  path: "/questions",
                  items: questions.map((row) => ({
                    name: row.name,
                    path: `/questions/${row.id}`,
                  })),
                }),
              ]
            : []),
        ]}
      />
      <Suspense
        fallback={
          <div className="community-page-shell">
            <div className="community-content-wrap border-border rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
              <p className="mt-4 text-sm text-slate-500">Loading questions...</p>
            </div>
          </div>
        }
      >
        <QnAFeedClient />
      </Suspense>
    </>
  );
}
