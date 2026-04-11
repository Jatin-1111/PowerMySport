"use client";

import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Modal } from "@/modules/shared/ui/Modal";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import axiosInstance from "@/lib/api/axios";
import { LifeBuoy, Plus, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface SupportTicket {
  _id: string;
  subject: string;
  description: string;
  category: "BOOKING" | "PAYMENT" | "ACCOUNT" | "TECHNICAL" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  notes?: Array<{
    authorType: "USER" | "ADMIN";
    message: string;
    createdAt: string;
  }>;
}

const STATUS_STYLES: Record<SupportTicket["status"], string> = {
  OPEN: "bg-blue-100 text-blue-700 border border-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border border-amber-300",
  RESOLVED: "bg-green-100 text-green-700 border border-green-300",
  CLOSED: "bg-slate-100 text-slate-600 border border-slate-300",
};

const PRIORITY_STYLES: Record<SupportTicket["priority"], string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "OTHER" as SupportTicket["category"],
    priority: "MEDIUM" as SupportTicket["priority"],
  });

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get<{
        success: boolean;
        data: SupportTicket[];
        pagination?: { total: number; page: number; totalPages: number };
      }>("/support-tickets/my");
      if (response.data.success) {
        setTickets(response.data.data);
      }
    } catch {
      toast.error("Failed to load support tickets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Subject and description are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await axiosInstance.post<{
        success: boolean;
        data: SupportTicket;
      }>("/support-tickets", form);

      if (response.data.success) {
        setTickets((prev) => [response.data.data, ...prev]);
        setIsCreateOpen(false);
        setForm({
          subject: "",
          description: "",
          category: "OTHER",
          priority: "MEDIUM",
        });
        toast.success("Support ticket created successfully");
      }
    } catch {
      toast.error("Failed to create support ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Support Tickets" },
          ]}
        />
        <PlayerPageHeader
          badge="Player"
          title="Support Tickets"
          subtitle="Get help with bookings, payments, and account issues."
        />
        <ListSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Support Tickets" },
        ]}
      />

      <PlayerPageHeader
        badge="Player"
        title="Support Tickets"
        subtitle="Get help with bookings, payments, and account issues."
        action={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        }
      />

      {tickets.length === 0 ? (
        <Card className="shop-surface premium-shadow">
          <EmptyState
            icon={LifeBuoy}
            title="No support tickets"
            description="Need help? Submit a support ticket and our team will get back to you."
            actionLabel="Create Ticket"
            onAction={() => setIsCreateOpen(true)}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket._id} className="shop-surface premium-shadow">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {ticket.subject}
                    </h3>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[ticket.priority]}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                    {ticket.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(ticket.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium">
                      {ticket.category}
                    </span>
                  </div>
                  {ticket.notes && ticket.notes.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Updates
                      </p>
                      {ticket.notes.map((note, i) => (
                        <div
                          key={i}
                          className={`rounded-lg px-3 py-2 text-sm ${
                            note.authorType === "ADMIN"
                              ? "border border-blue-200 bg-blue-50 text-blue-900"
                              : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="text-xs font-semibold">
                            {note.authorType === "ADMIN"
                              ? "Support team"
                              : "You"}
                          </span>
                          <p className="mt-0.5">{note.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1 self-start">
                  {ticket.status === "RESOLVED" ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Support Ticket"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              value={form.subject}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, subject: e.target.value }))
              }
              placeholder="Brief summary of your issue"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe your issue in detail"
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value as SupportTicket["category"],
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
              >
                <option value="BOOKING">Booking</option>
                <option value="PAYMENT">Payment</option>
                <option value="ACCOUNT">Account</option>
                <option value="TECHNICAL">Technical</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: e.target.value as SupportTicket["priority"],
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
