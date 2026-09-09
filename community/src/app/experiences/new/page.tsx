import { Suspense } from "react";
import WriteBlogClient from "@/modules/community/components/blog/WriteBlogClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Share Your Experience",
  description:
    "Share an experience with the PowerMySport community and help another parent make a better decision.",
  path: "/experiences/new",
  noindex: true,
});

export default function NewExperiencePage() {
  // WriteBlogClient reads the subject deep-link (?subjectKind=&subjectRefId=&
  // subjectName=&subjectSlug=) via useSearchParams, which Next.js requires a
  // Suspense boundary for during static generation.
  return (
    <Suspense fallback={null}>
      <WriteBlogClient mode="create" />
    </Suspense>
  );
}
