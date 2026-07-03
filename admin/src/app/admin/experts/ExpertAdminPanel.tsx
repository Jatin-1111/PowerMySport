"use client";

import {
  DetailRow,
  DetailSection,
} from "@/modules/shared/ui/DetailDrawer";
import CoachPhotoUpload from "@/modules/admin/components/CoachPhotoUpload";
import {
  expertAdminApi,
  type AdminExpert,
  type AdminExpertSessionsResult,
} from "@/modules/expert/services/expert";
import { toast } from "@/lib/toast";
import { useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (v?: string) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const toList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-power-orange/40";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function ExpertAdminPanel({
  expert,
  onUpdated,
}: {
  expert: AdminExpert;
  onUpdated: (e: AdminExpert) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<AdminExpertSessionsResult | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [form, setForm] = useState({
    bio: expert.bio || "",
    achievements: expert.achievements || "",
    sports: (expert.sports || []).join(", "),
    expertise: (expert.expertise || []).join(", "),
    languages: (expert.languages || []).join(", "),
    city: expert.city || "",
    sessionMode: expert.sessionMode || "ONLINE",
    sessionFee: String(expert.sessionFee ?? ""),
    sessionDurationMinutes: String(expert.sessionDurationMinutes ?? 60),
    photoUrl: expert.photoUrl || "",
  });
  const [photoKey, setPhotoKey] = useState<string | null>(expert.photoKey || null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const id = expert.id || expert._id || "";

  const toggleActive = async () => {
    setBusy(true);
    try {
      const res = await expertAdminApi.setActive(id, !expert.isActive);
      if (res.success && res.data) {
        onUpdated(res.data);
        toast.success(res.data.isActive ? "Expert activated." : "Expert deactivated.");
      } else toast.error(res.message || "Failed.");
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    const fee = Number(form.sessionFee);
    if (isNaN(fee) || fee < 0) {
      toast.error("Enter a valid session fee.");
      return;
    }
    setBusy(true);
    try {
      const res = await expertAdminApi.update(id, {
        bio: form.bio,
        achievements: form.achievements,
        sports: toList(form.sports),
        expertise: toList(form.expertise),
        languages: toList(form.languages),
        city: form.city,
        sessionMode: form.sessionMode,
        sessionFee: fee,
        sessionDurationMinutes: Number(form.sessionDurationMinutes) || 60,
        photoUrl: form.photoUrl || undefined,
        photoKey: photoKey || undefined,
      });
      if (res.success && res.data) {
        onUpdated(res.data);
        setEditing(false);
        toast.success("Expert updated.");
      } else toast.error(res.message || "Failed to update.");
    } catch {
      toast.error("Failed to update expert.");
    } finally {
      setBusy(false);
    }
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await expertAdminApi.getSessions(id);
      if (res.success && res.data) setSessions(res.data);
      else toast.error(res.message || "Failed to load sessions.");
    } catch {
      toast.error("Failed to load sessions.");
    } finally {
      setLoadingSessions(false);
    }
  };

  const refundDone = async (sessionId: string) => {
    try {
      const res = await expertAdminApi.markRefundDone(sessionId);
      if (res.success) {
        toast.success("Refund marked done.");
        loadSessions();
      } else toast.error(res.message || "Failed.");
    } catch {
      toast.error("Failed.");
    }
  };

  const toggleHide = async (sessionId: string, hidden: boolean) => {
    try {
      const res = await expertAdminApi.hideReview(sessionId, hidden);
      if (res.success) {
        toast.success(hidden ? "Review hidden." : "Review restored.");
        loadSessions();
      } else toast.error(res.message || "Failed.");
    } catch {
      toast.error("Failed.");
    }
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <div>
          <label className={label}>Profile photo</label>
          <CoachPhotoUpload
            currentPhotoUrl={form.photoUrl || undefined}
            onPhotoReady={(url, key) => {
              set("photoUrl", url || "");
              setPhotoKey(key);
            }}
          />
        </div>
        <div>
          <label className={label}>Bio</label>
          <textarea rows={3} className={field} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </div>
        <div>
          <label className={label}>Achievements</label>
          <textarea rows={2} className={field} value={form.achievements} onChange={(e) => set("achievements", e.target.value)} />
        </div>
        <div>
          <label className={label}>Sports (comma separated)</label>
          <input className={field} value={form.sports} onChange={(e) => set("sports", e.target.value)} />
        </div>
        <div>
          <label className={label}>Expertise (comma separated)</label>
          <input className={field} value={form.expertise} onChange={(e) => set("expertise", e.target.value)} />
        </div>
        <div>
          <label className={label}>Languages (comma separated)</label>
          <input className={field} value={form.languages} onChange={(e) => set("languages", e.target.value)} />
        </div>
        <div>
          <label className={label}>City</label>
          <input className={field} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className={label}>Session mode</label>
          <select className={field} value={form.sessionMode} onChange={(e) => set("sessionMode", e.target.value)}>
            <option value="ONLINE">Online</option>
            <option value="IN_PERSON">In-person</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Session fee (₹)</label>
            <input type="number" min={0} className={field} value={form.sessionFee} onChange={(e) => set("sessionFee", e.target.value)} />
          </div>
          <div>
            <label className={label}>Length (min)</label>
            <input type="number" min={15} step={15} className={field} value={form.sessionDurationMinutes} onChange={(e) => set("sessionDurationMinutes", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={saveEdit} disabled={busy} className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
            {busy ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setEditing(true)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">
          Edit profile
        </button>
        <button
          onClick={toggleActive}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${
            expert.isActive
              ? "border border-red-200 text-red-600 hover:bg-red-50"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {expert.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>

      <DetailSection title="Overview">
        <DetailRow label="Session fee" value={formatInr(expert.sessionFee)} />
        <DetailRow
          label="Mode"
          value={
            expert.sessionMode === "BOTH"
              ? "Online / In-person"
              : expert.sessionMode === "ONLINE"
                ? "Online"
                : "In-person"
          }
        />
        <DetailRow label="Session length" value={`${expert.sessionDurationMinutes || 60} min`} />
        <DetailRow label="Availability" value={expert.hasAvailability ? "Published" : "Not set"} />
        <DetailRow label="Rating" value={`${expert.rating.toFixed(1)} (${expert.reviewCount} reviews)`} />
        <DetailRow label="City" value={expert.city || "—"} />
        <DetailRow label="Joined" value={formatDate(expert.createdAt)} />
      </DetailSection>

      <DetailSection title="Sports & expertise">
        <div className="flex flex-wrap gap-1.5">
          {(expert.sports || []).map((s) => (
            <span key={s} className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-medium text-power-orange">{s}</span>
          ))}
          {(expert.expertise || []).map((s) => (
            <span key={s} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{s}</span>
          ))}
        </div>
      </DetailSection>

      {expert.bio && (
        <DetailSection title="Bio">
          <p className="text-sm leading-relaxed text-slate-700">{expert.bio}</p>
        </DetailSection>
      )}

      <DetailSection title="Sessions & earnings">
        {!sessions ? (
          <button
            onClick={loadSessions}
            disabled={loadingSessions}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingSessions ? "Loading…" : "Load sessions"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SummaryStat label="Total" value={String(sessions.summary.total)} />
              <SummaryStat label="Completed" value={String(sessions.summary.completed)} />
              <SummaryStat label="Gross earnings" value={formatInr(sessions.summary.grossEarnings)} />
              <SummaryStat label="Refunds pending" value={formatInr(sessions.summary.refundsPending)} />
            </div>
            <div className="divide-y divide-slate-100">
              {sessions.sessions.map((s) => (
                <div key={s.id || s._id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{s.clientName || "Client"}</span>
                    <span className="text-slate-500">{formatInr(s.amount)} · {s.status.replace(/_/g, " ")}</span>
                  </div>
                  {s.reviewed && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      {s.rating}★ {s.reviewHidden ? "(hidden)" : ""} {s.review ? `— "${s.review}"` : ""}
                    </p>
                  )}
                  <div className="mt-1 flex gap-2">
                    {s.refundStatus === "REQUIRED" && (
                      <button onClick={() => refundDone(s.id || s._id || "")} className="text-xs font-semibold text-emerald-700 hover:underline">
                        Mark refund done
                      </button>
                    )}
                    {s.reviewed && (
                      <button
                        onClick={() => toggleHide(s.id || s._id || "", !s.reviewHidden)}
                        className="text-xs font-semibold text-slate-600 hover:underline"
                      >
                        {s.reviewHidden ? "Unhide review" : "Hide review"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DetailSection>
    </>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold text-slate-900">{value}</p>
    </div>
  );
}
