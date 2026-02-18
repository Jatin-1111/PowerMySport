"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import {
  VenueInquiry,
  venueInquiryApi,
} from "@/modules/venue-inquiry/services/venueInquiry";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

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
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Venue Inquiries"
        subtitle="Review and approve venue listing requests from potential partners."
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
              filter === status
                ? "bg-power-orange text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-700 hover:border-power-orange hover:text-power-orange"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Inquiries List */}
      {inquiries.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              No {filter.toLowerCase()} inquiries
            </div>
            <p className="max-w-md text-slate-600">
              {filter === "PENDING"
                ? "New venue inquiries will appear here for review."
                : `No ${filter.toLowerCase()} inquiries to display.`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <Card
              key={inquiry.id}
              className="bg-white hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">
                    {inquiry.venueName}
                  </h3>
                  <p className="text-sm text-slate-600 flex items-center gap-1">
                    <MapPin size={16} />
                    {inquiry.address}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    inquiry.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                      : inquiry.status === "APPROVED"
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : "bg-red-100 text-red-700 border border-red-300"
                  }`}
                >
                  {inquiry.status}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-slate-600">Owner</p>
                  <p className="font-semibold text-slate-900">
                    {inquiry.ownerName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Contact</p>
                  <p className="font-semibold text-slate-900">
                    {inquiry.phone}
                  </p>
                  <p className="text-xs text-slate-600">
                    Email will be: venue_{inquiry.phone.replace(/\s+/g, "")}
                    @powermysport.com
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Sports</p>
                  <p className="font-semibold text-slate-900">
                    {inquiry.sports}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Submitted</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(inquiry.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {inquiry.message && (
                <div className="mb-4">
                  <p className="text-sm text-slate-600">Message</p>
                  <p className="text-sm bg-slate-50 p-3 rounded border border-slate-200 text-slate-900">
                    {inquiry.message}
                  </p>
                </div>
              )}

              {/* Review Section */}
              {inquiry.status === "PENDING" && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  {selectedInquiry?.id === inquiry.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add review notes (optional)..."
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleReview(inquiry.id, "APPROVED")}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isProcessing ? "Processing..." : "? Approve"}
                        </Button>
                        <Button
                          onClick={() => handleReview(inquiry.id, "REJECTED")}
                          disabled={isProcessing}
                          variant="danger"
                        >
                          ? Reject
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedInquiry(null);
                            setReviewNotes("");
                          }}
                          variant="secondary"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setSelectedInquiry(inquiry)}
                      variant="primary"
                    >
                      Review Inquiry
                    </Button>
                  )}
                </div>
              )}

              {inquiry.reviewNotes && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <p className="text-sm text-slate-600">Review Notes</p>
                  <p className="text-sm bg-slate-50 p-3 rounded border border-slate-200 text-slate-900">
                    {inquiry.reviewNotes}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
