"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Eye } from "lucide-react";
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
import { useConfirm } from "@/modules/community/hooks/useConfirm";
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
  const [confirm, confirmDialog] = useConfirm();

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

  const handleBackClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) return;
    // The dialog is asynchronous, so the link's own navigation has to be stopped
    // now and redone by hand if the writer chooses to leave.
    event.preventDefault();
    const proceed = await confirm({
      title: "Leave without saving?",
      description: "You have unsaved changes that will be lost.",
      confirmLabel: "Leave",
      variant: "danger",
    });
    if (proceed) router.push("/experiences");
  };

  const saveIndicator = useMemo(() => {
    if (autosaveState === "saving") return "Saving";
    if (autosaveState === "saved" && !isDirty) return "Saved";
    if (autosaveState === "error") return "Could not save, retrying";
    return null;
  }, [autosaveState, isDirty]);

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12 sm:px-6"
      >
        <div className="bg-ink/10 h-10 w-3/4 animate-pulse rounded-sm" />
        <div className="bg-ink/10 h-48 animate-pulse rounded-2xl" />
      </div>
    );
  }

  // Create mode, nothing picked or saved yet: ask what this is about before
  // showing anything that looks like a form.
  if (mode === "create" && !hasCategory && !activeBlogId) {
    return <CategoryPicker onSelect={setCategory} />;
  }

  const categoryMeta = getExperienceCategory(category);
  const label = "text-ink mb-2 block text-base font-semibold";
  const fieldCls =
    "text-ink placeholder:text-ink-muted w-full rounded-md border border-[#d9d3c8] bg-white px-4 text-base transition-colors duration-200 hover:border-ink/45 focus:border-ink focus:outline-none";

  return (
    <div className="bg-paper relative min-h-[calc(100vh-5.5rem)]">
      {confirmDialog}
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/experiences"
            onClick={handleBackClick}
            className="text-ink-body hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors duration-200"
          >
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
            All experiences
          </Link>
          <p className="text-ink-muted text-sm" aria-live="polite">
            {saveIndicator ? (
              <span className={autosaveState === "error" ? "font-medium text-red-700" : ""}>
                {saveIndicator} ·{" "}
              </span>
            ) : null}
            {postStatus === "PUBLISHED"
              ? "Editing a published experience"
              : postStatus === "DRAFT"
                ? "Draft"
                : "New experience"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCategory("")}
          className="text-ink-body hover:text-ink mt-4 inline-flex min-h-11 items-center gap-2 text-base transition-colors duration-200"
        >
          <categoryMeta.Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="font-semibold">{categoryMeta.label}</span>
          <span className="decoration-ink/30 underline underline-offset-4">Change</span>
        </button>

        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          aria-label="Title"
          onChange={(event) => {
            setTitle(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${event.target.scrollHeight}px`;
          }}
          placeholder="Give it a title"
          className="font-editorial text-ink placeholder:text-ink-ash mt-2 w-full resize-none bg-transparent text-4xl font-light leading-[1.1] outline-none sm:text-5xl"
        />

        <div className="mt-6">
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

        <div className="mt-8">
          <label htmlFor="write-excerpt" className={label}>
            Short summary
          </label>
          <textarea
            id="write-excerpt"
            value={excerpt}
            rows={2}
            maxLength={EXCERPT_MAX_LENGTH}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="One or two lines shown on cards and previews. Left blank, we use the start of your text."
            className={`${fieldCls} resize-none py-3 leading-relaxed`}
          />
          <p className="text-ink-muted mt-2 text-sm tabular-nums">
            {excerpt.length} of {EXCERPT_MAX_LENGTH} characters
          </p>
        </div>

        <div className="mt-8">
          <SubjectPicker value={subject} onChange={handleSubjectChange} />
        </div>

        {subject && (
          <div className="mt-4">
            <SignalQuestions
              subjectKind={subject.kind}
              values={signals}
              onChange={(key, value) => setSignals((prev) => ({ ...prev, [key]: value }))}
              attendedAt={attendedAt}
              onAttendedAtChange={setAttendedAt}
            />
          </div>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="write-sport" className={label}>
              Sport
            </label>
            <select
              id="write-sport"
              value={sport}
              onChange={(event) => setSport(event.target.value)}
              className={`${fieldCls} h-12`}
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
            <label htmlFor="write-tags" className={label}>
              Tags
            </label>
            <input
              id="write-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="Separate with commas"
              className={`${fieldCls} h-12`}
            />
          </div>
        </div>

        <div className="border-hairline my-8 border-t" />

        <h2 className="font-editorial text-ink mb-4 text-2xl font-normal">Your story</h2>
        <RichTextCanvas
          initialContent={content}
          onChange={setContent}
          placeholder={categoryMeta.prompt}
        />
      </div>

      <div className="border-hairline bg-paper/95 sticky bottom-0 z-20 border-t backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-end gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="text-ink decoration-ink/30 hover:decoration-ink inline-flex min-h-11 items-center gap-2 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
          >
            <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
            Preview
          </button>
          {postStatus !== "PUBLISHED" && (
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={isSavingDraft || isPublishing}
              className="btn-motion border-ink text-ink hover:bg-ink inline-flex min-h-11 items-center rounded-md border px-5 text-base font-semibold hover:text-white disabled:opacity-60"
            >
              {isSavingDraft ? "Saving" : "Save draft"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={isPublishing || isSavingDraft}
            className="btn-motion bg-power-orange-solid inline-flex min-h-11 items-center gap-2 rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPublishing ? "Publishing" : postStatus === "PUBLISHED" ? "Update" : "Publish"}
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
