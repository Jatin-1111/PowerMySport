"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import { OnboardingVenue, PendingVenueListItem } from "@/modules/onboarding/types/onboarding";
import { formatOpeningHours } from "@/modules/onboarding/utils/formatOpeningHours";
import { Card } from "@/modules/shared/ui/Card";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

interface AdminVenueApprovalPanelProps {
  initialVenues?: PendingVenueListItem[];
}

type ViewMode = "list" | "details";

export default function AdminVenueApprovalPanel({
  initialVenues = [],
}: AdminVenueApprovalPanelProps) {
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

    const confirmed = confirm(
      `Approve venue "${selectedVenue.name}"? This will activate the venue immediately.`
    );
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
          badge="Admin"
          title="Venue Approval Panel"
          subtitle="Review and approve pending venue submissions to expand the platform."
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="border-power-orange h-12 w-12 animate-spin rounded-full border-b-2"></div>
          </div>
        ) : error ? (
          <Card className="bg-white">
            <div className="space-y-3 py-10 text-center">
              <p className="font-semibold text-red-600">{error}</p>
              <button
                onClick={loadPendingVenues}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
              >
                Retry
              </button>
            </div>
          </Card>
        ) : venues.length === 0 ? (
          <Card className="bg-white">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="bg-power-orange/10 text-power-orange rounded-full px-4 py-2 text-sm font-semibold">
                No pending venues
              </div>
              <p className="max-w-md text-slate-600">All venue submissions are up to date!</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {venues.map((venue) => (
              <Card key={venue.id} className="bg-white transition-shadow hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900">{venue.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Owner: {venue.ownerEmail} | {venue.ownerPhone}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="bg-power-orange/10 text-power-orange inline-block rounded-full px-3 py-1 text-xs font-semibold">
                        {venue.sports.join(", ")}
                      </span>
                      <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                        Status: {venue.approvalStatus}
                      </span>
                      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Submitted: {new Date(venue.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewDetails(venue.id)}
                    className="bg-power-orange ml-4 rounded-lg px-6 py-2.5 font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    Review
                  </button>
                </div>
              </Card>
            ))}

            {/* Pagination Controls */}

            {/* Pagination Controls */}
            {paginationData.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, paginationData.total)} of{" "}
                  {paginationData.total} venues
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1)
                    .slice(
                      Math.max(0, currentPage - 2),
                      Math.min(paginationData.totalPages, currentPage + 1)
                    )
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`rounded-lg px-3 py-2 font-semibold transition-colors ${
                          currentPage === page
                            ? "bg-power-orange text-white"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(paginationData.totalPages, currentPage + 1))
                    }
                    disabled={currentPage === paginationData.totalPages}
                    className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============ DETAILS VIEW ============
  if (viewMode === "details" && selectedVenue) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setViewMode("list")}
          className="text-power-orange flex items-center gap-2 font-semibold transition-colors hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </button>

        <Card className="overflow-hidden bg-white">
          {/* Header */}
          <div className="border-b border-slate-200 p-5 sm:p-8">
            <h1 className="text-3xl font-bold text-slate-900">{selectedVenue.name}</h1>
            <p className="mt-2 text-slate-600">{selectedVenue.address}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-800">
                Status: {selectedVenue.approvalStatus}
              </span>
            </div>
          </div>

          {/* Venue Info */}
          <div className="grid grid-cols-1 gap-6 border-b border-slate-200 p-5 sm:p-8 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Basic Details</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-slate-600">Price per Hour:</dt>
                  <dd className="font-semibold text-slate-900">₹{selectedVenue.pricePerHour}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Opening Hours:</dt>
                  <dd className="text-xs font-semibold text-slate-900">
                    {formatOpeningHours(selectedVenue.openingHours)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Location:</dt>
                  <dd className="font-semibold text-slate-900">
                    {selectedVenue.location?.coordinates[1]},{" "}
                    {selectedVenue.location?.coordinates[0]}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Additional Info</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-slate-600">Sports:</dt>
                  <dd className="font-semibold text-slate-900">
                    {selectedVenue.sports.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Amenities:</dt>
                  <dd className="font-semibold text-slate-900">
                    {selectedVenue.amenities?.join(", ") || "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">External Coaches:</dt>
                  <dd className="font-semibold text-slate-900">
                    {selectedVenue.allowExternalCoaches ? "Allowed" : "Not Allowed"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Description */}
          <div className="border-b border-slate-200 p-5 sm:p-8">
            <h3 className="mb-3 font-semibold text-slate-900">Description</h3>
            <p className="leading-relaxed text-slate-700">{selectedVenue.description}</p>
          </div>

          {/* Photos */}
          {selectedVenue.images && selectedVenue.images.length > 0 && (
            <div className="border-b border-slate-200 p-5 sm:p-8">
              <h3 className="mb-4 font-semibold text-slate-900">Uploaded Photos</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {selectedVenue.images.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden rounded-lg">
                    <Image
                      src={photo}
                      alt={`Venue photo ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                    {photo === selectedVenue.coverPhotoUrl && (
                      <div className="bg-power-orange absolute top-2 right-2 rounded px-2 py-1 text-xs font-semibold text-white">
                        Cover Photo
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {selectedVenue.documents && selectedVenue.documents.length > 0 && (
            <div className="border-b border-slate-200 p-5 sm:p-8">
              <h3 className="mb-4 font-semibold text-slate-900">Uploaded Documents</h3>
              <div className="space-y-3">
                {selectedVenue.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <svg
                        className="h-5 w-5 text-slate-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4z" />
                      </svg>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{doc.type}</p>
                        <p className="text-sm text-slate-600">{doc.fileName}</p>
                      </div>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-power-orange text-sm font-semibold hover:text-orange-600"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t border-slate-200 bg-slate-50 p-5 sm:p-8">
            <h3 className="mb-4 font-semibold text-slate-900">Admin Actions</h3>

            {/* Rejection Reason Field */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Rejection Reason (if rejecting)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the venue is being rejected..."
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-red-500 focus:ring-2 focus:ring-red-500/50 focus:outline-none"
                rows={3}
              />
            </div>

            {/* Review Notes Field */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Review Notes (if marking for review)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="What needs to be updated or reviewed..."
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/50 focus:outline-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={16} />
                Approve
              </button>
              <button
                onClick={handleMarkForReview}
                disabled={actionLoading || !reviewNotes.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <TriangleAlert size={16} />
                Mark for Review
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={16} />
                Reject
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
