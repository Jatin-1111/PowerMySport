"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { ModerationReview, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { useCallback, useEffect, useState } from "react";

const getTargetLabel = (review: ModerationReview): string => {
  const target = review.targetId;
  const name =
    typeof target === "object" && target !== null ? target.name : undefined;
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

export default function AdminReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState<
    "" | "VENUE" | "Coach"
  >("");
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

  const handleModeration = async (
    reviewId: string,
    action: "APPROVE" | "HIDE" | "REMOVE",
  ) => {
    setPendingActionId(reviewId);
    try {
      await adminApi.moderateReview(reviewId, { action });
      await loadQueue();
    } finally {
      setPendingActionId(null);
    }
  };

  const visibleReviews = reviews.filter((review) => {
    if (targetTypeFilter && review.targetType !== targetTypeFilter)
      return false;
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
        <span className="font-medium text-slate-900">
          {getTargetLabel(review)}
        </span>
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
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Review Moderation"
        subtitle="Review flagged and pending content, then approve, hide, or remove it."
      />

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
                onChange={(e) =>
                  setTargetTypeFilter(e.target.value as typeof targetTypeFilter)
                }
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
    </div>
  );
}
