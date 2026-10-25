"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { Button } from "@/modules/shared/ui/Button";
import { DetailDrawer, DetailRow, DetailSection } from "@/modules/shared/ui/DetailDrawer";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { toast } from "@/lib/toast";
import {
  EnquiryFilters,
  EnquiryList,
  FollowUpStatus,
  WhatsAppEnquiry,
  whatsappPilotApi,
} from "@/lib/api/whatsappPilotApi";

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const ASSISTANCE_LABEL: Record<string, string> = {
  coach: "Coach or academy",
  tournaments: "Tournaments",
  expert: "Expert",
  team: "Team",
  other: "Other",
};

const FOLLOW_UP_LABEL: Record<FollowUpStatus, string> = {
  none: "None",
  new: "Waiting",
  contacted: "Contacted",
  done: "Done",
};

const FOLLOW_UP_TONE: Record<FollowUpStatus, "slate" | "amber" | "blue" | "green"> = {
  none: "slate",
  new: "amber",
  contacted: "blue",
  done: "green",
};

const FEEDBACK_LABEL = { helpful: "Helpful", not_helpful: "Not helpful" } as const;

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-400 focus:border-power-orange-solid focus:outline-none focus:ring-2 focus:ring-power-orange-solid/25";

const when = (iso: string) => format(new Date(iso), "MMM d, h:mm a");

/** WhatsApp lets a business message freely for 24 hours after the parent's last message. */
const WINDOW_MS = 24 * 60 * 60 * 1000;
const replyWindowEnd = (lastMessageAt: string) =>
  new Date(new Date(lastMessageAt).getTime() + WINDOW_MS).toISOString();
const replyWindowOpen = (lastMessageAt: string) =>
  Date.now() < new Date(lastMessageAt).getTime() + WINDOW_MS;

const child = (e: WhatsAppEnquiry) =>
  [e.childAge ? `${e.childAge} yrs` : null, e.sport, e.level].filter(Boolean).join(", ") || "—";

