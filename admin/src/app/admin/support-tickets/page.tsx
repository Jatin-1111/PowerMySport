"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { SupportTicketRecord, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { AlertTriangle, Clock3, MessageSquare, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

  const statusBadgeClasses: Record<SupportStatus, string> = {
    OPEN: "border-amber-200 bg-amber-50 text-amber-700",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
    RESOLVED: "border-green-200 bg-green-50 text-green-700",
    CLOSED: "border-slate-200 bg-slate-100 text-slate-600",
  };

  const priorityBadgeClasses: Record<SupportPriority, string> = {
    LOW: "border-slate-200 bg-slate-100 text-slate-600",
    MEDIUM: "border-blue-200 bg-blue-50 text-blue-700",
    HIGH: "border-orange-200 bg-orange-50 text-orange-700",
    URGENT: "border-red-200 bg-red-50 text-red-700",
  };

  const quickActions: Array<{ label: string; value: SupportStatus }> = [
    { label: "Open", value: "OPEN" },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "Resolved", value: "RESOLVED" },
    { label: "Closed", value: "CLOSED" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Support Tickets"
        subtitle="Triage user issues, academy onboarding requests, and high-priority escalations from one view."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white">
          <p className="text-sm text-slate-600">Showing</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
        </Card>
        <Card className="bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Open</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">{stats.open}</p>
            </div>
            <MessageSquare className="text-amber-500" size={18} />
          </div>
        </Card>
        <Card className="bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">In progress</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            <Clock3 className="text-blue-500" size={18} />
          </div>
        </Card>
        <Card className="bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Urgent / High</p>
              <p className="mt-2 text-3xl font-bold text-red-600">{stats.urgent}</p>
            </div>
            <AlertTriangle className="text-red-500" size={18} />
          </div>
        </Card>
      </div>

      <Card className="space-y-4 bg-white">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_0.7fr_0.7fr_auto]">
          <label className="focus-within:border-power-orange flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
            <Search size={18} className="text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tickets, users, emails, or categories"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="focus:border-power-orange rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition"
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
            className="focus:border-power-orange rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition"
          >
            <option value="ALL">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <button
            type="button"
            onClick={loadTickets}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading support tickets...</div>
        ) : visibleTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
            No support tickets match the current filters.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTickets.map((ticket) => (
              <div
                key={ticket._id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{ticket.subject}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses[ticket.status]}`}
                      >
                        {ticket.status.replace("_", " ")}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityBadgeClasses[ticket.priority]}`}
                      >
                        {ticket.priority}
                      </span>
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

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                  {quickActions.map((action) => {
                    const isActive = ticket.status === action.value;
                    return (
                      <button
                        key={action.value}
                        type="button"
                        onClick={() => handleStatusUpdate(ticket._id, action.value)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
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
      </Card>
    </div>
  );
}
