"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { SupportTicketRecord, adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass } from "@/modules/shared/ui/buttonStyles";
import { MetricStrip } from "@/modules/shared/ui/Panel";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";

type SupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SupportPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | SupportStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | SupportPriority>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSupportTickets({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        priority: priorityFilter === "ALL" ? undefined : priorityFilter,
        limit: 100,
      });

      if (response.success && response.data) {
        setTickets(response.data);
      } else {
        toast.error(response.message || "Failed to load support tickets.");
      }
    } catch (error) {
      console.error("Failed to load support tickets:", error);
      toast.error("Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleStatusUpdate = async (ticketId: string, status: SupportStatus) => {
    try {
      await adminApi.updateSupportTicket(ticketId, { status });
      toast.success("Support ticket updated.");
      await loadTickets();
    } catch (error) {
      console.error("Failed to update support ticket:", error);
      toast.error("Unable to update support ticket.");
    }
  };

  const visibleTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return tickets;
    }

    return tickets.filter((ticket) => {
      const haystack = [
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.userId?.name,
        ticket.userId?.email,
        ticket.requesterName,
        ticket.requesterEmail,
        ticket.requesterPhone,
        ticket.requesterType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, tickets]);

  const stats = useMemo(() => {
    const open = visibleTickets.filter((ticket) => ticket.status === "OPEN").length;
    const inProgress = visibleTickets.filter((ticket) => ticket.status === "IN_PROGRESS").length;
    const urgent = visibleTickets.filter(
      (ticket) => ticket.priority === "URGENT" || ticket.priority === "HIGH"
    ).length;

    return {
      total: visibleTickets.length,
      open,
      inProgress,
      urgent,
    };
  }, [visibleTickets]);

  const statusTone = {
    OPEN: "amber",
    IN_PROGRESS: "blue",
    RESOLVED: "green",
    CLOSED: "slate",
  } as const;
  const priorityTone = { LOW: "slate", MEDIUM: "blue", HIGH: "orange", URGENT: "red" } as const;

  const quickActions: Array<{ label: string; value: SupportStatus }> = [
    { label: "Open", value: "OPEN" },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "Resolved", value: "RESOLVED" },
    { label: "Closed", value: "CLOSED" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Trust & Support"
        title="Support tickets"
        subtitle="User issues, academy onboarding requests and urgent escalations in one queue."
      />

      <MetricStrip
        items={[
          { label: "Showing", value: String(stats.total) },
          { label: "Open", value: String(stats.open) },
          { label: "In progress", value: String(stats.inProgress) },
          { label: "Urgent or high", value: String(stats.urgent) },
        ]}
      />

      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_0.7fr_0.7fr_auto]">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tickets, users, emails or categories"
              aria-label="Search tickets"
              className={`${fieldClass} pl-9`}
            />
          </div>

          <select
            value={statusFilter}
            aria-label="Filter by status"
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className={fieldClass}
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priorityFilter}
            aria-label="Filter by priority"
            onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
            className={fieldClass}
          >
            <option value="ALL">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <button type="button" onClick={loadTickets} className={btn("outline")}>
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>

        {loading ? (
          <SkeletonBlock rows={6} label="Loading support tickets" />
        ) : visibleTickets.length === 0 ? (
          <EmptyState
            title="No tickets match"
            description="Change the status, priority or search to see more."
          />
        ) : (
          <div className="space-y-4">
            {visibleTickets.map((ticket) => (
              <div key={ticket._id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{ticket.subject}</h3>
                      <StatusBadge
                        status={ticket.status}
                        tone={statusTone[ticket.status]}
                        size="sm"
                      />
                      <StatusBadge
                        status={ticket.priority}
                        tone={priorityTone[ticket.priority]}
                        dot={false}
                        size="sm"
                      />
                    </div>

                    <p className="max-w-3xl text-sm leading-6 text-slate-600">
                      {ticket.description}
                    </p>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                      <span>
                        {ticket.userId?.name || ticket.requesterName || "Anonymous"} (
                        {ticket.userId?.email || ticket.requesterEmail || "N/A"})
                      </span>
                      <span>Category: {ticket.category}</span>
                      {ticket.requesterType && (
                        <span>Type: {ticket.requesterType.replace("_", " ")}</span>
                      )}
                      {ticket.requesterPhone && <span>Phone: {ticket.requesterPhone}</span>}
                      {ticket.assignedAdminId?.name && (
                        <span>Assigned to: {ticket.assignedAdminId.name}</span>
                      )}
                      <span>Updated {formatDate(ticket.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-500">
                    <p>Created {formatDate(ticket.createdAt)}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <span className="mr-1 text-sm text-slate-500">Set status</span>
                  {quickActions.map((action) => {
                    const isActive = ticket.status === action.value;
                    return (
                      <button
                        key={action.value}
                        type="button"
                        onClick={() => handleStatusUpdate(ticket._id, action.value)}
                        aria-pressed={isActive}
                        className={`${btn(isActive ? "primary" : "outline", "sm")}`}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
