"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { Coach } from "@/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ActionMode = "REJECT" | "REVIEW";

export default function AdminCoachVerificationDetailPage() {
  const params = useParams<{ coachId: string }>();
  const router = useRouter();
  const coachId = params?.coachId || "";

  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionText, setActionText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const userInfo = useMemo(() => {
    if (!coach || typeof coach.userId !== "object" || coach.userId === null) {
      return null;
    }
    return coach.userId as Record<string, string>;
  }, [coach]);

  const loadCoach = useCallback(async () => {
    if (!coachId) {
      setError("Coach ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const response = await adminApi.getCoachVerificationById(coachId);
      if (response.success && response.data) {
        setCoach(response.data);
        return;
      }

      setError(response.message || "Failed to load coach details.");
    } catch (err) {
      console.error("Failed to load coach details:", err);
      setError("Failed to load coach details.");
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    loadCoach();
  }, [loadCoach]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "VERIFIED":
        return "bg-green-100 text-green-700 border border-green-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700 border border-yellow-200";
      case "REVIEW":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "REJECTED":
        return "bg-red-100 text-red-700 border border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  const handleApprove = async () => {
    if (!coachId) return;
    setActionLoading(true);
    try {
      await adminApi.approveCoachVerification(coachId);
      toast.success("Coach approved successfully.");
      await loadCoach();
    } catch (err) {
      console.error("Failed to approve coach:", err);
      toast.error("Failed to approve coach.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitAction = async () => {
    if (!coachId || !actionMode) return;

    if (actionMode === "REJECT" && !actionText.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }

    setActionLoading(true);
    try {
      if (actionMode === "REJECT") {
        await adminApi.rejectCoachVerification(coachId, actionText.trim());
        toast.success("Coach rejected successfully.");
      } else {
        await adminApi.markCoachVerificationForReview(
          coachId,
          actionText.trim() || undefined,
        );
        toast.success("Coach moved to review.");
      }

      setActionMode(null);
      setActionText("");
      await loadCoach();
    } catch (err) {
      console.error("Failed to update verification status:", err);
      toast.error("Failed to update verification status.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center">Loading coach details...</div>;
  }

  if (error || !coach) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="Coach Details"
          subtitle="Review complete coach profile before verification."
        />
        <Card className="bg-white">
          <div className="space-y-3 py-10 text-center">
            <p className="font-semibold text-red-600">
              {error || "Coach details not found."}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={loadCoach}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
              >
                Retry
              </button>
              <button
                onClick={() => router.push("/admin/coach-verification")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50"
              >
                Back
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Coach Details"
        subtitle="Review complete coach profile before verification."
      />

      <div>
        <Link
          href="/admin/coach-verification"
          className="text-sm font-semibold text-slate-600 transition-colors hover:text-power-orange"
        >
          ← Back to coach verification list
        </Link>
      </div>

      <Card className="bg-white">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">
              {userInfo?.name || "Coach"}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
                coach.verificationStatus,
              )}`}
            >
              {coach.verificationStatus || "UNVERIFIED"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Email
              </p>
              <p className="text-sm font-medium text-slate-800">
                {userInfo?.email || "No email"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Service Mode
              </p>
              <p className="text-sm font-medium text-slate-800">
                {coach.serviceMode || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Hourly Rate
              </p>
              <p className="text-sm font-medium text-slate-800">
                ₹{coach.hourlyRate || 0}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Verification Submitted
              </p>
              <p className="text-sm font-medium text-slate-800">
                {coach.verificationSubmittedAt
                  ? new Date(coach.verificationSubmittedAt).toLocaleString()
                  : "Not submitted"}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Sports
            </p>
            <p className="text-sm text-slate-800">
              {coach.sports?.length ? coach.sports.join(", ") : "No sports"}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Bio
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">
              {coach.bio || "No bio provided."}
            </p>
          </div>

          {coach.verificationNotes ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span className="font-semibold">Notes:</span>{" "}
              {coach.verificationNotes}
            </div>
          ) : null}
        </div>
      </Card>

      {coach.ownVenueDetails ? (
        <Card className="bg-white">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Own Venue Details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Venue Name
              </p>
              <p className="text-sm text-slate-800">
                {coach.ownVenueDetails.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Price Per Hour
              </p>
              <p className="text-sm text-slate-800">
                ₹{coach.ownVenueDetails.pricePerHour || 0}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Address
              </p>
              <p className="text-sm text-slate-800">
                {coach.ownVenueDetails.address || "-"}
              </p>
            </div>
            {coach.ownVenueDetails.description ? (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Description
                </p>
                <p className="text-sm text-slate-800">
                  {coach.ownVenueDetails.description}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Venue Images
            </p>
            {coach.ownVenueDetails.images?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {coach.ownVenueDetails.images.map((imageUrl, index) => (
                  <a
                    key={`${imageUrl}-${index}`}
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-lg border border-slate-200"
                  >
                    <img
                      src={imageUrl}
                      alt={`Venue image ${index + 1}`}
                      className="h-36 w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No venue images uploaded.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      <Card className="bg-white">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Documents</h3>
        {coach.verificationDocuments?.length ? (
          <div className="flex flex-wrap gap-2">
            {coach.verificationDocuments.map((doc, index) => (
              <a
                key={`${doc.fileName}-${index}`}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-power-orange hover:text-power-orange"
              >
                {doc.type}: {doc.fileName}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No documents uploaded.</p>
        )}
      </Card>

      <Card className="bg-white">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Verification Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => {
              setActionMode("REVIEW");
              setActionText("");
            }}
            disabled={actionLoading}
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark Review
          </button>
          <button
            onClick={() => {
              setActionMode("REJECT");
              setActionText("");
            }}
            disabled={actionLoading}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>

        {actionMode ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-800">
              {actionMode === "REJECT"
                ? "Rejection reason"
                : "Review notes (optional)"}
            </p>
            <textarea
              rows={3}
              value={actionText}
              onChange={(event) => setActionText(event.target.value)}
              placeholder={
                actionMode === "REJECT"
                  ? "Explain why this verification is rejected"
                  : "Add notes for the review queue"
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitAction}
                disabled={
                  actionLoading ||
                  (actionMode === "REJECT" && !actionText.trim())
                }
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Submit"}
              </button>
              <button
                onClick={() => {
                  setActionMode(null);
                  setActionText("");
                }}
                disabled={actionLoading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
