"use client";

import React, { useEffect, useState } from "react";
import { venueInquiryApi, VenueInquiry } from "@/lib/venueInquiry";

export default function VenueInquiriesPage() {
  const [inquiries, setInquiries] = useState<VenueInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("PENDING");
  const [selectedInquiry, setSelectedInquiry] = useState<VenueInquiry | null>(
    null,
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, [filter]);

  const loadInquiries = async () => {
    try {
      const response = await venueInquiryApi.getAllInquiries(filter);
      if (response.success && response.data) {
        setInquiries(response.data);
      }
    } catch (error) {
      console.error("Failed to load inquiries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (
    inquiryId: string,
    status: "APPROVED" | "REJECTED",
  ) => {
    setIsProcessing(true);
    try {
      const response = await venueInquiryApi.reviewInquiry(inquiryId, {
        status,
        reviewNotes,
      });

      if (response.success) {
        alert(
          status === "APPROVED"
            ? `Inquiry approved! Credentials: ${response.data.credentials?.email} / ${response.data.credentials?.password}`
            : "Inquiry rejected",
        );
        setSelectedInquiry(null);
        setReviewNotes("");
        loadInquiries();
      }
    } catch (error: any) {
      console.error("Failed to review inquiry:", error);
      alert(error.response?.data?.message || "Failed to review inquiry");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading inquiries...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-deep-slate">
        Venue Inquiries
      </h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {["PENDING", "APPROVED", "REJECTED"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === status
                ? "bg-power-orange text-white"
                : "bg-muted text-foreground hover:bg-gray-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Inquiries List */}
      {inquiries.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">
            No {filter.toLowerCase()} inquiries
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="bg-card rounded-lg p-6 border border-border"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-deep-slate mb-1">
                    {inquiry.venueName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    📍 {inquiry.address}, {inquiry.city}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    inquiry.status === "PENDING"
                      ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500"
                      : inquiry.status === "APPROVED"
                        ? "bg-turf-green/10 text-turf-green border border-turf-green"
                        : "bg-error-red/10 text-error-red border border-error-red"
                  }`}
                >
                  {inquiry.status}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <p className="font-semibold">{inquiry.ownerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-semibold">{inquiry.email}</p>
                  <p className="text-sm">{inquiry.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sports</p>
                  <p className="font-semibold">{inquiry.sports}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="font-semibold">
                    {new Date(inquiry.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {inquiry.facilities && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Facilities</p>
                  <p className="font-semibold">{inquiry.facilities}</p>
                </div>
              )}

              {inquiry.message && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Message</p>
                  <p className="text-sm bg-muted p-3 rounded">
                    {inquiry.message}
                  </p>
                </div>
              )}

              {/* Review Section */}
              {inquiry.status === "PENDING" && (
                <div className="border-t border-border pt-4 mt-4">
                  {selectedInquiry?.id === inquiry.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add review notes (optional)..."
                        rows={3}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(inquiry.id, "APPROVED")}
                          disabled={isProcessing}
                          className="bg-turf-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          {isProcessing ? "Processing..." : "✓ Approve"}
                        </button>
                        <button
                          onClick={() => handleReview(inquiry.id, "REJECTED")}
                          disabled={isProcessing}
                          className="bg-error-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          ✗ Reject
                        </button>
                        <button
                          onClick={() => {
                            setSelectedInquiry(null);
                            setReviewNotes("");
                          }}
                          className="bg-muted text-foreground px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedInquiry(inquiry)}
                      className="bg-power-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                    >
                      Review Inquiry
                    </button>
                  )}
                </div>
              )}

              {inquiry.reviewNotes && (
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-sm text-muted-foreground">Review Notes</p>
                  <p className="text-sm bg-muted p-3 rounded">
                    {inquiry.reviewNotes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
