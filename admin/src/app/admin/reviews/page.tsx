"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { ModerationExperience, ModerationReview, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { useCallback, useEffect, useState } from "react";

const getTargetLabel = (review: ModerationReview): string => {
  const target = review.targetId;
  const name = typeof target === "object" && target !== null ? target.name : undefined;
  const label = review.targetType === "VENUE" ? "Venue" : "Coach";
  return name ? `${label}: ${name}` : `${label} (unavailable)`;
};

const getReviewerLabel = (review: ModerationReview): string => {
  const reviewer = review.userId;
  if (typeof reviewer === "object" && reviewer !== null) {
    return reviewer.email
      ? `${reviewer.name || "Unknown"} (${reviewer.email})`
      : reviewer.name || "Unknown";
  }
  return "Unknown reviewer";
};

function ReviewsQueue() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState<"" | "VENUE" | "Coach">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getReviewModerationQueue({
        page,
        limit: 20,
      });
      if (response.success && response.data) {
        setReviews(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || response.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleModeration = async (reviewId: string, action: "APPROVE" | "HIDE" | "REMOVE") => {
    setPendingActionId(reviewId);
    try {
      await adminApi.moderateReview(reviewId, { action });
      await loadQueue();
    } finally {
      setPendingActionId(null);
    }
  };

  const visibleReviews = reviews.filter((review) => {
    if (targetTypeFilter && review.targetType !== targetTypeFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      getTargetLabel(review).toLowerCase().includes(query) ||
      getReviewerLabel(review).toLowerCase().includes(query) ||
      (review.review || "").toLowerCase().includes(query)
    );
  });

  const columns: AdminDataTableColumn<ModerationReview>[] = [
    {
      key: "target",
      header: "Reviewed",
      render: (review) => (
        <span className="font-medium text-slate-900">{getTargetLabel(review)}</span>
      ),
    },
    { key: "reviewer", header: "Reviewer", render: getReviewerLabel },
    {
      key: "rating",
      header: "Rating",
      render: (review) => `${review.rating}/5`,
    },
    {
      key: "reportCount",
      header: "Reports",
      render: (review) => review.reportCount,
    },
    {
      key: "status",
      header: "Status",
      render: (review) => review.moderationStatus,
    },
    {
      key: "review",
      header: "Review",
      className: "max-w-md",
      render: (review) => review.review || "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (review) => (
        <div className="flex gap-2">
          <button
            disabled={pendingActionId === review._id}
            onClick={() => handleModeration(review._id, "APPROVE")}
            className="rounded bg-green-100 px-2 py-1 text-green-800 hover:bg-green-200"
          >
            Approve
          </button>
          <button
            disabled={pendingActionId === review._id}
            onClick={() => handleModeration(review._id, "HIDE")}
            className="rounded bg-amber-100 px-2 py-1 text-amber-800 hover:bg-amber-200"
          >
            Hide
          </button>
          <button
            disabled={pendingActionId === review._id}
            onClick={() => handleModeration(review._id, "REMOVE")}
            className="rounded bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200"
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <Card className="bg-white">
      <AdminDataTable
        columns={columns}
        rows={visibleReviews}
        getRowKey={(review) => review._id}
        loading={loading}
        emptyMessage="No reviews pending moderation."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search this page by target, reviewer, or text...",
        }}
        toolbarExtra={
          <>
            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value as typeof targetTypeFilter)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="VENUE">Venues</option>
              <option value="Coach">Coaches</option>
            </select>
            <ExportCsvButton
              filename="reviews.csv"
              rows={visibleReviews}
              label="Export Page CSV"
              columns={[
                { header: "Reviewed", value: (r) => getTargetLabel(r) },
                { header: "Reviewer", value: (r) => getReviewerLabel(r) },
                { header: "Rating", value: (r) => r.rating },
                { header: "Reports", value: (r) => r.reportCount },
                { header: "Status", value: (r) => r.moderationStatus },
                { header: "Review Text", value: (r) => r.review || "" },
              ]}
            />
          </>
        }
        pagination={{ page, totalPages, onPageChange: setPage, total }}
      />
    </Card>
  );
}

