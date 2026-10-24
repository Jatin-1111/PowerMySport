"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import { OnboardingVenue, PendingVenueListItem } from "@/modules/onboarding/types/onboarding";
import { formatOpeningHours } from "@/modules/onboarding/utils/formatOpeningHours";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { Pagination } from "@/modules/shared/ui/Pagination";
import { Panel } from "@/modules/shared/ui/Panel";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { ArrowLeft, Check, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { useConfirm } from "@/modules/shared/ui/useConfirm";

interface AdminVenueApprovalPanelProps {
  initialVenues?: PendingVenueListItem[];
}

type ViewMode = "list" | "details";

export default function AdminVenueApprovalPanel({
  initialVenues = [],
}: AdminVenueApprovalPanelProps) {
  const [confirmAction, confirmDialog] = useConfirm();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [venues, setVenues] = useState<PendingVenueListItem[]>(initialVenues);
  const [selectedVenue, setSelectedVenue] = useState<OnboardingVenue | null>(null);
  const [loading, setLoading] = useState(!initialVenues.length);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationData, setPaginationData] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const PAGE_SIZE = 10;

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const loadPendingVenues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await onboardingApi.getPendingVenues(currentPage, PAGE_SIZE);
      if (!response.success || !response.data) {
        const message = response.message || "Failed to fetch pending venues";
        setError(message);
        toast.error(message);
        return;
      }

      setVenues(response.data.venues || []);
      setPaginationData({
        total: response.data.total || 0,
        page: response.data.page || 1,
        totalPages: response.data.totalPages || 1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load venues";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  // ============ Fetch pending venues on mount ============
  useEffect(() => {
    if (!initialVenues.length) {
      loadPendingVenues();
    }
  }, [initialVenues.length, loadPendingVenues]);

  // ============ View venue details ============
  const handleViewDetails = async (venueId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await onboardingApi.getVenueDetailsForReview(venueId);
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to fetch venue details");
      }
      setSelectedVenue(response.data);
      setViewMode("details");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load venue details";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ============ Approve venue ============
  const handleApprove = async () => {
    if (!selectedVenue) return;

    const venueId = selectedVenue.id || selectedVenue._id || selectedVenue.venueId;
    if (!venueId) {
      toast.error("Venue ID not found");
      return;
    }

    const confirmed = await confirmAction({
      title: `Approve "${selectedVenue.name}"?`,
      description: "The venue goes live immediately.",
      confirmLabel: "Approve venue",
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const response = await onboardingApi.approveVenue(venueId);
      if (!response.success) {
        throw new Error(response.message || "Failed to approve venue");
      }

      toast.success(`Venue "${selectedVenue.name}" has been approved!`);
      setVenues(venues.filter((v) => v.id !== venueId));
      setViewMode("list");
      setSelectedVenue(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve venue");
    } finally {
      setActionLoading(false);
    }
  };

  // ============ Reject venue ============
  const handleReject = async () => {
    if (!selectedVenue || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    const venueId = selectedVenue.id || selectedVenue._id || selectedVenue.venueId;
    if (!venueId) {
      toast.error("Venue ID not found");
      return;
    }

    setActionLoading(true);
    try {
      const response = await onboardingApi.rejectVenue(venueId, rejectionReason);

      if (!response.success) {
        throw new Error(response.message || "Failed to reject venue");
      }

      toast.success(`Venue "${selectedVenue.name}" has been rejected. Notification sent to owner.`);
      setVenues(venues.filter((v) => v.id !== venueId));
      setViewMode("list");
      setSelectedVenue(null);
      setRejectionReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject venue");
    } finally {
      setActionLoading(false);
    }
  };

  // ============ Mark for review ============
  const handleMarkForReview = async () => {
    if (!selectedVenue || !reviewNotes.trim()) {
      toast.error("Please provide review notes");
      return;
    }

    const venueId = selectedVenue.id || selectedVenue._id || selectedVenue.venueId;
    if (!venueId) {
      toast.error("Venue ID not found");
      return;
    }

    setActionLoading(true);
    try {
      const response = await onboardingApi.markVenueForReview(venueId, reviewNotes);

      if (!response.success) {
        throw new Error(response.message || "Failed to mark venue for review");
      }

      toast.success(`Venue "${selectedVenue.name}" marked for review. Owner will be notified.`);
      setVenues(venues.filter((v) => v.id !== venueId));
      setViewMode("list");
      setSelectedVenue(null);
      setReviewNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark venue for review");
    } finally {
      setActionLoading(false);
    }
  };

  // ============ LIST VIEW ============
  if (viewMode === "list") {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Commerce"
          title="Venue approvals"
          subtitle="New venue submissions waiting for a decision. Open one to check photos, documents and details."
        />

        {loading ? (
          <SkeletonBlock rows={6} label="Loading pending venues" />
        ) : error ? (
          <ErrorNotice message={error} onRetry={loadPendingVenues} />
        ) : venues.length === 0 ? (
          <EmptyState
            title="No venues waiting"
            description="New submissions will appear here for approval."
          />
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {venues.map((venue) => (
                <li key={venue.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{venue.name}</h3>
                      <StatusBadge status={venue.approvalStatus} size="sm" />
                    </div>
                    <p className="text-sm text-slate-600">
                      {venue.ownerEmail} · {venue.ownerPhone}
                    </p>
                    <p className="text-sm text-slate-500">
                      {venue.sports.join(", ")} · Submitted{" "}
                      {new Date(venue.submittedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewDetails(venue.id)}
                    className={btn("primary")}
                  >
                    Review venue
                  </button>
                </li>
              ))}
            </ul>

            <Pagination
              page={currentPage}
              totalPages={paginationData.totalPages}
              total={paginationData.total}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    );
  }

  // ============ DETAILS VIEW ============
  if (viewMode === "details" && selectedVenue) {
    const facts: Array<{ label: string; value: React.ReactNode }> = [
      { label: "Price per hour", value: `₹${selectedVenue.pricePerHour}` },
      { label: "Opening hours", value: formatOpeningHours(selectedVenue.openingHours) },
      {
        label: "Coordinates",
        value: (
          <span className="font-mono text-xs">
            {selectedVenue.location?.coordinates[1]}, {selectedVenue.location?.coordinates[0]}
          </span>
        ),
      },
      { label: "Sports", value: selectedVenue.sports.join(", ") },
      { label: "Amenities", value: selectedVenue.amenities?.join(", ") || "None" },
      {
        label: "External coaches",
        value: selectedVenue.allowExternalCoaches ? "Allowed" : "Not allowed",
      },
    ];

    return (
      <div className="space-y-6">
        {confirmDialog}
        <AdminPageHeader
          badge="Commerce"
          title={selectedVenue.name}
          subtitle={selectedVenue.address}
          action={<StatusBadge status={selectedVenue.approvalStatus} />}
        />

        <button
          type="button"
          onClick={() => setViewMode("list")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Venue approvals
        </button>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <div className="space-y-6">
            <Panel title="Details">
              <dl className="divide-y divide-slate-100">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4"
                  >
                    <dt className="text-sm text-slate-500">{fact.label}</dt>
                    <dd className="min-w-0 break-words text-sm font-medium text-slate-900">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 max-w-[65ch] border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">
                {selectedVenue.description || "No description provided."}
              </p>
            </Panel>

            {selectedVenue.images && selectedVenue.images.length > 0 && (
              <Panel title="Photos">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {selectedVenue.images.map((photo, idx) => (
                    <div key={idx} className="relative aspect-video overflow-hidden rounded-lg">
                      <Image
                        src={photo}
                        alt={`Venue photo ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                      {photo === selectedVenue.coverPhotoUrl && (
                        <span className="bg-deep-slate absolute right-2 top-2 rounded px-2 py-1 text-xs font-semibold text-white">
                          Cover photo
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {selectedVenue.documents && selectedVenue.documents.length > 0 && (
              <Panel title="Documents">
                <ul className="divide-y divide-slate-100">
                  {selectedVenue.documents.map((doc, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{doc.type}</p>
                        <p className="truncate text-sm text-slate-600">{doc.fileName}</p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={btn("outline", "sm")}
                      >
                        Open
                      </a>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div className="lg:sticky lg:top-6">
            <Panel title="Decision" description="The owner is notified of whichever you choose.">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className={btn("primary", "md", "w-full")}
                >
                  <Check size={16} aria-hidden />
                  Approve venue
                </button>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label htmlFor="review-notes" className={labelClass}>
                    What needs to change
                  </label>
                  <textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Tell the owner what to fix or add"
                    className={fieldClass}
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={handleMarkForReview}
                    disabled={actionLoading || !reviewNotes.trim()}
                    className={btn("outline", "md", "w-full")}
                  >
                    <TriangleAlert size={16} aria-hidden />
                    Ask for changes
                  </button>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label htmlFor="reject-reason" className={labelClass}>
                    Reason for rejecting
                  </label>
                  <textarea
                    id="reject-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this venue can't be listed"
                    className={fieldClass}
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={actionLoading || !rejectionReason.trim()}
                    className={btn("dangerOutline", "md", "w-full")}
                  >
                    <X size={16} aria-hidden />
                    Reject venue
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
