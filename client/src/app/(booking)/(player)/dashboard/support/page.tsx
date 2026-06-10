"use client";

import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { Modal } from "@/modules/shared/ui/Modal";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import axiosInstance from "@/lib/api/axios";
import {
  LifeBuoy,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

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
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_STYLES: Record<SupportTicket["priority"], string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  URGENT: "bg-red-50 text-red-700 border-red-200",
};

const PRIORITY_STRIPE: Record<SupportTicket["priority"], string> = {
  LOW: "bg-slate-300",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-500",
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
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;

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
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            icon={<Plus size={16} />}
          >
            New Ticket
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {tickets.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Open / In Progress
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{openCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Resolved
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {resolvedCount}
          </p>
        </div>
      </div>

      <Card className="shop-surface premium-shadow overflow-hidden p-0">
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
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket._id}
                  className="flex overflow-hidden rounded-xl border border-slate-200/70"
                >
                  {/* Priority-colored left stripe */}
                  <div
                    className={`w-1 shrink-0 ${PRIORITY_STRIPE[ticket.priority]}`}
                  />
                  <div className="flex flex-1 flex-col gap-3 bg-slate-50/40 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {ticket.subject}
                        </h3>
                        <Badge
                          className={`border text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}
                        >
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        <Badge
                          className={`border text-xs font-medium ${PRIORITY_STYLES[ticket.priority]}`}
                        >
                          {ticket.priority}
                        </Badge>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                        {ticket.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ticket.createdAt).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {ticket.category}
                        </span>
                      </div>

                      {ticket.notes && ticket.notes.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-slate-200/60 pt-4">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Updates
                          </p>
                          {ticket.notes.map((note, i) => (
                            <div
                              key={i}
                              className={`rounded-lg px-3 py-2.5 text-sm ${
                                note.authorType === "ADMIN"
                                  ? "border border-blue-200 bg-blue-50 text-blue-900"
                                  : "border border-slate-200 bg-white text-slate-700"
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
                      {ticket.status === "RESOLVED" ||
                      ticket.status === "CLOSED" ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              onChange={(e) =>
                setForm((prev) => ({ ...prev, subject: e.target.value }))
              }
              placeholder="Brief summary of your issue"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe your issue in detail"
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange/20"
              >
                <option value="BOOKING">Booking</option>
                <option value="PAYMENT">Payment</option>
                <option value="ACCOUNT">Account</option>
                <option value="TECHNICAL">Technical</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange/20"
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
