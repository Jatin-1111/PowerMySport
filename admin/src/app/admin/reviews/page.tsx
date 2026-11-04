"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { ModerationExperience, ModerationReview, adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass } from "@/modules/shared/ui/buttonStyles";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Tabs } from "@/modules/shared/ui/Tabs";
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
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
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
      render: (review) => <StatusBadge status={review.moderationStatus} size="sm" />,
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
            type="button"
            disabled={pendingActionId === review._id}
            onClick={() => handleModeration(review._id, "APPROVE")}
            className={btn("outline", "sm")}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pendingActionId === review._id}
            onClick={() => handleModeration(review._id, "HIDE")}
            className={btn("quiet", "sm")}
          >
            Hide
          </button>
          <button
            type="button"
            disabled={pendingActionId === review._id}
            onClick={() => setPendingRemoveId(review._id)}
            className={btn("dangerOutline", "sm")}
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminDataTable
        columns={columns}
        rows={visibleReviews}
        getRowKey={(review) => review._id}
        loading={loading}
        emptyMessage="No reviews waiting for moderation"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search this page by target, reviewer or text",
        }}
        toolbarExtra={
          <>
            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value as typeof targetTypeFilter)}
              className={`${fieldClass} !w-auto`}
              aria-label="Review type"
            >
              <option value="">All types</option>
              <option value="VENUE">Venues</option>
              <option value="Coach">Coaches</option>
            </select>
            <ExportCsvButton
              filename="reviews.csv"
              rows={visibleReviews}
              label="Export this page (CSV)"
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
      <ConfirmModal
        open={pendingRemoveId !== null}
        variant="danger"
        title="Remove this review?"
        description="This removes it from the platform."
        confirmLabel="Remove"
        loading={pendingActionId !== null}
        onConfirm={async () => {
          if (pendingRemoveId) await handleModeration(pendingRemoveId, "REMOVE");
          setPendingRemoveId(null);
        }}
        onCancel={() => setPendingRemoveId(null)}
      />
    </>
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
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
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
      render: (experience) => <StatusBadge status={experience.moderationStatus} size="sm" />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (experience) => (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pendingActionId === experience.id}
            onClick={() => handleModeration(experience.id, "APPROVE")}
            className={btn("outline", "sm")}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pendingActionId === experience.id}
            onClick={() => handleModeration(experience.id, "FLAG")}
            className={btn("quiet", "sm")}
          >
            Flag
          </button>
          <button
            type="button"
            disabled={pendingActionId === experience.id}
            onClick={() => setPendingRemoveId(experience.id)}
            className={btn("dangerOutline", "sm")}
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminDataTable
        columns={columns}
        rows={visibleExperiences}
        getRowKey={(experience) => experience.id}
        loading={loading}
        emptyMessage="Nothing waiting. Every coach and expert experience has been decided"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search this page by title, author or subject",
        }}
        toolbarExtra={
          <ExportCsvButton
            filename="experience-moderation.csv"
            rows={visibleExperiences}
            label="Export this page (CSV)"
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
      <ConfirmModal
        open={pendingRemoveId !== null}
        variant="danger"
        title="Remove this experience?"
        description="This removes it from the platform."
        confirmLabel="Remove"
        loading={pendingActionId !== null}
        onConfirm={async () => {
          if (pendingRemoveId) await handleModeration(pendingRemoveId, "REMOVE");
          setPendingRemoveId(null);
        }}
        onCancel={() => setPendingRemoveId(null)}
      />
    </>
  );
}

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<"reviews" | "experiences">("reviews");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Commerce"
        title="Reviews"
        subtitle="Reviews and community experiences waiting for a decision: approve, hide or remove."
      />

      <Tabs
        label="Moderation queue"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "reviews" as const, label: "Reviews" },
          { id: "experiences" as const, label: "Experiences" },
        ]}
      />

      {tab === "reviews" ? <ReviewsQueue /> : <ExperiencesQueue />}
    </div>
  );
}
