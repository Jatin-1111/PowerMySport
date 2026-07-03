import type { Metadata } from "next";
import BlogDetailClient from "@/modules/community/components/blog/BlogDetailClient";
import { JsonLd } from "@/modules/community/components/seo/JsonLd";
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
  fetchPublicData<BlogDetail>(`/community/blog/posts/${blogId}`);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ blogId: string }>;
}): Promise<Metadata> {
  const { blogId } = await params;
  const blog = await getBlog(blogId);

  if (!blog) {
    return buildMetadata({
      title: "Blog Post",
      description:
        "Read stories, coaching tips, and expert sports advice on the PowerMySport community blog.",
      path: `/blog/${blogId}`,
    });
  }

  const description = clampText(
    blog.excerpt || stripHtml(blog.content) || "",
    160,
  );

  return buildMetadata({
    title: blog.title,
    description,
    path: `/blog/${blogId}`,
    image: blog.coverImageUrl || OG_IMAGE,
    keywords: blog.tags?.length ? blog.tags : undefined,
    type: "article",
    publishedTime: blog.createdAt,
    modifiedTime: blog.updatedAt,
    authors: blog.author?.name ? [blog.author.name] : undefined,
  });
}

export default async function CommunityBlogDetailPage({
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
        url: communityUrl(`/blog/${blogId}`),
        keywords: blog.tags?.join(", ") || undefined,
        articleSection: blog.topic || undefined,
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
          "@id": communityUrl(`/blog/${blogId}`),
        },
      }
    : null;

  return (
    <>
      {articleSchema ? <JsonLd data={articleSchema} /> : null}
      <BlogDetailClient blogId={blogId} />
    </>
  );
}