const getSubjectLabel = (experience: ModerationExperience): string =>
  experience.subject ? `${experience.subject.kind}: ${experience.subject.name}` : "—";

/**
 * The only place a PENDING experience — one anchored to a coach or expert,
 * see requiresPreModeration in community/constants/experience.ts — can ever
 * become visible again. Before this existed, that queue had a producer and no
 * consumer.
 */
function ExperiencesQueue() {
  const [loading, setLoading] = useState(true);
  const [experiences, setExperiences] = useState<ModerationExperience[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getExperienceModerationQueue({ page, limit: 20 });
      if (response.success && response.data) {
        setExperiences(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || response.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleModeration = async (experienceId: string, action: "APPROVE" | "FLAG" | "REMOVE") => {
    setPendingActionId(experienceId);
    try {
      await adminApi.moderateExperience(experienceId, { action });
      await loadQueue();
    } finally {
      setPendingActionId(null);
    }
  };

  const visibleExperiences = experiences.filter((experience) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      experience.title.toLowerCase().includes(query) ||
      experience.author.name.toLowerCase().includes(query) ||
      experience.author.email.toLowerCase().includes(query) ||
      getSubjectLabel(experience).toLowerCase().includes(query)
    );
  });

  const columns: AdminDataTableColumn<ModerationExperience>[] = [
    {
      key: "title",
      header: "Experience",
      className: "max-w-md",
      render: (experience) => (
        <div>
          <span className="block font-medium text-slate-900">{experience.title}</span>
          {experience.excerpt ? (
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {experience.excerpt}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "author",
      header: "Author",
      render: (experience) =>
        experience.author.email
          ? `${experience.author.name} (${experience.author.email})`
          : experience.author.name,
    },
    {
      key: "subject",
      header: "About",
      render: (experience) => (
        <span className="font-medium text-amber-700">{getSubjectLabel(experience)}</span>
      ),
    },
    { key: "category", header: "Category", render: (experience) => experience.category },
    {
      key: "status",
      header: "Status",
      render: (experience) => experience.moderationStatus,
    },
    {
      key: "actions",
      header: "Actions",
      render: (experience) => (
        <div className="flex gap-2">
          <button
            disabled={pendingActionId === experience.id}
            onClick={() => handleModeration(experience.id, "APPROVE")}
            className="rounded bg-green-100 px-2 py-1 text-green-800 hover:bg-green-200"
          >
            Approve
          </button>
          <button
            disabled={pendingActionId === experience.id}
            onClick={() => handleModeration(experience.id, "FLAG")}
            className="rounded bg-amber-100 px-2 py-1 text-amber-800 hover:bg-amber-200"
          >
            Flag
          </button>
          <button
            disabled={pendingActionId === experience.id}
            onClick={() => handleModeration(experience.id, "REMOVE")}
            className="rounded bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200"
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <Card className="bg-white">
      <AdminDataTable
        columns={columns}
        rows={visibleExperiences}
        getRowKey={(experience) => experience.id}
        loading={loading}
        emptyMessage="Nothing pending review — every coach/expert-anchored experience has been decided."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search this page by title, author, or subject...",
        }}
        toolbarExtra={
          <ExportCsvButton
            filename="experience-moderation.csv"
            rows={visibleExperiences}
            label="Export Page CSV"
            columns={[
              { header: "Experience", value: (e) => e.title },
              { header: "Author", value: (e) => `${e.author.name} (${e.author.email})` },
              { header: "About", value: (e) => getSubjectLabel(e) },
              { header: "Category", value: (e) => e.category },
              { header: "Status", value: (e) => e.moderationStatus },
            ]}
          />
        }
        pagination={{ page, totalPages, onPageChange: setPage, total }}
      />
    </Card>
  );
}

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<"reviews" | "experiences">("reviews");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Review Moderation"
        subtitle="Review flagged and pending content, then approve, hide, or remove it."
      />

      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab("reviews")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "reviews"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Reviews
        </button>
        <button
          onClick={() => setTab("experiences")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "experiences"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Experiences
        </button>
      </div>

      {tab === "reviews" ? <ReviewsQueue /> : <ExperiencesQueue />}
    </div>
  );
}
