"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, Loader2, Send } from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import { BLOG_TOPICS } from "@/modules/community/constants/blogTopics";
import { htmlToText } from "@/modules/community/utils/sanitizeHtml";
import RichTextCanvas from "./editor/RichTextCanvas";
import ImageBlockUploader from "./editor/ImageBlockUploader";
import BlogPreviewModal from "./BlogPreviewModal";

interface WriteBlogClientProps {
  mode: "create" | "edit";
  blogId?: string;
}

export default function WriteBlogClient({ mode, blogId }: WriteBlogClientProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("General");
  const [tagsInput, setTagsInput] = useState("");
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);

  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Size the title box to its content on load (edit mode).
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const init = useCallback(async () => {
    try {
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }
      const me = await blogService.getMyProfile();
      setProfile(me);

      if (mode === "edit" && blogId) {
        const blog = await blogService.getBlog(blogId);
        if (!blog.isMine) {
          toast.error("You can only edit your own stories");
          router.push(`/blog/${blogId}`);
          return;
        }
        setTitle(blog.title);
        setTopic(blog.topic || "General");
        setTagsInput((blog.tags || []).join(", "));
        setCoverImageKey(blog.coverImageKey);
        setCoverImageUrl(blog.coverImageUrl);
        setContent(blog.content || "");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load editor",
      );
    } finally {
      setIsLoading(false);
    }
  }, [mode, blogId, router]);

  useEffect(() => {
    void init();
  }, [init]);

  const parseTags = () =>
    tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);

  const publish = async () => {
    if (title.trim().length < 5) {
      toast.error("Give your story a title of at least 5 characters.");
      return;
    }
    if (!htmlToText(content).trim()) {
      toast.error("Add some content before publishing.");
      return;
    }

    setIsPublishing(true);
    try {
      const payload = {
        title: title.trim(),
        topic,
        tags: parseTags(),
        coverImageKey,
        content,
      };

      const result =
        mode === "edit" && blogId
          ? await blogService.updateBlog(blogId, payload)
          : await blogService.createBlog(payload);

      toast.success(mode === "edit" ? "Blog Updated!" : "Blog Published!");
      router.push(`/blog/${result.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish",
      );
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl justify-center px-4 py-16 text-slate-400">
        <Loader2 size={26} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-5.5rem)] bg-[linear-gradient(180deg,#f5f8ff_0%,#ffffff_45%)]">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ChevronLeft size={16} />
            Back to Blog
          </Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {mode === "edit" ? "Editing story" : "New story"}
          </span>
        </div>

        {/* Banner */}
        <div className="mt-5">
          <ImageBlockUploader
            imageUrl={coverImageUrl}
            onUploaded={(key, url) => {
              setCoverImageKey(key);
              setCoverImageUrl(url);
            }}
            onRemove={() => {
              setCoverImageKey(null);
              setCoverImageUrl(null);
            }}
            className="aspect-[16/6]"
            label="Add a cover image"
            hint="Drag & drop or click — this is the banner readers see first"
          />
        </div>

        {/* Title */}
        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          onChange={(event) => {
            setTitle(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${event.target.scrollHeight}px`;
          }}
          placeholder="Story title"
          className="font-title mt-5 w-full resize-none bg-transparent text-3xl font-bold leading-tight tracking-tight text-slate-900 outline-none placeholder:text-slate-300 sm:text-4xl"
        />

        {/* Topic + tags */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Topic
            </label>
            <select
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-power-orange"
            >
              {BLOG_TOPICS.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tags (comma separated)
            </label>
            <input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="e.g. footwork, endurance"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-power-orange"
            />
          </div>
        </div>

        <div className="my-5 h-px bg-slate-100" />

        {/* Rich text editor */}
        <RichTextCanvas initialContent={content} onChange={setContent} />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Eye size={16} />
            Preview
          </button>
          <button
            onClick={() => void publish()}
            disabled={isPublishing}
            className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-power-orange/20 transition hover:bg-[#d96610] disabled:opacity-60"
          >
            {isPublishing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {mode === "edit" ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      <BlogPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={title}
        topic={topic}
        coverImageUrl={coverImageUrl}
        content={content}
        authorName={profile?.name || "You"}
        authorUsername={profile?.username || ""}
        authorPhotoUrl={profile?.photoUrl}
      />
    </div>
  );
}
