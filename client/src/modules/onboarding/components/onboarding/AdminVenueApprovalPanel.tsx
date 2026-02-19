"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import {
  OnboardingVenue,
  PendingVenueListItem,
} from "@/modules/onboarding/types/onboarding";
import { formatOpeningHours } from "@/modules/onboarding/utils/formatOpeningHours";
import { Card } from "@/modules/shared/ui/Card";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface AdminVenueApprovalPanelProps {
  initialVenues?: PendingVenueListItem[];
}

type ViewMode = "list" | "details";

export default function AdminVenueApprovalPanel({
  initialVenues = [],
}: AdminVenueApprovalPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [venues, setVenues] = useState<PendingVenueListItem[]>(initialVenues);
  const [selectedVenue, setSelectedVenue] = useState<OnboardingVenue | null>(
    null,
  );
  const [loading, setLoading] = useState(!initialVenues.length);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
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

  // ============ Fetch pending venues on mount ============
  useEffect(() => {
    const fetchPendingVenues = async () => {
      setLoading(true);
      try {
        const response = await onboardingApi.getPendingVenues(
          currentPage,
          PAGE_SIZE,
        );
        if (!response.success || !response.data) {
          throw new Error("Failed to fetch pending venues");
        }
        setVenues(response.data.venues || []);
        setPaginationData({
          total: response.data.total || 0,
          page: response.data.page || 1,
          totalPages: response.data.totalPages || 1,
        });
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load venues");
      } finally {
        setLoading(false);
      }
    };

    if (!initialVenues.length) {
      fetchPendingVenues();
    }
  }, [currentPage, initialVenues.length]);

  // ============ View venue details ============
  const handleViewDetails = async (venueId: string) => {
    setLoading(true);
    try {
      const response = await onboardingApi.getVenueDetailsForReview(venueId);
      if (!response.success || !response.data) {
        throw new Error("Failed to fetch venue details");
      }
      setSelectedVenue(response.data);
      setViewMode("details");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load venue details",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============ Approve venue ============
  const handleApprove = async () => {
    if (!selectedVenue) return;

    const venueId =
      selectedVenue.id || selectedVenue._id || selectedVenue.venueId;
    if (!venueId) {
      setError("Venue ID not found");
      return;
    }

    const confirmed = confirm(
      `Approve venue "${selectedVenue.name}"? This will activate the venue immediately.`,
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const response = await onboardingApi.approveVenue(venueId);
      if (!response.success) {
        throw new Error(response.message || "Failed to approve venue");
      }

      setSuccessMessage(`Venue "${selectedVenue.name}" has been approved!`);
      setVenues(venues.filter((v) => v.id !== venueId));
      setViewMode("list");
      setSelectedVenue(null);

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve venue");
    } finally {
      setActionLoading(false);
    }
  };

  // ============ Reject venue ============
  const handleReject = async () => {
    if (!selectedVenue || !rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    const venueId =
      selectedVenue.id || selectedVenue._id || selectedVenue.venueId;
    if (!venueId) {
      setError("Venue ID not found");
      return;
    }

    setActionLoading(true);
    try {
      const response = await onboardingApi.rejectVenue(
        venueId,
        rejectionReason,
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to reject venue");
      }

      setSuccessMessage(
        `Venue "${selectedVenue.name}" has been rejected. Notification sent to owner.`,
      );
      setVenues(venues.filter((v) => v.id !== venueId));
      setViewMode("list");
      setSelectedVenue(null);
      setRejectionReason("");

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject venue");
    } finally {
      setActionLoading(false);
    }
  };

  // ============ Mark for review ============
  const handleMarkForReview = async () => {
    if (!selectedVenue || !reviewNotes.trim()) {
      setError("Please provide review notes");
      return;
    }

    const venueId =
      selectedVenue.id || selectedVenue._id || selectedVenue.venueId;
    if (!venueId) {
      setError("Venue ID not found");
      return;
    }

    setActionLoading(true);
    try {
      const response = await onboardingApi.markVenueForReview(
        venueId,
        reviewNotes,
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to mark venue for review");
      }

      setSuccessMessage(
        `Venue "${selectedVenue.name}" marked for review. Owner will be notified.`,
      );
      setVenues(venues.filter((v) => v.id !== venueId));
      setViewMode("list");
      setSelectedVenue(null);
      setReviewNotes("");

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark venue for review",
      );
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

        {error && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-800 rounded-xl flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700 text-xl"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-300 text-green-800 rounded-xl">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange"></div>
          </div>
        ) : venues.length === 0 ? (
          <Card className="bg-white">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
                No pending venues
              </div>
              <p className="max-w-md text-slate-600">
                All venue submissions are up to date!
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {venues.map((venue) => (
              <Card
                key={venue.id}
                className="bg-white hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {venue.name}
                    </h3>
                    <p className="text-slate-600 mt-1 text-sm">
                      Owner: {venue.ownerEmail} | {venue.ownerPhone}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-block px-3 py-1 bg-power-orange/10 text-power-orange text-xs rounded-full font-semibold">
                        {venue.sports.join(", ")}
                      </span>
                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">
                        Status: {venue.approvalStatus}
                      </span>
                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-semibold">
                        Submitted:{" "}
                        {new Date(venue.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewDetails(venue.id)}
                    className="ml-4 px-6 py-2.5 bg-power-orange text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
                  >
                    Review
                  </button>
                </div>
              </Card>
            ))}

            {/* Pagination Controls */}

            {/* Pagination Controls */}
            {paginationData.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 mt-4">
                <p className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, paginationData.total)} of{" "}
                  {paginationData.total} venues
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {Array.from(
                    { length: paginationData.totalPages },
                    (_, i) => i + 1,
                  )
                    .slice(
                      Math.max(0, currentPage - 2),
                      Math.min(paginationData.totalPages, currentPage + 1),
                    )
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
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
                      setCurrentPage(
                        Math.min(paginationData.totalPages, currentPage + 1),
                      )
                    }
                    disabled={currentPage === paginationData.totalPages}
                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          className="flex items-center gap-2 text-power-orange hover:text-orange-600 transition-colors font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>

        {error && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-800 rounded-xl flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700 text-xl"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-300 text-green-800 rounded-xl">
            {successMessage}
          </div>
        )}

        <Card className="bg-white overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-slate-200">
            <h1 className="text-3xl font-bold text-slate-900">
              {selectedVenue.name}
            </h1>
            <p className="text-slate-600 mt-2">{selectedVenue.address}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-semibold text-sm">
                Status: {selectedVenue.approvalStatus}
              </span>
            </div>
          </div>

          {/* Venue Info */}
          <div className="p-8 border-b border-slate-200 grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Basic Details
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-slate-600">Price per Hour:</dt>
                  <dd className="font-semibold text-slate-900">
                    ₹{selectedVenue.pricePerHour}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Opening Hours:</dt>
                  <dd className="font-semibold text-slate-900 text-xs">
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
              <h3 className="font-semibold text-slate-900 mb-2">
                Additional Info
              </h3>
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
                    {selectedVenue.allowExternalCoaches
                      ? "Allowed"
                      : "Not Allowed"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Description */}
          <div className="p-8 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-3">Description</h3>
            <p className="text-slate-700 leading-relaxed">
              {selectedVenue.description}
            </p>
          </div>

          {/* Photos */}
          {selectedVenue.images && selectedVenue.images.length > 0 && (
            <div className="p-8 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">
                Uploaded Photos
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {selectedVenue.images.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden"
                  >
                    <Image
                      src={photo}
                      alt={`Venue photo ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                    {photo === selectedVenue.coverPhotoUrl && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-power-orange text-white text-xs rounded font-semibold">
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
            <div className="p-8 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">
                Uploaded Documents
              </h3>
              <div className="space-y-3">
                {selectedVenue.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center space-x-3">
                      <svg
                        className="w-5 h-5 text-slate-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {doc.type}
                        </p>
                        <p className="text-sm text-slate-600">{doc.fileName}</p>
                      </div>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-power-orange hover:text-orange-600 font-semibold text-sm"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-8 bg-slate-50 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Admin Actions</h3>

            {/* Rejection Reason Field */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Rejection Reason (if rejecting)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the venue is being rejected..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                rows={3}
              />
            </div>

            {/* Review Notes Field */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Review Notes (if marking for review)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="What needs to be updated or reviewed..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                ✓ Approve
              </button>
              <button
                onClick={handleMarkForReview}
                disabled={actionLoading || !reviewNotes.trim()}
                className="flex-1 py-3 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                ⚠ Mark for Review
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                ✕ Reject
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
