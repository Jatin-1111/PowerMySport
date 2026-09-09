import WriteBlogClient from "@/modules/community/components/blog/WriteBlogClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Write a Blog",
  description:
    "Share an experience with the PowerMySport community and help another parent make a better decision.",
  path: "/blog/write",
  noindex: true,
});

export default function WriteBlogPage() {
  return <WriteBlogClient mode="create" />;
}
