"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  ChevronLeft,
  Flag,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import {
  CommunityAnswer,
  CommunityPost,
  CommunityVoteResult,
} from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { toast } from "@/lib/toast";

const toRelativeTime = (value: string): string => {
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return "";
  const diffMin = Math.max(1, Math.floor((Date.now() - at) / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
};

export default function QnAPostDetailClient({ postId }: { postId: string }) {
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMoreAnswers, setIsLoadingMoreAnswers] = useState(false);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [answers, setAnswers] = useState<CommunityAnswer[]>([]);
  const [answerPage, setAnswerPage] = useState(1);
  const [hasMoreAnswers, setHasMoreAnswers] = useState(false);
  const [answerDraft, setAnswerDraft] = useState("");
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postTitleDraft, setPostTitleDraft] = useState("");
  const [postBodyDraft, setPostBodyDraft] = useState("");
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editingAnswerDraft, setEditingAnswerDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVotingKey, setIsVotingKey] = useState<string | null>(null);
  const [isMutatingPost, setIsMutatingPost] = useState(false);
  const [isMutatingAnswerId, setIsMutatingAnswerId] = useState<string | null>(
    null,
  );

  const sortedAnswers = useMemo(() => {
    return [...answers].sort((a, b) => {
      if (b.voteScore !== a.voteScore) {
        return b.voteScore - a.voteScore;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [answers]);

  const loadDetails = useCallback(
    async (targetPage = 1, append = false) => {
      try {
        if (append) {
          setIsLoadingMoreAnswers(true);
        } else {
          setIsLoading(true);
        }

        const session = await communityService.ensureSession();
        if (!isCommunityEligibleRole(session.role)) {
          redirectToMainLogin();
          return;
        }
        setCurrentUserId(session.id);

        const data = await communityService.getPostDetails(
          postId,
          targetPage,
          20,
        );
        setPost(data.post);
        setPostTitleDraft(data.post.title);
        setPostBodyDraft(data.post.body);

        const incomingAnswers = data.answers || [];
        setAnswers((current) =>
          append ? [...current, ...incomingAnswers] : incomingAnswers,
        );
        setAnswerPage(targetPage);
        setHasMoreAnswers(targetPage < (data.pagination?.totalPages || 0));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load question",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMoreAnswers(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

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

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("community:qnaPostUpdated", handlePostEvent);
      socket.off("community:qnaPostDeleted", handlePostEvent);
      socket.off("community:qnaAnswerCreated", handleAnswerEvent);
      socket.off("community:qnaAnswerUpdated", handleAnswerEvent);
      socket.off("community:qnaAnswerDeleted", handleAnswerEvent);
      socket.off("community:qnaVoteUpdated", handleVoteEvent);
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
          : current,
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
          : answer,
      ),
    );
  };

  const vote = async (
    targetType: "POST" | "ANSWER",
    targetId: string,
    value: 1 | -1,
  ) => {
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
      );
      setAnswers((current) => [...current, created]);
      setAnswerDraft("");
      setPost((current) =>
        current
          ? {
              ...current,
              answerCount: current.answerCount + 1,
            }
          : current,
      );
      toast.success("Answer posted");
      await loadDetails(1, false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to post answer",
      );
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
          : current,
      );
      setIsEditingPost(false);
      toast.success("Question updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update question",
      );
    } finally {
      setIsMutatingPost(false);
    }
  };

  const removePost = async () => {
    if (!post) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this question and hide it from the community knowledge feed?",
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsMutatingPost(true);
      await communityService.deletePost(post.id);
      toast.success("Question deleted");
      window.location.assign("/q");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete question",
      );
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

      setPost((current) =>
        current ? { ...current, status: updated.status } : current,
      );
      toast.success(
        `Question ${nextStatus === "OPEN" ? "reopened" : "closed"}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update question",
      );
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
      const updated = await communityService.updateAnswer(
        answerId,
        editingAnswerDraft.trim(),
      );

      setAnswers((current) =>
        current.map((answer) =>
          answer.id === answerId
            ? {
                ...answer,
                content: updated.content,
                updatedAt: updated.updatedAt,
              }
            : answer,
        ),
      );
      setEditingAnswerId(null);
      setEditingAnswerDraft("");
      toast.success("Answer updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update answer",
      );
    } finally {
      setIsMutatingAnswerId(null);
    }
  };

  const removeAnswer = async (answer: CommunityAnswer) => {
    const confirmed = window.confirm(
      "Delete this answer? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

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
          : current,
      );
      toast.success("Answer deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete answer",
      );
    } finally {
      setIsMutatingAnswerId(null);
    }
  };

  const reportTarget = async (
    targetType: "POST" | "ANSWER",
    targetId: string,
  ) => {
    const reason = window.prompt(
      "Reason for reporting this content (3-120 chars)",
      "Spam or abuse",
    );
    if (!reason) return;

    try {
      await communityService.reportContent({ targetType, targetId, reason });
      toast.success("Report submitted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit report",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-slate-500 sm:py-10">
        Loading question...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:py-10">
        <p className="text-slate-700">Question not found.</p>
        <Link
          href="/q"
          className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Feed
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <Link
          href="/q"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ChevronLeft size={16} />
          Back to Q&A
        </Link>
        <button
          onClick={() => void reportTarget("POST", post.id)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          title="Report this question"
        >
          <Flag size={14} />
        </button>
      </div>

      {/* Post Card */}
      <article className="group relative flex gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Voting Sidebar */}
        <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 border-r border-slate-200 bg-slate-50 px-2.5 py-4 group-hover:bg-slate-100">
          <button
            onClick={() => void vote("POST", post.id, 1)}
            disabled={isVotingKey === `POST:${post.id}`}
            className={`rounded-md p-1.5 transition-colors ${
              post.myVote === 1
                ? "bg-orange-100 text-power-orange"
                : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            } disabled:opacity-50`}
            title="Upvote"
          >
            <ArrowBigUp size={16} />
          </button>
          <span className="text-xs font-bold text-slate-700">
            {post.voteScore}
          </span>
          <button
            onClick={() => void vote("POST", post.id, -1)}
            disabled={isVotingKey === `POST:${post.id}`}
            className={`rounded-md p-1.5 transition-colors ${
              post.myVote === -1
                ? "bg-red-100 text-red-600"
                : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            } disabled:opacity-50`}
            title="Downvote"
          >
            <ArrowBigDown size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 sm:p-6">
          {isEditingPost ? (
            <div className="space-y-3">
              <input
                value={postTitleDraft}
                onChange={(event) => setPostTitleDraft(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg font-bold text-slate-900 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange"
                placeholder="Question title..."
              />
              <textarea
                value={postBodyDraft}
                onChange={(event) => setPostBodyDraft(event.target.value)}
                rows={6}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange"
                placeholder="Question details..."
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void savePostEdits()}
                  disabled={isMutatingPost}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditingPost(false);
                    setPostTitleDraft(post.title);
                    setPostBodyDraft(post.body);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                {post.title}
              </h1>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
                {post.body}
              </p>
            </>
          )}

          {/* Tags */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {post.tags.map((tag) => (
              <span
                key={`${post.id}-tag-${tag}`}
                className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
            {post.sport ? (
              <span className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {post.sport}
              </span>
            ) : null}
            {post.city ? (
              <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {post.city}
              </span>
            ) : null}
          </div>

          {/* Metadata */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                {post.author.displayName}
              </span>
              <span className="text-slate-500">
                {toRelativeTime(post.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                <MessageCircle size={13} /> {post.answerCount}
              </span>
              {post.status === "CLOSED" ? (
                <span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Closed
                </span>
              ) : null}
            </div>
          </div>

          {/* Owner Actions */}
          {post.author.id === currentUserId ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {!isEditingPost ? (
                <button
                  onClick={() => setIsEditingPost(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Pencil size={13} /> Edit
                </button>
              ) : null}
              <button
                onClick={() => void removePost()}
                disabled={isMutatingPost}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 size={13} /> Delete
              </button>
              <button
                onClick={() => void togglePostStatus()}
                disabled={isMutatingPost}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {post.status === "OPEN" ? "Close Question" : "Reopen Question"}
              </button>
            </div>
          ) : null}
        </div>
      </article>

      {/* Answer Form */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Share Your Answer</h2>
        <p className="mt-1 text-sm text-slate-600">
          Be specific and actionable. Share what worked, include context, and explain your reasoning.
        </p>
        {post.status === "CLOSED" ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            ⓘ This question is closed. You can still vote and read existing answers.
          </div>
        ) : null}
        <textarea
          value={answerDraft}
          onChange={(event) => setAnswerDraft(event.target.value)}
          rows={6}
          placeholder={
            post.status === "CLOSED"
              ? "Question is closed for answers"
              : "Write your answer here... Include specific steps, tips, or experiences that helped solve the problem."
          }
          disabled={post.status === "CLOSED"}
          className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-500 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange disabled:bg-slate-50"
        />
        <div className="mt-4 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => void submitAnswer()}
            disabled={isSubmitting || post.status === "CLOSED"}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {post.status === "CLOSED"
              ? "Question Closed"
              : isSubmitting
                ? "Posting..."
                : "Post Answer"}
          </button>
          <span className="text-xs text-slate-500">
            {answerDraft.length} characters
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Community Answers
          </h3>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Most helpful first
          </span>
        </div>

        {sortedAnswers.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <MessageCircle size={32} className="mx-auto text-slate-400 mb-3" />
            <p className="font-semibold text-slate-700">No answers yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Be the first to share knowledge and help others
            </p>
          </div>
        ) : (
          sortedAnswers.map((answer, index) => (
            <article
              key={answer.id}
              className="group relative flex gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
            >
              {/* Voting Sidebar */}
              <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 border-r border-slate-200 bg-slate-50 px-2.5 py-3 group-hover:bg-slate-100">
                <button
                  onClick={() => void vote("ANSWER", answer.id, 1)}
                  disabled={isVotingKey === `ANSWER:${answer.id}`}
                  title="Upvote"
                  className={`rounded-md p-1.5 transition-colors ${
                    answer.myVote === 1
                      ? "bg-orange-100 text-power-orange"
                      : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  } disabled:opacity-50`}
                >
                  <ArrowBigUp size={16} />
                </button>
                <span className="text-xs font-bold text-slate-700">
                  {answer.voteScore}
                </span>
                <button
                  onClick={() => void vote("ANSWER", answer.id, -1)}
                  disabled={isVotingKey === `ANSWER:${answer.id}`}
                  title="Downvote"
                  className={`rounded-md p-1.5 transition-colors ${
                    answer.myVote === -1
                      ? "bg-red-100 text-red-600"
                      : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  } disabled:opacity-50`}
                >
                  <ArrowBigDown size={16} />
                </button>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-4 sm:p-5">
                {/* Header - Author & Time */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {answer.author.displayName}
                      </span>
                      {index === 0 && answer.voteScore > 0 ? (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                          Top Answer
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {toRelativeTime(answer.createdAt)} ago
                    </p>
                  </div>
                  <button
                    onClick={() => void reportTarget("ANSWER", answer.id)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    title="Report answer"
                  >
                    <Flag size={14} />
                  </button>
                </div>

                {/* Content */}
                {editingAnswerId === answer.id ? (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={editingAnswerDraft}
                      onChange={(event) =>
                        setEditingAnswerDraft(event.target.value)
                      }
                      rows={5}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange"
                      placeholder="Share your answer..."
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void saveAnswerEdits(answer.id)}
                        disabled={isMutatingAnswerId === answer.id}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditingAnswerId(null);
                          setEditingAnswerDraft("");
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {answer.content}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {answer.author.id === currentUserId &&
                  editingAnswerId !== answer.id ? (
                    <>
                      <button
                        onClick={() => startEditingAnswer(answer)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => void removeAnswer(answer)}
                        disabled={isMutatingAnswerId === answer.id}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}

        {hasMoreAnswers ? (
          <div className="pt-2 text-center">
            <button
              onClick={() => void loadMoreAnswers()}
              disabled={isLoadingMoreAnswers}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {isLoadingMoreAnswers ? (
                <>
                  <LoaderCircle size={15} className="animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more answers"
              )}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
