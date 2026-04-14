"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
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
      <div className="mx-auto max-w-5xl px-4 py-10 text-center text-slate-500">
        Loading question...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center">
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
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/q"
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to Feed
        </Link>
        <button
          onClick={() => void reportTarget("POST", post.id)}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          <Flag size={14} /> Report Question
        </button>
      </div>

      <article className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div className="flex gap-4">
          <div className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-2">
            <button
              onClick={() => void vote("POST", post.id, 1)}
              disabled={isVotingKey === `POST:${post.id}`}
              className={`rounded p-1 ${post.myVote === 1 ? "text-power-orange" : "text-slate-600"}`}
            >
              <ArrowBigUp size={18} />
            </button>
            <span className="text-sm font-bold text-slate-900">
              {post.voteScore}
            </span>
            <button
              onClick={() => void vote("POST", post.id, -1)}
              disabled={isVotingKey === `POST:${post.id}`}
              className={`rounded p-1 ${post.myVote === -1 ? "text-red-600" : "text-slate-600"}`}
            >
              <ArrowBigDown size={18} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            {isEditingPost ? (
              <div className="space-y-3">
                <input
                  value={postTitleDraft}
                  onChange={(event) => setPostTitleDraft(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-semibold focus:border-power-orange focus:outline-none"
                />
                <textarea
                  value={postBodyDraft}
                  onChange={(event) => setPostBodyDraft(event.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void savePostEdits()}
                    disabled={isMutatingPost}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingPost(false);
                      setPostTitleDraft(post.title);
                      setPostBodyDraft(post.body);
                    }}
                    className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {post.title}
                </h1>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {post.body}
                </p>
              </>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <span
                  key={`${post.id}-tag-${tag}`}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="font-medium">{post.author.displayName}</span>
              <span>{toRelativeTime(post.createdAt)} ago</span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={13} /> {post.answerCount} answers
              </span>
            </div>

            {post.author.id === currentUserId ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!isEditingPost ? (
                  <button
                    onClick={() => setIsEditingPost(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    <Pencil size={12} /> Edit Question
                  </button>
                ) : null}
                <button
                  onClick={() => void removePost()}
                  disabled={isMutatingPost}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 size={12} /> Delete Question
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </article>

      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Share Your Knowledge
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Explain what worked for you, include context, and keep it actionable.
        </p>
        {post.status === "CLOSED" ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            This question is closed. You can still vote and read existing
            answers.
          </div>
        ) : null}
        <textarea
          value={answerDraft}
          onChange={(event) => setAnswerDraft(event.target.value)}
          rows={5}
          placeholder={
            post.status === "CLOSED"
              ? "Question is closed for answers"
              : "Write a clear answer with steps, caveats, and practical tips"
          }
          disabled={post.status === "CLOSED"}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => void submitAnswer()}
            disabled={isSubmitting || post.status === "CLOSED"}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {post.status === "CLOSED"
              ? "Answers closed"
              : isSubmitting
                ? "Posting..."
                : "Post Answer"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Community Answers
          </h3>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Most helpful first
          </span>
        </div>

        {sortedAnswers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/80 p-8 text-center text-slate-600">
            No answers yet. Be first to help.
          </div>
        ) : (
          sortedAnswers.map((answer, index) => (
            <article
              key={answer.id}
              className="rounded-2xl border border-border bg-white p-4 sm:p-5"
            >
              <div className="flex gap-4">
                <div className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-2">
                  <button
                    onClick={() => void vote("ANSWER", answer.id, 1)}
                    disabled={isVotingKey === `ANSWER:${answer.id}`}
                    className={`rounded p-1 ${answer.myVote === 1 ? "text-power-orange" : "text-slate-600"}`}
                  >
                    <ArrowBigUp size={18} />
                  </button>
                  <span className="text-sm font-bold text-slate-900">
                    {answer.voteScore}
                  </span>
                  <button
                    onClick={() => void vote("ANSWER", answer.id, -1)}
                    disabled={isVotingKey === `ANSWER:${answer.id}`}
                    className={`rounded p-1 ${answer.myVote === -1 ? "text-red-600" : "text-slate-600"}`}
                  >
                    <ArrowBigDown size={18} />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {index === 0 && answer.voteScore > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Top answer
                        </span>
                      ) : null}
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {answer.author.displayName} •{" "}
                        {toRelativeTime(answer.createdAt)} ago
                      </p>
                    </div>
                    <button
                      onClick={() => void reportTarget("ANSWER", answer.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Flag size={12} /> Report
                    </button>
                  </div>
                  {editingAnswerId === answer.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editingAnswerDraft}
                        onChange={(event) =>
                          setEditingAnswerDraft(event.target.value)
                        }
                        rows={4}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void saveAnswerEdits(answer.id)}
                          disabled={isMutatingAnswerId === answer.id}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingAnswerId(null);
                            setEditingAnswerDraft("");
                          }}
                          className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {answer.content}
                    </p>
                  )}

                  {answer.author.id === currentUserId &&
                  editingAnswerId !== answer.id ? (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => startEditingAnswer(answer)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => void removeAnswer(answer)}
                        disabled={isMutatingAnswerId === answer.id}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
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
