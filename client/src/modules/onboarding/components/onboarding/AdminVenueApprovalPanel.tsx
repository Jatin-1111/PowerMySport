"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import {
  OnboardingVenue,
  PendingVenueListItem,
} from "@/modules/onboarding/types/onboarding";
import { formatOpeningHours } from "@/modules/onboarding/utils/formatOpeningHours";

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

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  // ============ Fetch pending venues on mount ============
  useEffect(() => {
    if (!initialVenues.length) {
      fetchPendingVenues();
    }
  }, []);

  const fetchPendingVenues = async () => {
    setLoading(true);
    try {
      const response = await onboardingApi.getPendingVenues();
      if (!response.success || !response.data) {
        throw new Error("Failed to fetch pending venues");
      }
      setVenues(response.data.venues);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load venues");
    } finally {
      setLoading(false);
    }
  };

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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Venue Approval Panel
            </h1>
            <p className="text-gray-600 mt-2">
              Review and approve pending venue submissions
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-red-500">
                ?
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              {successMessage}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : venues.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <svg
                className="w-16 h-16 mx-auto text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">
                No Pending Venues
              </h3>
              <p className="text-gray-600 mt-1">All venues are up to date!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {venues.map((venue) => (
                <div
                  key={venue.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition"
                >
                  <div className="p-6 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {venue.name}
                      </h3>
                      <p className="text-gray-600 mt-1 text-sm">
                        Owner: {venue.ownerEmail} | {venue.ownerPhone}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                          {venue.sports.join(", ")}
                        </span>
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                          Status: {venue.approvalStatus}
                        </span>
                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 text-xs rounded-full font-medium">
                          Submitted:{" "}
                          {new Date(venue.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewDetails(venue.id)}
                      className="ml-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ DETAILS VIEW ============
  if (viewMode === "details" && selectedVenue) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <button
            onClick={() => setViewMode("list")}
            className="mb-6 flex items-center text-blue-600 hover:text-blue-800"
          >
            ? Back to List
          </button>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-red-500">
                ?
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              {successMessage}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b">
              <h1 className="text-3xl font-bold text-gray-900">
                {selectedVenue.name}
              </h1>
              <p className="text-gray-600 mt-2">{selectedVenue.address}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                  Status: {selectedVenue.approvalStatus}
                </span>
              </div>
            </div>

            {/* Venue Info */}
            <div className="p-8 border-b grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Basic Details
                </h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-600">Price per Hour:</dt>
                    <dd className="font-medium text-gray-900">
                      ${selectedVenue.pricePerHour}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Opening Hours:</dt>
                    <dd className="font-medium text-gray-900 text-xs">
                      {formatOpeningHours(selectedVenue.openingHours)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Location:</dt>
                    <dd className="font-medium text-gray-900">
                      {selectedVenue.location?.coordinates[1]},{" "}
                      {selectedVenue.location?.coordinates[0]}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Additional Info
                </h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-600">Sports:</dt>
                    <dd className="font-medium text-gray-900">
                      {selectedVenue.sports.join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Amenities:</dt>
                    <dd className="font-medium text-gray-900">
                      {selectedVenue.amenities?.join(", ") || "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">External Coaches:</dt>
                    <dd className="font-medium text-gray-900">
                      {selectedVenue.allowExternalCoaches
                        ? "Allowed"
                        : "Not Allowed"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Description */}
            <div className="p-8 border-b">
              <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
              <p className="text-gray-700 leading-relaxed">
                {selectedVenue.description}
              </p>
            </div>

            {/* Photos */}
            {selectedVenue.images && selectedVenue.images.length > 0 && (
              <div className="p-8 border-b">
                <h3 className="font-semibold text-gray-900 mb-4">
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
                        <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">
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
              <div className="p-8 border-b">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Uploaded Documents
                </h3>
                <div className="space-y-3">
                  {selectedVenue.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4z" />
                        </svg>
                        <div>
                          <p className="font-medium text-gray-900">
                            {doc.type}
                          </p>
                          <p className="text-sm text-gray-600">
                            {doc.fileName}
                          </p>
                        </div>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-8 bg-gray-50 border-t">
              <h3 className="font-semibold text-gray-900 mb-4">
                Admin Actions
              </h3>

              {/* Rejection Reason Field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason (if rejecting)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why the venue is being rejected..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                  rows={3}
                />
              </div>

              {/* Review Notes Field */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes (if marking for review)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="What needs to be updated or reviewed..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-yellow-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  ? Approve
                </button>
                <button
                  onClick={handleMarkForReview}
                  disabled={actionLoading || !reviewNotes.trim()}
                  className="flex-1 py-3 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition"
                >
                  ? Mark for Review
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  ? Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
