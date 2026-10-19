"use client";

import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { StatStrip } from "@/modules/player/components/StatStrip";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Modal } from "@/modules/shared/ui/Modal";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import { LifeBuoy, MessageSquare, Plus } from "lucide-react";
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
    authorType: "USER" | "Admin";
    message: string;
    createdAt: string;
  }>;
}

const STATUS_TEXT: Record<SupportTicket["status"], string> = {
  OPEN: "text-ink",
  IN_PROGRESS: "text-amber-700",
  RESOLVED: "text-green-700",
  CLOSED: "text-ink-muted",
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

  // Stats
  const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter(
    (t) => t.status === "RESOLVED" || t.status === "CLOSED"
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Support Tickets" }]}
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
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Support Tickets" }]}
      />

      <PlayerPageHeader
        badge="Player"
        title="Support Tickets"
        subtitle="Get help with bookings, payments, and account issues."
        action={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)} icon={<Plus size={16} />}>
            New Ticket
          </Button>
        }
      />

      <StatStrip
        stats={[
          { label: "Total", value: tickets.length },
          { label: "Open or in progress", value: openCount },
          { label: "Resolved", value: resolvedCount },
        ]}
      />

      <Card className="overflow-hidden p-0">
        <ProfileSectionHeader
          icon={LifeBuoy}
          title="Your Tickets"
          description="Track all your support requests and their current status."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              icon={<Plus size={14} />}
            >
              New Ticket
            </Button>
          }
        />
        <CardContent className="px-6 py-5">
          {tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="No support tickets"
              description="Need help? Submit a support ticket and our team will get back to you."
              actionLabel="Create Ticket"
              onAction={() => setIsCreateOpen(true)}
            />
          ) : (
            <ul className="border-hairline divide-hairline divide-y border-y">
              {tickets.map((ticket) => (
                <li key={ticket._id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-ink text-lg font-medium">{ticket.subject}</h3>
                    <p className="text-sm font-medium">
                      <span className={STATUS_TEXT[ticket.status]}>
                        {ticket.status
                          .replace("_", " ")
                          .toLowerCase()
                          .replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      {(ticket.priority === "HIGH" || ticket.priority === "URGENT") && (
                        <span className="text-red-700">
                          {" · "}
                          {ticket.priority === "URGENT" ? "Urgent" : "High priority"}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-ink-muted mt-1 text-sm">
                    {new Date(ticket.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}
                    {ticket.category}
                  </p>
                  <p className="text-ink-body mt-2 line-clamp-2 max-w-3xl text-sm">
                    {ticket.description}
                  </p>

                  {ticket.notes && ticket.notes.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-ink-muted flex items-center gap-1.5 text-sm">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        Updates
                      </p>
                      {ticket.notes.map((note, i) => (
                        <div
                          key={i}
                          className={`border-l-2 pl-4 text-sm ${
                            note.authorType === "Admin" ? "border-ink" : "border-hairline"
                          }`}
                        >
                          <span className="text-ink-muted text-xs">
                            {note.authorType === "Admin" ? "Support team" : "You"}
                          </span>
                          <p className="text-ink mt-0.5">{note.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Support Ticket"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Brief summary of your issue"
              className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-1"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your issue in detail"
              rows={4}
              className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value as SupportTicket["category"],
                  }))
                }
                className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1"
              >
                <option value="BOOKING">Booking</option>
                <option value="PAYMENT">Payment</option>
                <option value="ACCOUNT">Account</option>
                <option value="TECHNICAL">Technical</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Priority</label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: e.target.value as SupportTicket["priority"],
                  }))
                }
                className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
