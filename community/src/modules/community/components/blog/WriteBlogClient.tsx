"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Eye, Loader2, Send } from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import { EXPERIENCE_SPORTS, getExperienceCategory } from "@/modules/community/constants/experienceTaxonomy"; // prettier-ignore
import {
  MODERATED_SUBJECT_KINDS,
  SUBJECT_KINDS,
  type SignalKey,
  type SignalValue,
} from "@/modules/community/constants/experienceSubjects";
import { htmlToText } from "@/modules/community/utils/sanitizeHtml";
import RichTextCanvas from "./editor/RichTextCanvas";
import ImageBlockUploader from "./editor/ImageBlockUploader";
import BlogPreviewModal from "./BlogPreviewModal";
import CategoryPicker from "./CategoryPicker";
import SubjectPicker, { type SelectedSubject } from "./SubjectPicker";
import SignalQuestions from "./SignalQuestions";

interface WriteBlogClientProps {
  mode: "create" | "edit";
  blogId?: string;
}

const EXCERPT_MAX_LENGTH = 300;
const AUTOSAVE_DEBOUNCE_MS = 2500;

type FormSnapshot = {
  title: string;
  excerpt: string;
  category: string;
  sport: string;
  tagsInput: string;
  coverImageKey: string | null;
  content: string;
  subject: SelectedSubject | null;
  signals: Partial<Record<SignalKey, SignalValue>>;
  attendedAt: string;
};

const emptySignals: Partial<Record<SignalKey, SignalValue>> = {};

const VALID_SUBJECT_KINDS = new Set(SUBJECT_KINDS.map((meta) => meta.kind));

/**
 * The entity page's "Share your experience" CTA (ParentExperiencesBand in the
 * client app) deep-links here with the subject already known, via
 * getCommunityAppUrl({ path: "experiences/new", searchParams: {...} }).
 * Malformed or missing params simply fall back to the ordinary picker rather
 * than failing the page.
 */
const readSubjectFromSearchParams = (params: URLSearchParams): SelectedSubject | null => {
  const kind = params.get("subjectKind");
  const refId = params.get("subjectRefId");
  const nameSnapshot = params.get("subjectName");
  if (!kind || !refId || !nameSnapshot) return null;
  if (!VALID_SUBJECT_KINDS.has(kind as SelectedSubject["kind"])) return null;

  return {
    kind: kind as SelectedSubject["kind"],
    refId,
    nameSnapshot,
    slugSnapshot: params.get("subjectSlug"),
  };
};