export function EnquiriesTab() {
  const [filters, setFilters] = useState<EnquiryFilters>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<EnquiryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // The search box waits for a pause in typing, so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, q: search.trim() || undefined }));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Bumped after a save, so the list refetches and shows the change.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(async () => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    whatsappPilotApi
      .listEnquiries(filters, page)
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(errorMessage(err, "Could not load the enquiries."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadKey]);

  const setFilter = (key: keyof EnquiryFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await whatsappPilotApi.exportEnquiries(filters);
    } catch (err) {
      toast.error(errorMessage(err, "Could not export the enquiries."));
    } finally {
      setExporting(false);
    }
  };

  const columns: AdminDataTableColumn<WhatsAppEnquiry>[] = [
    {
      key: "date",
      header: "Last message",
      render: (e) => (
        <span className="whitespace-nowrap text-slate-600">{when(e.lastMessageAt)}</span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      render: (e) => <span className="font-mono text-xs text-slate-700">{e.reference}</span>,
    },
    {
      key: "question",
      header: "Question",
      className: "min-w-[16rem]",
      render: (e) => <span className="line-clamp-2 text-slate-900">{e.question}</span>,
    },
    {
      key: "child",
      header: "Child",
      render: (e) => <span className="text-slate-700">{child(e)}</span>,
    },
    {
      key: "assistance",
      header: "Help asked",
      render: (e) => (
        <span className="text-slate-700">
          {e.assistance.length ? e.assistance.map((a) => ASSISTANCE_LABEL[a] ?? a).join(", ") : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Follow-up",
      render: (e) =>
        e.followUpStatus === "none" ? (
          <span className="text-slate-500">—</span>
        ) : (
          <StatusBadge
            status={FOLLOW_UP_LABEL[e.followUpStatus]}
            tone={FOLLOW_UP_TONE[e.followUpStatus]}
            size="sm"
          />
        ),
    },
    {
      key: "feedback",
      header: "Feedback",
      render: (e) => (
        <span className="text-slate-700">{e.feedback ? FEEDBACK_LABEL[e.feedback] : "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Follow-up status"
          className={selectClass}
          value={filters.status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Any follow-up</option>
          <option value="new">Waiting for the team</option>
          <option value="contacted">Contacted</option>
          <option value="done">Done</option>
          <option value="none">No follow-up</option>
        </select>
        <select
          aria-label="Help asked for"
          className={selectClass}
          value={filters.assistance ?? ""}
          onChange={(e) => setFilter("assistance", e.target.value)}
        >
          <option value="">Any help asked</option>
          {Object.entries(ASSISTANCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Feedback"
          className={selectClass}
          value={filters.feedback ?? ""}
          onChange={(e) => setFilter("feedback", e.target.value)}
        >
          <option value="">Any feedback</option>
          <option value="helpful">Helpful</option>
          <option value="not_helpful">Not helpful</option>
        </select>
        <input
          aria-label="Sport"
          className={`${selectClass} w-36`}
          placeholder="Sport"
          value={filters.sport ?? ""}
          onChange={(e) => setFilter("sport", e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          From
          <input
            type="date"
            className={selectClass}
            value={filters.from ?? ""}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          To
          <input
            type="date"
            className={selectClass}
            value={filters.to ?? ""}
            onChange={(e) => setFilter("to", e.target.value ? `${e.target.value}T23:59:59` : "")}
          />
        </label>
      </div>

      <AdminDataTable
        columns={columns}
        rows={list?.rows ?? []}
        getRowKey={(e) => e.id}
        loading={loading}
        emptyMessage="No enquiries match these filters"
        search={{ value: search, onChange: setSearch, placeholder: "Search the question" }}
        toolbarExtra={
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            loading={exporting}
            disabled={!list || list.total === 0}
            onClick={handleExport}
          >
            Export CSV{list ? ` (${list.total})` : ""}
          </Button>
        }
        pagination={
          list
            ? {
                page: list.page,
                totalPages: list.totalPages,
                total: list.total,
                onPageChange: setPage,
              }
            : undefined
        }
        onRowClick={(e) => setOpenId(e.id)}
      />

      <EnquiryDrawer
        key={openId ?? "closed"}
        enquiry={list?.rows.find((e) => e.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onChanged={reload}
      />
    </div>
  );
}

function EnquiryDrawer({
  enquiry,
  onClose,
  onChanged,
}: {
  enquiry: WhatsAppEnquiry | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  // The drawer is keyed by enquiry, so each one starts with its own note and a hidden number.
  const [note, setNote] = useState(enquiry?.teamNote ?? "");
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const savedNote = enquiry?.teamNote ?? "";

  if (!enquiry) return null;

  const save = async (changes: { followUpStatus?: FollowUpStatus; teamNote?: string }) => {
    setSaving(true);
    try {
      await whatsappPilotApi.updateEnquiry(enquiry.id, changes);
      await onChanged();
      toast.success("Saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save that."));
    } finally {
      setSaving(false);
    }
  };

  const reveal = async () => {
    setRevealing(true);
    try {
      setPhone(await whatsappPilotApi.revealContact(enquiry.id));
    } catch (err) {
      toast.error(errorMessage(err, "Could not show the number."));
    } finally {
      setRevealing(false);
    }
  };

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={<span className="font-mono">{enquiry.reference}</span>}
      subtitle={`Parent ${enquiry.parentRef} · started ${when(enquiry.createdAt)} · ${enquiry.turnCount} ${
        enquiry.turnCount === 1 ? "message" : "messages"
      }`}
      headerExtra={
        enquiry.followUpStatus !== "none" ? (
          <StatusBadge
            status={FOLLOW_UP_LABEL[enquiry.followUpStatus]}
            tone={FOLLOW_UP_TONE[enquiry.followUpStatus]}
            size="sm"
          />
        ) : undefined
      }
      widthClass="max-w-xl"
    >
      <DetailSection title="What the parent asked">
        <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{enquiry.question}</p>
      </DetailSection>

      <DetailSection title="Child">
        <DetailRow label="Age" value={enquiry.childAge ?? "—"} />
        <DetailRow label="Sport" value={enquiry.sport ?? "—"} />
        <DetailRow label="Level" value={enquiry.level ?? "—"} />
        <DetailRow label="Objective" value={enquiry.objective ?? "—"} />
      </DetailSection>

      <DetailSection title="Guidance given (latest answer)">
        <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
          {enquiry.guidance ?? "—"}
        </p>
      </DetailSection>

      <DetailSection title="Assistance">
        <DetailRow
          label="Asked for"
          value={
            enquiry.assistance.length
              ? enquiry.assistance.map((a) => ASSISTANCE_LABEL[a] ?? a).join(", ")
              : "Nothing"
          }
        />
        <DetailRow
          label="Feedback"
          value={enquiry.feedback ? FEEDBACK_LABEL[enquiry.feedback] : "—"}
        />
        <DetailRow label="Conversation closed" value={enquiry.closed ? "Yes" : "No"} />
        {enquiry.followUpSummary && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {enquiry.followUpSummary}
          </p>
        )}
        {enquiry.ticketId && (
          <DetailRow
            label="Support ticket"
            value={<span className="font-mono text-xs">{enquiry.ticketId}</span>}
          />
        )}
      </DetailSection>

      {enquiry.followUpStatus !== "none" && (
        <DetailSection title="Follow-up">
          <div className="flex flex-wrap gap-2">
            {(["new", "contacted", "done"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={enquiry.followUpStatus === status ? "secondary" : "outline"}
                disabled={saving || enquiry.followUpStatus === status}
                onClick={() => save({ followUpStatus: status })}
              >
                {FOLLOW_UP_LABEL[status]}
              </Button>
            ))}
          </div>
          {enquiry.hasContact && (
            <div className="mt-3 flex items-center gap-3">
              {phone ? (
                <span className="font-mono text-sm text-slate-900">+{phone}</span>
              ) : (
                <Button size="sm" variant="outline" loading={revealing} onClick={reveal}>
                  Show WhatsApp number
                </Button>
              )}
              <span className="text-xs text-slate-500">
                Kept because the parent asked for the team. Each look is logged.
              </span>
            </div>
          )}
          {enquiry.hasContact && (
            <p className="mt-2 text-xs text-slate-500">
              {replyWindowOpen(enquiry.lastMessageAt)
                ? `They last wrote ${when(enquiry.lastMessageAt)}. WhatsApp lets you reply freely until ${when(
                    replyWindowEnd(enquiry.lastMessageAt)
                  )}.`
                : `They last wrote ${when(enquiry.lastMessageAt)}, more than a day ago. WhatsApp now only allows an approved template message, so a free-text reply will not be delivered until they write again.`}
            </p>
          )}
        </DetailSection>
      )}

      <DetailSection title="Team note">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={1000}
          aria-label="Team note"
          placeholder="What was said or done. Visible to admins only."
          className="focus:border-power-orange-solid focus:ring-power-orange-solid/25 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-slate-400 focus:outline-none focus:ring-2"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            loading={saving}
            disabled={note === savedNote}
            onClick={() => save({ teamNote: note })}
          >
            Save note
          </Button>
        </div>
      </DetailSection>
    </DetailDrawer>
  );
}
