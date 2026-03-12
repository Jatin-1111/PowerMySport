"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { SupportTicketRecord, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
  >("ALL");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSupportTickets({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 100,
      });

      if (response.success && response.data) {
        setTickets(response.data);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleStatusUpdate = async (
    ticketId: string,
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
  ) => {
    await adminApi.updateSupportTicket(ticketId, { status });
    await loadTickets();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Support Tickets"
        subtitle="Track user issues, assign handling states, and close support loops."
      />

      <Card className="bg-white space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Filter:</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Loading support tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No support tickets found.
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket._id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {ticket.subject}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {ticket.description}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {ticket.userId?.name} ({ticket.userId?.email}) •{" "}
                      {ticket.category} • {ticket.priority}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {ticket.status}
                    </span>
                    <select
                      value={ticket.status}
                      onChange={(event) =>
                        handleStatusUpdate(
                          ticket._id,
                          event.target.value as
                            | "OPEN"
                            | "IN_PROGRESS"
                            | "RESOLVED"
                            | "CLOSED",
                        )
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
