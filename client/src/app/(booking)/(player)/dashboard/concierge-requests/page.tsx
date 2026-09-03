"use client";

import axiosInstance from "@/lib/api/axios";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function ConciergeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axiosInstance.get("/concierge/requests");
      setRequests(res.data.requests || []);
    } catch (error) {
      console.error("Failed to fetch concierge requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          icon: <Clock className="h-5 w-5 text-amber-500" />,
          color: "bg-amber-50 text-amber-700 border-amber-200",
          text: "Pending Review",
          detail: "Our team has received your documents and will begin processing shortly.",
        };
      case "processing":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />,
          color: "bg-indigo-50 text-indigo-700 border-indigo-200",
          text: "Processing",
          detail:
            "Your documents are currently being reviewed. We'll update you as soon as there's progress.",
        };
      case "completed":
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
          color: "bg-emerald-50 text-emerald-700 border-emerald-200",
          text: "Completed",
          detail: "Your request has been successfully processed.",
        };
      case "rejected":
        return {
          icon: <XCircle className="h-5 w-5 text-rose-500" />,
          color: "bg-rose-50 text-rose-700 border-rose-200",
          text: "Rejected",
          detail:
            "Unfortunately we were unable to process this request. See the team's note below for details.",
        };
      default:
        return {
          icon: <AlertCircle className="h-5 w-5 text-slate-500" />,
          color: "bg-slate-50 text-slate-700 border-slate-200",
          text: "Unknown",
          detail: "",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="text-power-orange h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Concierge Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track the status of your document submissions. Our team's responses will appear here.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No requests yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            You haven't submitted any concierge requests. Explore the Sports Pathway to discover
            tournaments to register for.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const statusConfig = getStatusConfig(request.status);
            const isOpen = expanded === request._id;

            return (
              <div
                key={request._id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : request._id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50/50"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {request.sportSlug} · {request.itemType || "Tournament"}
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(request.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {request.prerequisiteName || request.itemName || "Registration Request"}
                    </h3>
                    {(request.itemName || request.tournamentName) && (
                      <p className="text-sm text-slate-500">
                        For: {request.itemName || request.tournamentName}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${statusConfig.color}`}
                    >
                      {statusConfig.icon}
                      {statusConfig.text}
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="space-y-4 border-t border-slate-100 bg-slate-50/30 px-5 py-4">
                    {/* Status explanation */}
                    <div
                      className={`flex items-start gap-2.5 rounded-xl border p-3 ${statusConfig.color}`}
                    >
                      {statusConfig.icon}
                      <p className="text-sm">{statusConfig.detail}</p>
                    </div>

                    {/* Admin notes — the most important thing */}
                    {request.adminNotes && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <MessageSquare className="h-3 w-3" /> Message from PowerMySport Team
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
                          {request.adminNotes}
                        </p>
                      </div>
                    )}

                    {/* Documents submitted */}
                    {request.documents && request.documents.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Documents Submitted
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {request.documents.map((doc: any, i: number) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                              {doc.documentName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed CTA — go discover next tournaments */}
                    {request.status === "completed" && (
                      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                        <div className="flex items-start gap-2.5">
                          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-emerald-800">What's Next?</h4>
                            <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                              Now that your prerequisite is sorted, explore the Sports Pathway to
                              discover tournaments your child can now register for.
                            </p>
                            <a
                              href="/roadmap"
                              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                            >
                              <Trophy className="h-3.5 w-3.5" />
                              Explore Tournaments
                              <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rejected CTA */}
                    {request.status === "rejected" && !request.adminNotes && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          Please contact us at{" "}
                          <a
                            href="mailto:teams@powermysport.com"
                            className="text-power-orange font-bold hover:underline"
                          >
                            teams@powermysport.com
                          </a>{" "}
                          for more information on why this request was rejected.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
