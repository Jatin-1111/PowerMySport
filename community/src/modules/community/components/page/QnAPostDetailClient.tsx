"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  CheckCircle2,
  ChevronLeft,
  Flag,
  MessageCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import {
  CommunityAnswer,
  CommunityAnswerComment,
  CommunityPost,
  CommunityPostDetailResponse,
  CommunityVoteResult,
} from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { hasAuthToken } from "@/lib/auth/token";
import { getCommunitySocket, qnaPostRoom, subscribeToCommunityRoom } from "@/lib/realtime/socket";
import { toast } from "@/lib/toast";
import AuthorAvatar from "@/modules/community/components/page/AuthorAvatar";

/** Kept small on purpose — most threads never need a second page, and a long
 *  one shouldn't ship every answer up front just to answer the question. */
const ANSWERS_PER_PAGE = 5;

const formatPostedDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function QnAPostDetailClient({
  postId,
  initialData = null,
}: {
  postId: string;
  /**
   * The server already fetched this to build the page's JSON-LD, so passing it
   * down costs nothing and puts the question and its answers in the SSR HTML.
   * Without it the server shipped rich QAPage structured data describing
   * answers, while the body said "Loading question..." — structured data that
   * does not match visible content.
   */
  initialData?: CommunityPostDetailResponse | null;
}) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isLoadingMoreAnswers, setIsLoadingMoreAnswers] = useState(false);
  const [post, setPost] = useState<CommunityPost | null>(initialData?.post ?? null);
  const [answers, setAnswers] = useState<CommunityAnswer[]>(initialData?.answers ?? []);
  const [answerPage, setAnswerPage] = useState(1);
  const [hasMoreAnswers, setHasMoreAnswers] = useState(
    (initialData?.pagination?.totalPages || 0) > 1
  );
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerIsAnonymous, setAnswerIsAnonymous] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postTitleDraft, setPostTitleDraft] = useState(initialData?.post?.title ?? "");
  const [postBodyDraft, setPostBodyDraft] = useState(initialData?.post?.body ?? "");
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editingAnswerDraft, setEditingAnswerDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVotingKey, setIsVotingKey] = useState<string | null>(null);
  const [isMutatingPost, setIsMutatingPost] = useState(false);
  const [isMutatingAnswerId, setIsMutatingAnswerId] = useState<string | null>(null);

  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

  const submitComment = async (answer: CommunityAnswer) => {
    const trimmed = commentDraft.trim();
    if (!trimmed) {
      return;
    }

    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }

    try {
      setIsCommenting(true);
      const created = await communityService.createAnswerComment(answer.id, trimmed);

      // Appended locally rather than refetching, so a long thread does not
      // scroll away from the answer being discussed.
      setAnswers((current) =>
        current.map((item) =>
          item.id === answer.id
            ? {
                ...item,
                comments: [
                  ...(item.comments || []),
                  {
                    ...created,
                    canDelete: true,
                    author: {
                      id: currentUserId,
                      displayName: "Me",
                      isIdentityPublic: true,
                    },
                  },
                ],
              }
            : item
        )
      );
      setCommentDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post comment");
    } finally {
      setIsCommenting(false);
    }
  };

  const removeComment = async (answerId: string, comment: CommunityAnswerComment) => {
    try {
      await communityService.deleteAnswerComment(comment.id);
      setAnswers((current) =>
        current.map((item) =>
          item.id === answerId
            ? {
                ...item,
                comments: (item.comments || []).filter((existing) => existing.id !== comment.id),
              }
            : item
        )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete comment");
    }
  };

  const [isAcceptingId, setIsAcceptingId] = useState<string | null>(null);

  const toggleAccepted = async (answer: CommunityAnswer) => {
    if (!post) {
      return;
    }

    try {
      setIsAcceptingId(answer.id);
      const result = await communityService.acceptAnswer(post.id, answer.id);

      // Patch locally rather than refetching: the thread can be long and a
      // full reload would scroll the reader away from the answer they just
      // marked. The realtime event reconciles everyone else.
      setPost((current) =>
        current ? { ...current, acceptedAnswerId: result.acceptedAnswerId } : current
      );
      setAnswers((current) =>
        current.map((item) => ({
          ...item,
          isAccepted: item.id === result.acceptedAnswerId,
        }))
      );

      toast.success(result.accepted ? "Marked as the answer" : "Removed the accepted mark");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept answer");
    } finally {
      setIsAcceptingId(null);
    }
  };

  const sortedAnswers = useMemo(() => {
    return [...answers].sort((a, b) => {
      // Mirrors the server's ordering so the accepted answer does not jump
      // position between the server render and the first client refresh.
      if (Boolean(a.isAccepted) !== Boolean(b.isAccepted)) {
        return a.isAccepted ? -1 : 1;
      }

      if (b.voteScore !== a.voteScore) {
        return b.voteScore - a.voteScore;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [answers]);

  // Whether anything is on screen yet. Once it is — from the server render or
  // a previous fetch — a refresh must never swap the page back to a loading
  // message: that would undo the SSR content on hydrate, and it also made every
  // realtime event (a vote, a new answer) blank the whole thread for a moment.
  const hasContentRef = useRef(Boolean(initialData?.post));

  const loadDetails = useCallback(
    async (targetPage = 1, append = false) => {
      try {
        if (append) {
          setIsLoadingMoreAnswers(true);
        } else if (!hasContentRef.current) {
          setIsLoading(true);
        }

        const data = await communityService.getPostDetails(postId, targetPage, ANSWERS_PER_PAGE);
        setPost(data.post);
        hasContentRef.current = true;
        setPostTitleDraft(data.post.title);
        setPostBodyDraft(data.post.body);

        const incomingAnswers = data.answers || [];
        setAnswers((current) => (append ? [...current, ...incomingAnswers] : incomingAnswers));
        setAnswerPage(targetPage);
        setHasMoreAnswers(targetPage < (data.pagination?.totalPages || 0));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load question");
      } finally {
        setIsLoading(false);
        setIsLoadingMoreAnswers(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  // This page is a shareable public link — resolve who's viewing it (if
  // anyone) without gating render on it, so owner actions (edit/delete) still
  // show up for a logged-in author without blocking guests.
  useEffect(() => {
    if (!hasAuthToken()) return;
    communityService
      .ensureSession()
      .then((session) => setCurrentUserId(session.id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getCommunitySocket();

    const handlePostEvent = (payload?: { postId?: string }) => {
      if (!payload?.postId || payload.postId === postId) {
        void loadDetails(1, false);
      }
    };

    const handleAnswerEvent = (payload?: { postId?: string }) => {
      if (payload?.postId === postId) {
        void loadDetails(1, false);
      }
    };

    const handleVoteEvent = (payload?: {
      targetType?: "POST" | "ANSWER";
      targetId?: string;
      postId?: string;
    }) => {
      if (!payload) {
        return;
      }

      if (payload.targetType === "POST" && payload.targetId === postId) {
        void loadDetails(1, false);
        return;
      }

      if (payload.targetType === "ANSWER" && payload.postId === postId) {
        void loadDetails(1, false);
      }
    };

    socket.on("community:qnaPostUpdated", handlePostEvent);
    socket.on("community:qnaPostDeleted", handlePostEvent);
    socket.on("community:qnaAnswerCreated", handleAnswerEvent);
    socket.on("community:qnaAnswerUpdated", handleAnswerEvent);
    socket.on("community:qnaAnswerDeleted", handleAnswerEvent);
    socket.on("community:qnaVoteUpdated", handleVoteEvent);
    socket.on("community:qnaAnswerAccepted", handleAnswerEvent);
    socket.on("community:qnaCommentCreated", handleAnswerEvent);
    socket.on("community:qnaCommentDeleted", handleAnswerEvent);

    const unsubscribe = subscribeToCommunityRoom(qnaPostRoom(postId));

    return () => {
      unsubscribe();
      socket.off("community:qnaPostUpdated", handlePostEvent);
      socket.off("community:qnaPostDeleted", handlePostEvent);
      socket.off("community:qnaAnswerCreated", handleAnswerEvent);
      socket.off("community:qnaAnswerUpdated", handleAnswerEvent);
      socket.off("community:qnaAnswerDeleted", handleAnswerEvent);
      socket.off("community:qnaVoteUpdated", handleVoteEvent);
      socket.off("community:qnaAnswerAccepted", handleAnswerEvent);
      socket.off("community:qnaCommentCreated", handleAnswerEvent);
      socket.off("community:qnaCommentDeleted", handleAnswerEvent);
    };
  }, [loadDetails, postId]);

  const loadMoreAnswers = async () => {
    if (!hasMoreAnswers || isLoadingMoreAnswers) {
      return;
    }

    await loadDetails(answerPage + 1, true);
  };

  const patchVote = (result: CommunityVoteResult) => {
    if (result.targetType === "POST") {
      setPost((current) =>
        current
          ? {
              ...current,
              myVote: result.myVote,
              voteScore: result.voteScore,
              upvoteCount: result.upvoteCount,
              downvoteCount: result.downvoteCount,
            }
          : current
      );
      return;
    }

    setAnswers((current) =>
      current.map((answer) =>
        answer.id === result.targetId
          ? {
              ...answer,
              myVote: result.myVote,
              voteScore: result.voteScore,
              upvoteCount: result.upvoteCount,
              downvoteCount: result.downvoteCount,
            }
          : answer
      )
    );
  };

  const vote = async (targetType: "POST" | "ANSWER", targetId: string, value: 1 | -1) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    const key = `${targetType}:${targetId}`;
    try {
      setIsVotingKey(key);
      const result = await communityService.vote({
        targetType,
        targetId,
        value,
      });
      patchVote(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to vote");
    } finally {
      setIsVotingKey(null);
    }
  };

  const submitAnswer = async () => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    if (post?.status === "CLOSED") {
      toast.error("This question is closed for new answers");
      return;
    }

    if (answerDraft.trim().length < 10) {
      toast.error("Answer should be at least 10 characters");
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await communityService.createAnswer(
        postId,
        answerDraft.trim(),
        answerIsAnonymous
      );
      const createdWithAuthor = {
        ...created,
        author: {
          id: answerIsAnonymous ? "anon" : currentUserId,
          displayName: answerIsAnonymous ? "Anonymous" : "Me",
          isIdentityPublic: !answerIsAnonymous,
          photoUrl: null,
          isVerifiedExpert: false,
        },
      };
      setAnswers((current) => [...current, createdWithAuthor]);
      setAnswerDraft("");
      setAnswerIsAnonymous(false);
      setPost((current) =>
        current
          ? {
              ...current,
              answerCount: current.answerCount + 1,
            }
          : current
      );
      toast.success("Answer posted");
      await loadDetails(1, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const savePostEdits = async () => {
    if (!post) {
      return;
    }

    if (postTitleDraft.trim().length < 10 || postBodyDraft.trim().length < 20) {
      toast.error("Question title/body are too short");
      return;
    }

    try {
      setIsMutatingPost(true);
      const updated = await communityService.updatePost(post.id, {
        title: postTitleDraft.trim(),
        body: postBodyDraft.trim(),
      });

      setPost((current) =>
        current
          ? {
              ...current,
              title: updated.title,
              body: updated.body,
              updatedAt: updated.updatedAt,
            }
          : current
      );
      setIsEditingPost(false);
      toast.success("Question updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update question");
    } finally {
      setIsMutatingPost(false);
    }
  };

  const removePost = async () => {
    if (!post) {
      return;
    }

    try {
      setIsMutatingPost(true);
      await communityService.deletePost(post.id);
      toast.success("Question deleted");
      router.push("/questions");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete question");
      setIsMutatingPost(false);
    }
  };

  const togglePostStatus = async () => {
    if (!post) {
      return;
    }

    const nextStatus = post.status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      setIsMutatingPost(true);
      const updated = await communityService.updatePost(post.id, {
        status: nextStatus,
      });

      setPost((current) => (current ? { ...current, status: updated.status } : current));
      toast.success(`Question ${nextStatus === "OPEN" ? "reopened" : "closed"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update question");
    } finally {
      setIsMutatingPost(false);
    }
  };

  const startEditingAnswer = (answer: CommunityAnswer) => {
    setEditingAnswerId(answer.id);
    setEditingAnswerDraft(answer.content);
  };

  const saveAnswerEdits = async (answerId: string) => {
    if (editingAnswerDraft.trim().length < 10) {
      toast.error("Answer should be at least 10 characters");
      return;
    }

    try {
      setIsMutatingAnswerId(answerId);
      const updated = await communityService.updateAnswer(answerId, editingAnswerDraft.trim());

      setAnswers((current) =>
        current.map((answer) =>
          answer.id === answerId
            ? {
                ...answer,
                content: updated.content,
                updatedAt: updated.updatedAt,
              }
            : answer
        )
      );
      setEditingAnswerId(null);
      setEditingAnswerDraft("");
      toast.success("Answer updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update answer");
    } finally {
      setIsMutatingAnswerId(null);
    }
  };

  const removeAnswer = async (answer: CommunityAnswer) => {
    try {
      setIsMutatingAnswerId(answer.id);
      await communityService.deleteAnswer(answer.id);
      setAnswers((current) => current.filter((item) => item.id !== answer.id));
      setPost((current) =>
        current
          ? {
              ...current,
              answerCount: Math.max(0, current.answerCount - 1),
            }
          : current
      );
      toast.success("Answer deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete answer");
    } finally {
      setIsMutatingAnswerId(null);
    }
  };

  const reportTarget = async (targetType: "POST" | "ANSWER", targetId: string) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    toast("Report this content?", {
      action: {
        label: "Report",
        onClick: () => {
          const proceed = async () => {
            try {
              await communityService.reportContent({
                targetType,
                targetId,
                reason: "Spam or abuse",
              });
              toast.success("Report submitted");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to submit report");
            }
          };
          void proceed();
        },
      },
    });
  };

  const voteBtn =
    "text-ink-muted hover:text-ink flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-200 hover:bg-paper-deep disabled:opacity-50";
  const textLink =
    "text-ink decoration-ink/30 hover:decoration-ink inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 transition-colors duration-200 disabled:opacity-60";
  const fieldCls =
    "text-ink placeholder:text-ink-muted w-full rounded-md border border-[#d9d3c8] bg-white px-4 py-3 text-base leading-relaxed transition-colors duration-200 hover:border-ink/45 focus:border-ink focus:outline-none disabled:bg-paper-deep disabled:text-ink-muted";
  const primaryBtn =
    "btn-motion bg-power-orange-solid inline-flex min-h-11 items-center justify-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading question"
        className="mx-auto w-full max-w-4xl space-y-4 px-4 py-12 sm:px-6"
      >
        <div className="bg-ink/10 h-3 w-32 animate-pulse rounded-sm" />
        <div className="bg-ink/10 h-10 w-3/4 animate-pulse rounded-sm" />
        <div className="bg-ink/10 h-4 w-full animate-pulse rounded-sm" />
        <div className="bg-ink/10 h-4 w-5/6 animate-pulse rounded-sm" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <div className="bg-paper-deep rounded-3xl px-6 py-16 text-center">
          <p className="font-editorial text-ink text-4xl font-light">Question not found.</p>
          <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
            It may have been deleted, or the link may be wrong.
          </p>
          <Link href="/questions" className={`${primaryBtn} mt-7`}>
            Back to questions
          </Link>
        </div>
      </div>
    );
  }

  const postAuthorName = post.isAnonymous ? "Anonymous" : post.author.displayName;
  const postMeta = [post.sport, post.city, post.category !== "General" ? post.category : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/questions"
          className="text-ink-body hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors duration-200"
        >
          <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          All questions
        </Link>
        <button
          type="button"
          onClick={() => void reportTarget("POST", post.id)}
          className="text-ink-muted hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-sm font-medium transition-colors duration-200"
        >
          <Flag size={14} strokeWidth={1.5} aria-hidden="true" />
          Report
        </button>
      </div>

      <article className="mt-6 flex gap-4 sm:gap-8">
        <div className="flex w-10 shrink-0 flex-col items-center pt-1">
          <button
            type="button"
            onClick={() => void vote("POST", post.id, 1)}
            disabled={isVotingKey === `POST:${post.id}`}
            aria-label="Upvote question"
            aria-pressed={post.myVote === 1}
            className={`${voteBtn} ${post.myVote === 1 ? "text-power-orange-solid" : ""}`}
          >
            <ArrowBigUp
              size={22}
              strokeWidth={1.5}
              className={post.myVote === 1 ? "fill-power-orange" : ""}
            />
          </button>
          <span className="text-ink text-base font-semibold tabular-nums">{post.voteScore}</span>
          <button
            type="button"
            onClick={() => void vote("POST", post.id, -1)}
            disabled={isVotingKey === `POST:${post.id}`}
            aria-label="Downvote question"
            aria-pressed={post.myVote === -1}
            className={`${voteBtn} ${post.myVote === -1 ? "text-ink" : ""}`}
          >
            <ArrowBigDown
              size={22}
              strokeWidth={1.5}
              className={post.myVote === -1 ? "fill-ink" : ""}
            />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          {isEditingPost ? (
            <div className="space-y-4">
              <input
                value={postTitleDraft}
                onChange={(event) => setPostTitleDraft(event.target.value)}
                aria-label="Question title"
                className={`${fieldCls} font-editorial text-2xl`}
                placeholder="Question title"
              />
              <textarea
                value={postBodyDraft}
                onChange={(event) => setPostBodyDraft(event.target.value)}
                aria-label="Question details"
                rows={6}
                className={fieldCls}
                placeholder="Question details"
              />
              <div className="flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => void savePostEdits()}
                  disabled={isMutatingPost}
                  className={primaryBtn}
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPost(false);
                    setPostTitleDraft(post.title);
                    setPostBodyDraft(post.body);
                  }}
                  className={textLink}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {postMeta || post.status === "CLOSED" ? (
                <p className="text-ink-muted text-sm">
                  {postMeta}
                  {post.status === "CLOSED" ? (
                    <span className="text-ink font-semibold">{postMeta ? " · " : ""}Closed</span>
                  ) : null}
                </p>
              ) : null}
              <h1 className="font-editorial text-ink mt-2 text-balance text-4xl font-light leading-[1.1] sm:text-5xl">
                {post.title}
              </h1>
              <p className="text-ink-body mt-6 max-w-[65ch] whitespace-pre-wrap break-words text-lg leading-relaxed">
                {post.body}
              </p>
            </>
          )}

          {post.tags.length > 0 ? (
            <p className="text-ink-muted mt-5 text-sm">
              {post.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join("  ")}
            </p>
          ) : null}

          <div className="border-hairline mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t pt-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <AuthorAvatar
                author={
                  post.isAnonymous ? { displayName: "Anonymous", photoUrl: null } : post.author
                }
                size={36}
              />
              <span className="text-ink text-base font-semibold">{postAuthorName}</span>
              {post.author.isVerifiedExpert ? (
                <span className="text-ink-body">{post.author.expertTitle} (verified)</span>
              ) : null}
              <span className="text-ink-muted">Asked {formatPostedDate(post.createdAt)}</span>
            </div>

            {post.author.id === currentUserId ? (
              <div className="flex flex-wrap items-center gap-5">
                {!isEditingPost ? (
                  <button type="button" onClick={() => setIsEditingPost(true)} className={textLink}>
                    <Pencil size={14} strokeWidth={1.5} aria-hidden="true" /> Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void togglePostStatus()}
                  disabled={isMutatingPost}
                  className={textLink}
                >
                  {post.status === "OPEN" ? "Close question" : "Reopen question"}
                </button>
                <button
                  type="button"
                  onClick={() => void removePost()}
                  disabled={isMutatingPost}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 underline decoration-red-700/30 underline-offset-4 transition-colors duration-200 hover:decoration-red-700 disabled:opacity-60"
                >
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" /> Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </article>

      <section aria-labelledby="qna-answers" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="qna-answers" className="font-editorial text-ink text-3xl font-light sm:text-4xl">
            {sortedAnswers.length === 0
              ? "No answers yet"
              : `${post.answerCount} ${post.answerCount === 1 ? "answer" : "answers"}`}
          </h2>
          {sortedAnswers.length > 1 ? (
            <p className="text-ink-muted text-sm">Most helpful first</p>
          ) : null}
        </div>

        {sortedAnswers.length === 0 ? (
          <div className="bg-paper-deep mt-6 rounded-2xl px-6 py-12 text-center">
            <p className="font-editorial text-ink text-2xl font-normal">Be the first to answer.</p>
            <p className="text-ink-body mx-auto mt-2 max-w-[44ch] text-base leading-relaxed">
              If you have been through this, what you did could save another parent weeks.
            </p>
          </div>
        ) : (
          <ul className="border-hairline mt-6 border-t">
            {sortedAnswers.map((answer, index) => {
              const answerAuthorName = answer.isAnonymous ? "Anonymous" : answer.author.displayName;
              return (
                <li key={answer.id}>
                  <article
                    className={`flex gap-4 sm:gap-8 ${
                      answer.isAccepted
                        ? "bg-wash my-4 rounded-3xl p-5 sm:p-8"
                        : "border-hairline border-b py-8"
                    }`}
                  >
                    <div className="flex w-10 shrink-0 flex-col items-center">
                      <button
                        type="button"
                        onClick={() => void vote("ANSWER", answer.id, 1)}
                        disabled={isVotingKey === `ANSWER:${answer.id}`}
                        aria-label="Upvote answer"
                        aria-pressed={answer.myVote === 1}
                        className={`${voteBtn} ${answer.myVote === 1 ? "text-power-orange-solid" : ""}`}
                      >
                        <ArrowBigUp
                          size={20}
                          strokeWidth={1.5}
                          className={answer.myVote === 1 ? "fill-power-orange" : ""}
                        />
                      </button>
                      <span className="text-ink text-sm font-semibold tabular-nums">
                        {answer.voteScore}
                      </span>
                      <button
                        type="button"
                        onClick={() => void vote("ANSWER", answer.id, -1)}
                        disabled={isVotingKey === `ANSWER:${answer.id}`}
                        aria-label="Downvote answer"
                        aria-pressed={answer.myVote === -1}
                        className={`${voteBtn} ${answer.myVote === -1 ? "text-ink" : ""}`}
                      >
                        <ArrowBigDown
                          size={20}
                          strokeWidth={1.5}
                          className={answer.myVote === -1 ? "fill-ink" : ""}
                        />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      {answer.isAccepted ? (
                        <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-green-800">
                          <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />
                          Accepted answer
                        </p>
                      ) : index === 0 && answer.voteScore > 0 ? (
                        <p className="text-ink mb-3 text-sm font-semibold">Top answer</p>
                      ) : null}

                      <div className="flex items-center gap-3">
                        <AuthorAvatar
                          author={
                            answer.isAnonymous
                              ? { displayName: "Anonymous", photoUrl: null }
                              : answer.author
                          }
                          size={36}
                        />
                        <div className="min-w-0 text-sm">
                          <p className="text-ink text-base font-semibold">
                            {answerAuthorName}
                            {answer.author.isVerifiedExpert ? (
                              <span className="text-ink-body ml-2 text-sm font-normal">
                                {answer.author.expertTitle} (verified)
                              </span>
                            ) : null}
                          </p>
                          <p className="text-ink-muted">{formatPostedDate(answer.createdAt)}</p>
                        </div>
                      </div>

                      {editingAnswerId === answer.id ? (
                        <div className="mt-4 space-y-4">
                          <textarea
                            value={editingAnswerDraft}
                            onChange={(event) => setEditingAnswerDraft(event.target.value)}
                            aria-label="Edit your answer"
                            rows={5}
                            className={fieldCls}
                            placeholder="Share your answer"
                          />
                          <div className="flex flex-wrap items-center gap-5">
                            <button
                              type="button"
                              onClick={() => void saveAnswerEdits(answer.id)}
                              disabled={isMutatingAnswerId === answer.id}
                              className={primaryBtn}
                            >
                              Save changes
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAnswerId(null);
                                setEditingAnswerDraft("");
                              }}
                              className={textLink}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-ink-body mt-4 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-relaxed">
                          {answer.content}
                        </p>
                      )}

                      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                        {post.canAccept && editingAnswerId !== answer.id ? (
                          <button
                            type="button"
                            onClick={() => void toggleAccepted(answer)}
                            disabled={isAcceptingId === answer.id}
                            className={textLink}
                          >
                            <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden="true" />
                            {answer.isAccepted ? "Unaccept" : "Accept answer"}
                          </button>
                        ) : null}

                        {answer.author.id === currentUserId && editingAnswerId !== answer.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingAnswer(answer)}
                              className={textLink}
                            >
                              <Pencil size={14} strokeWidth={1.5} aria-hidden="true" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeAnswer(answer)}
                              disabled={isMutatingAnswerId === answer.id}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 underline decoration-red-700/30 underline-offset-4 transition-colors duration-200 hover:decoration-red-700 disabled:opacity-60"
                            >
                              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" /> Delete
                            </button>
                          </>
                        ) : null}

                        <button
                          type="button"
                          aria-expanded={openCommentsFor === answer.id}
                          onClick={() =>
                            setOpenCommentsFor((current) => {
                              setCommentDraft("");
                              return current === answer.id ? null : answer.id;
                            })
                          }
                          className={textLink}
                        >
                          <MessageCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                          {answer.comments?.length
                            ? `${answer.comments.length} comment${
                                answer.comments.length === 1 ? "" : "s"
                              }`
                            : "Comment"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void reportTarget("ANSWER", answer.id)}
                          className="text-ink-muted hover:text-ink ml-auto inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200"
                        >
                          <Flag size={13} strokeWidth={1.5} aria-hidden="true" />
                          Report
                        </button>
                      </div>

                      {openCommentsFor === answer.id ? (
                        <div className="border-ink/20 mt-5 space-y-4 border-l-2 pl-5">
                          {(answer.comments || []).map((comment) => (
                            <div
                              key={comment.id}
                              className="flex items-start justify-between gap-3"
                            >
                              <p className="text-ink-body min-w-0 break-words text-base leading-relaxed">
                                <span className="text-ink font-semibold">
                                  {comment.author.displayName}
                                </span>{" "}
                                {comment.content}
                              </p>
                              {comment.canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => void removeComment(answer.id, comment)}
                                  aria-label="Delete comment"
                                  className="text-ink-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          ))}

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                            <textarea
                              value={commentDraft}
                              onChange={(event) => setCommentDraft(event.target.value)}
                              aria-label="Add a comment"
                              rows={2}
                              maxLength={600}
                              placeholder="Add a short comment"
                              className={`${fieldCls} min-w-0 flex-1 resize-none py-2.5`}
                            />
                            <button
                              type="button"
                              onClick={() => void submitComment(answer)}
                              disabled={isCommenting || !commentDraft.trim()}
                              className="btn-motion bg-ink hover:bg-ink-hover inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-5 text-base font-semibold text-white disabled:opacity-50"
                            >
                              {isCommenting ? "Posting" : "Post"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {hasMoreAnswers ? (
          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => void loadMoreAnswers()}
              disabled={isLoadingMoreAnswers}
              className="btn-motion border-ink text-ink hover:bg-ink inline-flex min-h-12 items-center rounded-md border px-7 text-base font-semibold hover:text-white disabled:opacity-60"
            >
              {isLoadingMoreAnswers ? "Loading" : "Load more answers"}
            </button>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="qna-your-answer"
        className="bg-paper-deep mt-16 rounded-3xl p-6 sm:p-10"
      >
        <h2 id="qna-your-answer" className="font-editorial text-ink text-3xl font-light">
          Your answer
        </h2>
        <p className="text-ink-body mt-2 max-w-[56ch] text-base leading-relaxed">
          Be specific. Say what worked, give the context, and explain why.
        </p>
        {post.status === "CLOSED" ? (
          <p className="text-ink mt-5 rounded-md border border-[#d9d3c8] bg-white px-4 py-3 text-base">
            This question is closed. You can still vote and read the answers.
          </p>
        ) : null}
        <label htmlFor="qna-answer-draft" className="sr-only">
          Your answer
        </label>
        <textarea
          id="qna-answer-draft"
          value={answerDraft}
          onChange={(event) => setAnswerDraft(event.target.value)}
          rows={6}
          placeholder={
            post.status === "CLOSED"
              ? "This question is closed for answers"
              : "Include the steps, tips or experience that helped."
          }
          disabled={post.status === "CLOSED"}
          className={`${fieldCls} mt-5`}
        />
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button
            type="button"
            onClick={() => void submitAnswer()}
            disabled={isSubmitting || post.status === "CLOSED"}
            className={`${primaryBtn} min-h-12 px-7`}
          >
            {post.status === "CLOSED"
              ? "Question closed"
              : isSubmitting
                ? "Posting"
                : "Post answer"}
          </button>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              role="switch"
              checked={answerIsAnonymous}
              onChange={(e) => setAnswerIsAnonymous(e.target.checked)}
              disabled={post.status === "CLOSED"}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`peer-focus-visible:outline-ink relative h-6 w-11 shrink-0 rounded-md transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                answerIsAnonymous ? "bg-ink" : "bg-[#cfc8bc]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-[4px] bg-white transition-transform duration-200 ${
                  answerIsAnonymous ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </span>
            <span className="text-ink text-base font-medium">Post anonymously</span>
          </label>
          <span className="text-ink-muted text-sm tabular-nums">
            {answerDraft.length} characters
          </span>
        </div>
      </section>
    </div>
  );
}
