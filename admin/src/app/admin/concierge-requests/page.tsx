"use client";

import { useEffect, useState } from "react";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { conciergeApi, ConciergeRequest } from "@/lib/api/conciergeApi";
import { format } from "date-fns";
import { Download, FileText, CheckCircle, XCircle, Clock, Search, Loader2 } from "lucide-react";

export default function ConciergeRequestsAdminPage() {
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await conciergeApi.getAllRequests();
      setRequests(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch concierge requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleStatusChange = async (
    id: string,
    newStatus: "pending" | "processing" | "completed" | "rejected",
  ) => {
    try {
      const updated = await conciergeApi.updateStatus(id, newStatus);
      setRequests((prev) =>
        prev.map((req) => (req._id === id ? { ...req, status: updated.status } : req)),
      );
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleDownload = async (requestId: string, s3Key: string, fileName: string) => {
    try {
      const url = await conciergeApi.getDocumentDownloadUrl(requestId, s3Key);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Failed to get document download URL");
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      r.userId?.name.toLowerCase().includes(search.toLowerCase()) ||
      r.sportSlug.toLowerCase().includes(search.toLowerCase()) ||
      r.itemName?.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle size={14} /> Completed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
            <Loader2 size={14} className="animate-spin" /> Processing
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
            <XCircle size={14} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
            <Clock size={14} /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Concierge Requests
          </h1>
          <p className="text-sm text-slate-500">
            Review and manage user document submissions and concierge requests.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by user or sport..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="flex h-48 items-center justify-center text-red-500">{error}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <FileText size={48} className="mb-4 text-slate-300" />
            <p>No concierge requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">User Details</th>
                  <th className="px-6 py-4 font-semibold">Request Info</th>
                  <th className="px-6 py-4 font-semibold">Documents</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Submitted</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRequests.map((req) => (
                  <tr key={req._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{req.userId?.name || "Unknown"}</p>
                      <p className="text-xs text-slate-500">{req.userId?.email || "N/A"}</p>
                      <p className="text-xs text-slate-500">{req.userId?.phone || "N/A"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 capitalize">{req.sportSlug}</p>
                      <p className="text-xs text-slate-600">
                        <span className="font-medium text-slate-700 capitalize">{req.itemType}:</span>{" "}
                        {req.itemName || "General Request"}
                      </p>
                      <p className="text-xs text-slate-500">For: {req.prerequisiteName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {req.documents.map((doc, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleDownload(req._id, doc.s3Key, doc.documentName)}
                            className="flex w-fit items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Download size={14} />
                            <span className="max-w-[120px] truncate">{doc.documentName}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {format(new Date(req.createdAt), "MMM d, yyyy h:mm a")}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        value={req.status}
                        onChange={(e) =>
                          handleStatusChange(req._id, e.target.value as any)
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
