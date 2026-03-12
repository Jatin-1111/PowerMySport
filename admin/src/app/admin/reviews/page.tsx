"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { ModerationReview, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { useEffect, useState } from "react";

export default function AdminReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getReviewModerationQueue({ limit: 50 });
      if (response.success && response.data) {
        setReviews(response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Review Moderation"
        subtitle="Review flagged and pending content, then approve, hide, or remove it."
      />

      <Card className="bg-white">
        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Loading moderation queue...
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No reviews pending moderation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Reports
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Review
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviews.map((review) => (
                  <tr key={review._id} className="align-top">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {review.targetType}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {review.rating}/5
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {review.reportCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {review.moderationStatus}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-md">
                      {review.review || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          disabled={pendingActionId === review._id}
                          onClick={() =>
                            handleModeration(review._id, "APPROVE")
                          }
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
