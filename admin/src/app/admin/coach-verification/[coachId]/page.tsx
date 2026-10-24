"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass } from "@/modules/shared/ui/buttonStyles";
import { Panel } from "@/modules/shared/ui/Panel";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Coach } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

type ActionMode = "REJECT" | "REVIEW";

export default function AdminCoachVerificationDetailPage() {
  const params = useParams<{ coachId: string }>();
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
        await adminApi.markCoachVerificationForReview(coachId, actionText.trim() || undefined);
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

  const handleNotify = async () => {
    if (!coachId) return;

    setActionLoading(true);
    try {
      const response = await adminApi.notifyCoachVerification(coachId);
      toast.success(response.message || "Verification reminder email sent.");
    } catch (err) {
      console.error("Failed to send verification reminder:", err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to send verification reminder.";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const header = (
    <AdminPageHeader
      badge="People"
      title="Coach details"
      subtitle="Everything the coach submitted, with the decision on the right."
    />
  );

  const back = (
    <Link
      href="/admin/coach-verification"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Coach verification
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonBlock rows={6} label="Loading coach details" />
      </div>
    );
  }

  if (error || !coach) {
    return (
      <div className="space-y-6">
        {header}
        {back}
        <ErrorNotice message={error || "We couldn't find this coach."} onRetry={loadCoach} />
      </div>
    );
  }

  const facts: Array<{ label: string; value: string }> = [
    { label: "Email", value: userInfo?.email || "No email" },
    { label: "Service mode", value: coach.serviceMode || "Not set" },
    { label: "Hourly rate", value: `₹${coach.hourlyRate || 0}` },
    {
      label: "Submitted for verification",
      value: coach.verificationSubmittedAt
        ? new Date(coach.verificationSubmittedAt).toLocaleString("en-IN")
        : "Not submitted",
    },
    { label: "Sports", value: coach.sports?.length ? coach.sports.join(", ") : "None listed" },
  ];

  return (
    <div className="space-y-6">
      {header}
      {back}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="space-y-6">
          <Panel
            title={userInfo?.name || "Coach"}
            action={<StatusBadge status={coach.verificationStatus || "UNVERIFIED"} />}
          >
            <dl className="divide-y divide-slate-100">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="grid gap-1 py-2.5 first:pt-0 sm:grid-cols-[11rem_1fr] sm:gap-4"
                >
                  <dt className="text-sm text-slate-500">{fact.label}</dt>
                  <dd className="min-w-0 break-words text-sm font-medium text-slate-900">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">Bio</p>
              <p className="mt-1 max-w-[65ch] whitespace-pre-wrap text-sm text-slate-800">
                {coach.bio || "No bio provided."}
              </p>
            </div>

            {coach.verificationNotes ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <span className="font-semibold">Notes:</span> {coach.verificationNotes}
              </div>
            ) : null}
          </Panel>

          <Panel title="Documents">
            {coach.verificationDocuments?.length ? (
              <ul className="flex flex-wrap gap-2">
                {coach.verificationDocuments.map((doc, index) => (
                  <li key={`${doc.fileName}-${index}`}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    >
                      {doc.type}: {doc.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">The coach has not uploaded any documents.</p>
            )}
          </Panel>

          {coach.ownVenueDetails ? (
            <Panel title="Own venue">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-slate-500">Venue name</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {coach.ownVenueDetails.name || "Not given"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Price per hour</dt>
                  <dd className="text-sm font-medium tabular-nums text-slate-900">
                    ₹{coach.ownVenueDetails.pricePerHour || 0}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-slate-500">Address</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {coach.ownVenueDetails.address || "Not given"}
                  </dd>
                </div>
                {coach.ownVenueDetails.description ? (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-500">Description</dt>
                    <dd className="text-sm text-slate-800">{coach.ownVenueDetails.description}</dd>
                  </div>
                ) : null}
              </dl>

              {coach.ownVenueDetails.images?.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {coach.ownVenueDetails.images.map((imageUrl, index) => (
                    <a
                      key={`${imageUrl}-${index}`}
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-lg border border-slate-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={`Venue photo ${index + 1}`}
                        className="h-36 w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No venue photos uploaded.</p>
              )}
            </Panel>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-6">
          <Panel
            title="Decision"
            description="Approving shows the verified badge on the coach's profile."
          >
            <div className="flex flex-col gap-2">
              {coach.verificationStatus !== "VERIFIED" && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className={btn("primary")}
                >
                  Approve coach
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActionMode("REVIEW");
                  setActionText("");
                }}
                disabled={actionLoading}
                className={btn("outline")}
              >
                Move to review
              </button>
              {coach.verificationStatus !== "VERIFIED" && (
                <button
                  type="button"
                  onClick={handleNotify}
                  disabled={actionLoading}
                  className={btn("outline")}
                >
                  Send reminder
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActionMode("REJECT");
                  setActionText("");
                }}
                disabled={actionLoading}
                className={btn("dangerOutline")}
              >
                Reject
              </button>
            </div>

            {actionMode ? (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <label htmlFor="decision-note" className="text-sm font-semibold text-slate-800">
                  {actionMode === "REJECT" ? "Reason for rejecting" : "Review notes (optional)"}
                </label>
                <textarea
                  id="decision-note"
                  rows={4}
                  value={actionText}
                  onChange={(event) => setActionText(event.target.value)}
                  placeholder={
                    actionMode === "REJECT"
                      ? "Say what is missing or wrong, so the coach can fix it"
                      : "Add notes for the review queue"
                  }
                  className={fieldClass}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitAction}
                    disabled={actionLoading || (actionMode === "REJECT" && !actionText.trim())}
                    className={btn(actionMode === "REJECT" ? "danger" : "primary")}
                  >
                    {actionLoading ? "Saving…" : actionMode === "REJECT" ? "Reject coach" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMode(null);
                      setActionText("");
                    }}
                    disabled={actionLoading}
                    className={btn("outline")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
