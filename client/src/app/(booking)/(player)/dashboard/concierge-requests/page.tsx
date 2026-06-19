"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/api/axios";
import { format } from "date-fns";
import { Loader2, CheckCircle2, Clock, XCircle, AlertCircle, FileText } from "lucide-react";

export default function ConciergeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axiosInstance.get("/api/concierge/requests");
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
        };
      case "processing":
        return {
          icon: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
          color: "bg-blue-50 text-blue-700 border-blue-200",
          text: "Processing",
        };
      case "completed":
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
          color: "bg-emerald-50 text-emerald-700 border-emerald-200",
          text: "Completed",
        };
      case "rejected":
        return {
          icon: <XCircle className="h-5 w-5 text-rose-500" />,
          color: "bg-rose-50 text-rose-700 border-rose-200",
          text: "Rejected",
        };
      default:
        return {
          icon: <AlertCircle className="h-5 w-5 text-slate-500" />,
          color: "bg-slate-50 text-slate-700 border-slate-200",
          text: "Unknown",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-power-orange" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Concierge Requests
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track the status of your document uploads and application requests.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No requests yet</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            You haven't submitted any concierge requests. Explore the AI Pathways to discover tournaments and scholarships!
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const statusConfig = getStatusConfig(request.status);
            return (
              <div
                key={request._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {request.sportSlug} • {request.itemType || "Tournament"}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(request.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {request.prerequisiteName}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-1">
                    For: {request.itemName || request.tournamentName}
                  </p>
                  {request.documents && request.documents.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.documents.map((doc: any, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                          {doc.documentName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${statusConfig.color}`}
                  >
                    {statusConfig.icon}
                    {statusConfig.text}
                  </div>
                  {request.status === "completed" && (
                    <button className="text-sm font-bold text-power-orange hover:text-orange-700 transition-colors">
                      View Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
