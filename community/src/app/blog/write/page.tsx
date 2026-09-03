import WriteBlogClient from "@/modules/community/components/blog/WriteBlogClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Write a Blog",
  description: "Share a story, coaching tip, or insight with the PowerMySport community.",
  path: "/blog/write",
  noindex: true,
});

export default function WriteBlogPage() {
  return <WriteBlogClient mode="create" />;
}
