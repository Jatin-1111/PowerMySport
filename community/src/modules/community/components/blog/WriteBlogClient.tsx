"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const EXCERPT_MAX_LENGTH = 300;
const MIN_TITLE_LENGTH = 5;
const AUTOSAVE_DEBOUNCE_MS = 2500;

type FormSnapshot = {
  title: string;
  excerpt: string;
  topic: string;
  tagsInput: string;
  coverImageKey: string | null;
  content: string;
};

export default function WriteBlogClient({ mode, blogId }: WriteBlogClientProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [topic, setTopic] = useState("General");
  const [tagsInput, setTagsInput] = useState("");
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);

  // The post this session is actually writing to — starts as the `blogId`
  // prop in edit mode, or undefined in create mode until the first
  // autosave/draft-save creates a real post to keep saving into.
  const [activeBlogId, setActiveBlogId] = useState<string | undefined>(blogId);
  // null until the post has been saved at least once.
  const [postStatus, setPostStatus] = useState<"DRAFT" | "PUBLISHED" | null>(null);

  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const savedSnapshotRef = useRef<FormSnapshot | null>(null);
  const autosavingRef = useRef(false);

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
        setExcerpt(blog.excerpt || "");
        setTopic(blog.topic || "General");
        setTagsInput((blog.tags || []).join(", "));
        setCoverImageKey(blog.coverImageKey);
        setCoverImageUrl(blog.coverImageUrl);
        setContent(blog.content || "");
        setPostStatus(blog.status);
        savedSnapshotRef.current = {
          title: blog.title,
          excerpt: blog.excerpt || "",
          topic: blog.topic || "General",
          tagsInput: (blog.tags || []).join(", "),
          coverImageKey: blog.coverImageKey,
          content: blog.content || "",
        };
      } else {
        savedSnapshotRef.current = {
          title: "",
          excerpt: "",
          topic: "General",
          tagsInput: "",
          coverImageKey: null,
          content: "",
        };
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load editor");
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

  const buildPayload = useCallback(
    () => ({
      title: title.trim(),
      excerpt: excerpt.trim() || undefined,
      topic,
      tags: parseTags(),
      coverImageKey,
      content,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, excerpt, topic, tagsInput, coverImageKey, content]
  );

  const markSaved = useCallback(() => {
    savedSnapshotRef.current = {
      title,
      excerpt,
      topic,
      tagsInput,
      coverImageKey,
      content,
    };
    setIsDirty(false);
  }, [title, excerpt, topic, tagsInput, coverImageKey, content]);

  // ── Dirty tracking ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const snap = savedSnapshotRef.current;
    const current: FormSnapshot = {
      title,
      excerpt,
      topic,
      tagsInput,
      coverImageKey,
      content,
    };
    setIsDirty(!snap || JSON.stringify(snap) !== JSON.stringify(current));
  }, [title, excerpt, topic, tagsInput, coverImageKey, content, isLoading]);

  // ── Warn before leaving with unsaved changes (tab close / reload) ──────
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Silent autosave (debounced) ─────────────────────────────────────────
  const autosave = useCallback(async () => {
    if (autosavingRef.current || isPublishing || isSavingDraft) return;
    if (title.trim().length < MIN_TITLE_LENGTH) return;

    autosavingRef.current = true;
    setAutosaveState("saving");
    try {
      const payload = buildPayload();
      const result = activeBlogId
        ? await blogService.updateBlog(activeBlogId, {
            ...payload,
            ...(postStatus === "PUBLISHED" ? {} : { status: "DRAFT" as const }),
          })
        : await blogService.createBlog({ ...payload, status: "DRAFT" });

      if (!activeBlogId) {
        setActiveBlogId(result.id);
        setPostStatus("DRAFT");
      }
      markSaved();
      setAutosaveState("saved");
    } catch {
      setAutosaveState("error");
    } finally {
      autosavingRef.current = false;
    }
  }, [activeBlogId, postStatus, title, isPublishing, isSavingDraft, buildPayload, markSaved]);

  useEffect(() => {
    if (isLoading || !isDirty) return;
    if (title.trim().length < MIN_TITLE_LENGTH) return;
    const timer = setTimeout(() => void autosave(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, excerpt, topic, tagsInput, coverImageKey, content, isDirty, isLoading, autosave]);

  const saveDraft = async () => {
    if (title.trim().length < MIN_TITLE_LENGTH) {
      toast.error(`Title must be at least ${MIN_TITLE_LENGTH} characters`);
      return;
    }
    setIsSavingDraft(true);
    try {
      const payload = buildPayload();
      const result = activeBlogId
        ? await blogService.updateBlog(activeBlogId, {
            ...payload,
            status: "DRAFT",
          })
        : await blogService.createBlog({ ...payload, status: "DRAFT" });

      setActiveBlogId(result.id);
      setPostStatus("DRAFT");
      markSaved();
      setAutosaveState("saved");
      toast.success("Draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const publish = async () => {
    if (title.trim().length < MIN_TITLE_LENGTH) {
      toast.error("Title must be at least 5 characters");
      return;
    }
    if (!htmlToText(content).trim()) {
      toast.error("Add content before publishing");
      return;
    }

    setIsPublishing(true);
    try {
      const payload = { ...buildPayload(), status: "PUBLISHED" as const };

      const result = activeBlogId
        ? await blogService.updateBlog(activeBlogId, payload)
        : await blogService.createBlog(payload);

      markSaved();
      toast.success(postStatus === "PUBLISHED" ? "Blog updated" : "Blog published");
      router.push(`/blog/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish");
      setIsPublishing(false);
    }
  };

  const handleBackClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) return;
    const proceed = window.confirm("You have unsaved changes. Leave without saving?");
    if (!proceed) event.preventDefault();
  };

  const saveIndicator = useMemo(() => {
    if (autosaveState === "saving") return "Saving…";
    if (autosaveState === "saved" && !isDirty) return "Saved";
    if (autosaveState === "error") return "Couldn't save — will retry";
    return null;
  }, [autosaveState, isDirty]);

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
            onClick={handleBackClick}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ChevronLeft size={16} />
            Back to Blog
          </Link>
          <div className="flex items-center gap-2">
            {saveIndicator && (
              <span
                className={`text-xs font-medium ${
                  autosaveState === "error" ? "text-amber-600" : "text-slate-400"
                }`}
              >
                {saveIndicator}
              </span>
            )}
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {postStatus === "PUBLISHED"
                ? "Editing story"
                : postStatus === "DRAFT"
                  ? "Draft"
                  : "New story"}
            </span>
          </div>
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

        {/* Excerpt / subtitle */}
        <div className="mt-3">
          <textarea
            value={excerpt}
            rows={2}
            maxLength={EXCERPT_MAX_LENGTH}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="A one or two line subtitle — shown on blog cards and previews (optional, auto-generated from your content if left blank)"
            className="focus:border-power-orange w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none placeholder:text-slate-300"
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {excerpt.length}/{EXCERPT_MAX_LENGTH}
          </p>
        </div>

        {/* Topic + tags */}
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Topic
            </label>
            <select
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
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
              className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
            />
          </div>
        </div>

        <div className="my-5 h-px bg-slate-100" />

        {/* Rich text editor */}
        <RichTextCanvas initialContent={content} onChange={setContent} />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Eye size={16} />
            Preview
          </button>
          {postStatus !== "PUBLISHED" && (
            <button
              onClick={() => void saveDraft()}
              disabled={isSavingDraft || isPublishing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {isSavingDraft ? <Loader2 size={16} className="animate-spin" /> : null}
              Save draft
            </button>
          )}
          <button
            onClick={() => void publish()}
            disabled={isPublishing || isSavingDraft}
            className="bg-power-orange shadow-power-orange/20 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#d96610] disabled:opacity-60"
          >
            {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {postStatus === "PUBLISHED" ? "Update" : "Publish"}
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
