import { Suspense } from "react";
import WriteBlogClient from "@/modules/community/components/blog/WriteBlogClient";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

// Per-post canonical — a static `path: "/experiences/edit"` would give every
// blogId the same canonical URL. See the note in join/[code]/layout.tsx.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ blogId: string }>;
}): Promise<Metadata> {
  const { blogId } = await params;
  return buildMetadata({
    title: "Edit Experience",
    description: "Edit the experience you shared with the PowerMySport community.",
    path: `/experiences/${blogId}/edit`,
    noindex: true,
  });
}

export default async function EditExperiencePage({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const { blogId } = await params;
  // WriteBlogClient calls useSearchParams (for the create-mode subject
  // deep-link) unconditionally, which Next.js requires a Suspense boundary
  // for during static generation, even here in edit mode where it's unused.
  return (
    <Suspense fallback={null}>
      <WriteBlogClient mode="edit" blogId={blogId} />
    </Suspense>
  );
}
