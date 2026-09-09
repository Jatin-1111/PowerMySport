import type { Metadata } from "next";
import BlogDetailClient from "@/modules/community/components/blog/BlogDetailClient";
import { breadcrumbSchema, JsonLd } from "@/modules/community/components/seo/JsonLd";
import {
  buildMetadata,
  clampText,
  communityUrl,
  fetchPublicData,
  OG_IMAGE,
  stripHtml,
} from "@/lib/seo";
import type { BlogDetail } from "@/modules/community/types";

const getBlog = (blogId: string) =>
  fetchPublicData<BlogDetail>(`/community/experiences/posts/${blogId}`);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ blogId: string }>;
}): Promise<Metadata> {
  const { blogId } = await params;
  const blog = await getBlog(blogId);

  if (!blog) {
    return buildMetadata({
      title: "Parent Experience",
      description:
        "Read what other parents experienced — tournaments, academies, gear, travel and costs.",
      path: `/experiences/${blogId}`,
    });
  }

  const description = clampText(blog.excerpt || stripHtml(blog.content) || "", 160);

  return buildMetadata({
    title: blog.title,
    description,
    path: `/experiences/${blogId}`,
    image: blog.coverImageUrl || OG_IMAGE,
    keywords: blog.tags?.length ? blog.tags : undefined,
    type: "article",
    publishedTime: blog.createdAt,
    modifiedTime: blog.updatedAt,
    authors: blog.author?.name ? [blog.author.name] : undefined,
  });
}

export default async function CommunityExperienceDetailPage({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const { blogId } = await params;
  const blog = await getBlog(blogId);

  const articleSchema = blog
    ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: blog.title,
        description: clampText(blog.excerpt || stripHtml(blog.content), 200),
        image: blog.coverImageUrl || OG_IMAGE,
        datePublished: blog.createdAt,
        dateModified: blog.updatedAt,
        url: communityUrl(`/experiences/${blogId}`),
        keywords: blog.tags?.join(", ") || undefined,
        articleSection: blog.category || blog.topic || undefined,
        author: {
          "@type": "Person",
          name: blog.author?.name || "PowerMySport Community",
        },
        publisher: {
          "@type": "Organization",
          name: "PowerMySport",
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": communityUrl(`/experiences/${blogId}`),
        },
      }
    : null;

  return (
    <>
      {blog && articleSchema ? (
        <JsonLd
          data={[
            articleSchema,
            breadcrumbSchema([
              { name: "Community", path: "/" },
              { name: "Experiences", path: "/experiences" },
              { name: blog.title, path: `/experiences/${blogId}` },
            ]),
          ]}
        />
      ) : null}
      <BlogDetailClient blogId={blogId} initialBlog={blog} />
    </>
  );
}