export default function WriteBlogClient({ mode, blogId }: WriteBlogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  // Empty until picked (create) or hydrated from the loaded post (edit) — an
  // empty category is what puts the picker screen up front.
  const [category, setCategory] = useState("");
  const [sport, setSport] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  // Intrinsic size of the cover, measured in the browser at upload. Not part of
  // the dirty snapshot: it only ever changes together with `coverImageKey`.
  const [coverImageWidth, setCoverImageWidth] = useState<number | null>(null);
  const [coverImageHeight, setCoverImageHeight] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState<SelectedSubject | null>(null);
  const [signals, setSignals] = useState<Partial<Record<SignalKey, SignalValue>>>(emptySignals);
  const [attendedAt, setAttendedAt] = useState("");
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
          toast.error("You can only edit your own experiences");
          router.push(`/experiences/${blogId}`);
          return;
        }
        setTitle(blog.title);
        setExcerpt(blog.excerpt || "");
        setCategory(blog.category || "general");
        setSport(blog.sport || "");
        setTagsInput((blog.tags || []).join(", "));
        setCoverImageKey(blog.coverImageKey);
        setCoverImageUrl(blog.coverImageUrl);
        setCoverImageWidth(blog.coverImageWidth ?? null);
        setCoverImageHeight(blog.coverImageHeight ?? null);
        setContent(blog.content || "");
        setPostStatus(blog.status);
        const loadedSubject: SelectedSubject | null = blog.subject
          ? {
              kind: blog.subject.kind,
              refId: blog.subject.refId,
              nameSnapshot: blog.subject.name,
              slugSnapshot: blog.subject.slug,
            }
          : null;
        setSubject(loadedSubject);
        setSignals((blog.signals as Partial<Record<SignalKey, SignalValue>>) || emptySignals);
        setAttendedAt(blog.attendedAt ? blog.attendedAt.slice(0, 10) : "");
        savedSnapshotRef.current = {
          title: blog.title,
          excerpt: blog.excerpt || "",
          category: blog.category || "general",
          sport: blog.sport || "",
          tagsInput: (blog.tags || []).join(", "),
          coverImageKey: blog.coverImageKey,
          content: blog.content || "",
          subject: loadedSubject,
          signals: (blog.signals as Partial<Record<SignalKey, SignalValue>>) || emptySignals,
          attendedAt: blog.attendedAt ? blog.attendedAt.slice(0, 10) : "",
        };
      } else {
        // Deep-linked from an entity page's "Share your experience" CTA
        // (ParentExperiencesBand in the client app) — the subject is already
        // known, so skip straight past the search step.
        const deepLinkedSubject = readSubjectFromSearchParams(searchParams);
        if (deepLinkedSubject) setSubject(deepLinkedSubject);

        savedSnapshotRef.current = {
          title: "",
          excerpt: "",
          category: "",
          sport: "",
          tagsInput: "",
          coverImageKey: null,
          content: "",
          subject: deepLinkedSubject,
          signals: emptySignals,
          attendedAt: "",
        };
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load editor");
    } finally {
      setIsLoading(false);
    }
  }, [mode, blogId, router, searchParams]);

  useEffect(() => {
    void init();
  }, [init]);

  const parseTags = () =>
    tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);

  // Signals only mean anything alongside a subject — dropping them the moment
  // the subject is removed keeps a stale answer from lingering unseen.
  const handleSubjectChange = useCallback((next: SelectedSubject | null) => {
    setSubject(next);
    if (!next) setSignals(emptySignals);
  }, []);

  const buildPayload = useCallback(
    () => ({
      title: title.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      category,
      sport: sport || null,
      tags: parseTags(),
      coverImageKey,
      coverImageWidth,
      coverImageHeight,
      content,
      subject: subject
        ? {
            kind: subject.kind,
            refId: subject.refId,
            nameSnapshot: subject.nameSnapshot,
            slugSnapshot: subject.slugSnapshot,
          }
        : null,
      signals: subject ? signals : null,
      attendedAt: attendedAt || null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      title,
      excerpt,
      category,
      sport,
      tagsInput,
      coverImageKey,
      content,
      subject,
      signals,
      attendedAt,
    ]
  );

  const markSaved = useCallback(() => {
    savedSnapshotRef.current = {
      title,
      excerpt,
      category,
      sport,
      tagsInput,
      coverImageKey,
      content,
      subject,
      signals,
      attendedAt,
    };
    setIsDirty(false);
  }, [
    title,
    excerpt,
    category,
    sport,
    tagsInput,
    coverImageKey,
    content,
    subject,
    signals,
    attendedAt,
  ]);

  // ── Dirty tracking ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const snap = savedSnapshotRef.current;
    const current: FormSnapshot = {
      title,
      excerpt,
      category,
      sport,
      tagsInput,
      coverImageKey,
      content,
      subject,
      signals,
      attendedAt,
    };
    setIsDirty(!snap || JSON.stringify(snap) !== JSON.stringify(current));
  }, [title, excerpt, category, sport, tagsInput, coverImageKey, content, subject, signals, attendedAt, isLoading]); // prettier-ignore

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

  // A category has to be picked before there is anything worth saving — it is
  // the one thing the composer cannot derive on its own.
  const hasCategory = category.trim().length > 0;

  // ── Silent autosave (debounced) ─────────────────────────────────────────
  const autosave = useCallback(async () => {
    if (autosavingRef.current || isPublishing || isSavingDraft || !hasCategory) return;

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
  }, [activeBlogId, postStatus, isPublishing, isSavingDraft, hasCategory, buildPayload, markSaved]);

  useEffect(() => {
    if (isLoading || !isDirty || !hasCategory) return;
    const timer = setTimeout(() => void autosave(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, excerpt, category, sport, tagsInput, coverImageKey, content, subject, signals, attendedAt, isDirty, isLoading, hasCategory, autosave]); // prettier-ignore

  const hasSomethingToPublish = () => Boolean(htmlToText(content).trim() || coverImageKey);

  const saveDraft = async () => {
    if (!hasCategory) {
      toast.error("Pick what this is about first");
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
    if (!hasCategory) {
      toast.error("Pick what this is about first");
      return;
    }
    if (!hasSomethingToPublish()) {
      toast.error("Add a few words or a photo before publishing");
      return;
    }

    setIsPublishing(true);
    try {
      const payload = { ...buildPayload(), status: "PUBLISHED" as const };

      const result = activeBlogId
        ? await blogService.updateBlog(activeBlogId, payload)
        : await blogService.createBlog(payload);

      markSaved();
      const isModerated = subject && MODERATED_SUBJECT_KINDS.includes(subject.kind);
      toast.success(
        isModerated
          ? "Submitted — this will be visible once it's reviewed"
          : postStatus === "PUBLISHED"
            ? "Experience updated"
            : "Experience shared"
      );
      router.push(`/experiences/${result.id}`);
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

  // Create mode, nothing picked or saved yet: ask what this is about before
  // showing anything that looks like a form.
  if (mode === "create" && !hasCategory && !activeBlogId) {
    return <CategoryPicker onSelect={setCategory} />;
  }

  const categoryMeta = getExperienceCategory(category);

  return (
    <div className="relative min-h-[calc(100vh-5.5rem)] bg-[linear-gradient(180deg,#f5f8ff_0%,#ffffff_45%)]">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/experiences"
            onClick={handleBackClick}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ChevronLeft size={16} />
            Back to Experiences
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
                ? "Editing experience"
                : postStatus === "DRAFT"
                  ? "Draft"
                  : "Share your experience"}
            </span>
          </div>
        </div>

        {/* Category chip — always changeable, never blocks editing */}
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 ${categoryMeta.accent}`}
        >
          <categoryMeta.Icon size={13} />
          {categoryMeta.label}
        </button>

        {/* Banner */}
        <div className="mt-4">
          <ImageBlockUploader
            imageUrl={coverImageUrl}
            imageWidth={coverImageWidth}
            imageHeight={coverImageHeight}
            onUploaded={(key, url, size) => {
              setCoverImageKey(key);
              setCoverImageUrl(url);
              setCoverImageWidth(size?.width ?? null);
              setCoverImageHeight(size?.height ?? null);
            }}
            onRemove={() => {
              setCoverImageKey(null);
              setCoverImageUrl(null);
              setCoverImageWidth(null);
              setCoverImageHeight(null);
            }}
            // The empty drop zone keeps a wide shape; once there is an image the
            // uploader sizes to it rather than cropping to a banner.
            className="aspect-[16/6]"
            label="Add a photo"
            hint="A photo and a couple of lines is a complete experience on its own"
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
          placeholder="Give it a title (optional)"
          className="font-title mt-5 w-full resize-none bg-transparent text-3xl font-bold leading-tight tracking-tight text-slate-900 outline-none placeholder:text-slate-300 sm:text-4xl"
        />

        {/* Excerpt / subtitle */}
        <div className="mt-3">
          <textarea
            value={excerpt}
            rows={2}
            maxLength={EXCERPT_MAX_LENGTH}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="A one or two line subtitle — shown on cards and previews (optional, auto-generated from your content if left blank)"
            className="focus:border-power-orange w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none placeholder:text-slate-300"
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {excerpt.length}/{EXCERPT_MAX_LENGTH}
          </p>
        </div>

        {/* Subject anchor */}
        <div className="mt-3">
          <SubjectPicker value={subject} onChange={handleSubjectChange} />
        </div>

        {subject && (
          <div className="mt-3">
            <SignalQuestions
              subjectKind={subject.kind}
              values={signals}
              onChange={(key, value) => setSignals((prev) => ({ ...prev, [key]: value }))}
              attendedAt={attendedAt}
              onAttendedAtChange={setAttendedAt}
            />
          </div>
        )}

        {/* Sport + tags */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Sport (optional)
            </label>
            <select
              value={sport}
              onChange={(event) => setSport(event.target.value)}
              className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
            >
              <option value="">Not sport-specific</option>
              {EXPERIENCE_SPORTS.map((option) => (
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

        {/* Rich text editor — seeded with the category's own question */}
        <RichTextCanvas
          initialContent={content}
          onChange={setContent}
          placeholder={categoryMeta.prompt}
        />
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
        topic={category}
        coverImageUrl={coverImageUrl}
        coverImageWidth={coverImageWidth}
        coverImageHeight={coverImageHeight}
        content={content}
        authorName={profile?.name || "You"}
        authorUsername={profile?.username || ""}
        authorPhotoUrl={profile?.photoUrl}
      />
    </div>
  );
}
