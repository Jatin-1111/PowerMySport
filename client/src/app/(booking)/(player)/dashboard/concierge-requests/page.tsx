"use client";

import axiosInstance from "@/lib/api/axios";
import { format } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
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
          text: "Pending review",
          tone: "text-amber-700",
          detail: "Our team has received your documents and will begin processing shortly.",
        };
      case "processing":
        return {
          text: "Processing",
          tone: "text-ink",
          detail:
            "Your documents are currently being reviewed. We'll update you as soon as there's progress.",
        };
      case "completed":
        return {
          text: "Completed",
          tone: "text-green-700",
          detail: "Your request has been successfully processed.",
        };
      case "rejected":
        return {
          text: "Rejected",
          tone: "text-red-700",
          detail:
            "Unfortunately we were unable to process this request. See the team's note below for details.",
        };
      default:
        return { text: "Unknown", tone: "text-ink-muted", detail: "" };
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="text-ink-muted h-8 w-8 animate-spin" aria-label="Loading requests" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Concierge requests" }]}
      />

      <PlayerPageHeader
        title="Concierge requests"
        subtitle="Track the status of your document submissions. Our team's responses will appear here."
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No requests yet"
          description="You haven't submitted any concierge requests. Explore the Sports Pathway to discover tournaments to register for."
        />
      ) : (
        <ul className="border-hairline divide-hairline divide-y border-y">
          {requests.map((request) => {
            const statusConfig = getStatusConfig(request.status);
            const isOpen = expanded === request._id;

            return (
              <li key={request._id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : request._id)}
                  aria-expanded={isOpen}
                  className="hover:bg-paper-deep/60 focus-visible:ring-ink flex w-full items-center gap-4 px-2 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-ink-muted text-sm capitalize">
                      {request.sportSlug} · {request.itemType || "Tournament"} ·{" "}
                      {format(new Date(request.createdAt), "MMM d, yyyy")}
                    </p>
                    <h3 className="text-ink text-lg font-medium">
                      {request.prerequisiteName || request.itemName || "Registration request"}
                    </h3>
                    {(request.itemName || request.tournamentName) && (
                      <p className="text-ink-muted text-sm">
                        For {request.itemName || request.tournamentName}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-sm font-medium ${statusConfig.tone}`}>
                      {statusConfig.text}
                    </span>
                    <ChevronDown
                      className={`text-ink-muted h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-5 px-2 pb-6">
                    {statusConfig.detail && (
                      <p className="text-ink-body max-w-2xl text-pretty">{statusConfig.detail}</p>
                    )}

                    {request.adminNotes && (
                      <div className="border-ink border-l-2 pl-4">
                        <p className="text-ink-muted mb-1 flex items-center gap-1.5 text-sm">
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          Message from the PowerMySport team
                        </p>
                        <p className="text-ink whitespace-pre-line leading-relaxed">
                          {request.adminNotes}
                        </p>
                      </div>
                    )}

                    {request.documents && request.documents.length > 0 && (
                      <div>
                        <p className="text-ink-muted mb-2 text-sm">Documents submitted</p>
                        <ul className="space-y-1.5">
                          {request.documents.map((doc: any, i: number) => (
                            <li key={i} className="text-ink flex items-center gap-2 text-sm">
                              <CheckCircle2
                                className="h-4 w-4 shrink-0 text-green-700"
                                aria-hidden="true"
                              />
                              {doc.documentName}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {request.status === "completed" && (
                      <div className="bg-paper-deep rounded-xl p-5">
                        <h4 className="font-editorial text-ink text-xl font-light">What's next</h4>
                        <p className="text-ink-body mt-1 max-w-xl text-sm leading-relaxed">
                          Now that your prerequisite is sorted, explore the Sports Pathway to
                          discover tournaments your child can now register for.
                        </p>
                        <a
                          href="/roadmap"
                          className="text-ink mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
                        >
                          Explore tournaments
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    )}

                    {request.status === "rejected" && !request.adminNotes && (
                      <p className="text-ink-body text-sm">
                        Please contact us at{" "}
                        <a
                          href="mailto:teams@powermysport.com"
                          className="text-ink font-semibold underline underline-offset-4"
                        >
                          teams@powermysport.com
                        </a>{" "}
                        for more information on why this request was rejected.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
