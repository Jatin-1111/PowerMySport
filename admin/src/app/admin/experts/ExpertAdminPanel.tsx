"use client";

import { DetailRow, DetailSection } from "@/modules/shared/ui/DetailDrawer";
import CoachPhotoUpload from "@/modules/admin/components/CoachPhotoUpload";
import { AvailabilityEditor } from "@/modules/expert/components/AvailabilityEditor";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import ExpertiseMultiSelect from "@/modules/shared/components/ExpertiseMultiSelect";
import LanguagesMultiSelect from "@/modules/shared/components/LanguagesMultiSelect";
import {
  expertAdminApi,
  type AdminExpert,
  type AdminExpertAvailabilityWindow,
  type AdminExpertSessionsResult,
} from "@/modules/expert/services/expert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { useState, useEffect } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (v?: string) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const field =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-power-orange/40";
const label =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function ExpertAdminPanel({
  expert,
  onUpdated,
}: {
  expert: AdminExpert;
  onUpdated: (e: AdminExpert) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [sessions, setSessions] = useState<AdminExpertSessionsResult | null>(
    null,
  );
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [form, setForm] = useState({
    bio: expert.bio || "",
    achievements: expert.achievements || "",
    city: expert.city || "",
    sessionMode: expert.sessionMode || "ONLINE",
    sessionFee: String(expert.sessionFee ?? ""),
    sessionDurationMinutes: String(expert.sessionDurationMinutes ?? 60),
    photoUrl: expert.photoUrl || "",
    inPersonAddress: expert.inPersonAddress || "",
  });
  const [sports, setSports] = useState<string[]>(expert.sports || []);
  const [expertise, setExpertise] = useState<string[]>(expert.expertise || []);
  const [languages, setLanguages] = useState<string[]>(expert.languages || []);
  const [photoKey, setPhotoKey] = useState<string | null>(
    expert.photoKey || null,
  );
  const [windows, setWindows] = useState<AdminExpertAvailabilityWindow[]>(
    expert.weeklyAvailability || [],
  );
  const [blackout, setBlackout] = useState<string[]>(
    expert.blackoutDates || [],
  );

  const resetForm = () => {
    setForm({
      bio: expert.bio || "",
      achievements: expert.achievements || "",
      city: expert.city || "",
      sessionMode: expert.sessionMode || "ONLINE",
      sessionFee: String(expert.sessionFee ?? ""),
      sessionDurationMinutes: String(expert.sessionDurationMinutes ?? 60),
      photoUrl: expert.photoUrl || "",
      inPersonAddress: expert.inPersonAddress || "",
    });
    setSports(expert.sports || []);
    setExpertise(expert.expertise || []);
    setLanguages(expert.languages || []);
    setPhotoKey(expert.photoKey || null);
    setWindows(expert.weeklyAvailability || []);
    setBlackout(expert.blackoutDates || []);
  };

  useEffect(() => {
    resetForm();
  }, [expert]);

  const set = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const id = expert.id || expert._id || "";

  const handleApprove = async () => {
    setBusy(true);
    try {
      const res = await expertAdminApi.approve(id);
      if (res.success && res.data) {
        onUpdated(res.data);
        toast.success("Expert approved and is now live!");
      } else toast.error(res.message || "Failed to approve.");
    } catch {
      toast.error("Failed to approve expert.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      toast.error("Please enter a rejection reason (min 5 characters).");
      return;
    }
    setBusy(true);
    try {
      const res = await expertAdminApi.reject(id, rejectionReason.trim());
      if (res.success && res.data) {
        onUpdated(res.data);
        setRejecting(false);
        setRejectionReason("");
        toast.success("Expert profile rejected. They'll be notified by email.");
      } else toast.error(res.message || "Failed to reject.");
    } catch {
      toast.error("Failed to reject expert.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      const res = await expertAdminApi.setActive(id, !expert.isActive);
      if (res.success && res.data) {
        onUpdated(res.data);
        toast.success(
          res.data.isActive ? "Expert activated." : "Expert deactivated.",
        );
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
    for (const w of windows) {
      if (w.start >= w.end) {
        toast.error("An availability window has an invalid time range.");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await expertAdminApi.update(id, {
        bio: form.bio,
        achievements: form.achievements,
        sports,
        expertise,
        languages,
        city: form.city,
        sessionMode: form.sessionMode,
        sessionFee: fee,
        sessionDurationMinutes: Number(form.sessionDurationMinutes) || 60,
        weeklyAvailability: windows,
        blackoutDates: blackout,
        photoUrl: form.photoUrl || undefined,
        photoKey: photoKey || undefined,
        inPersonAddress: form.inPersonAddress || undefined,
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
          <textarea
            rows={3}
            className={field}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Achievements</label>
          <textarea
            rows={2}
            className={field}
            value={form.achievements}
            onChange={(e) => set("achievements", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Sports</label>
          <SportsMultiSelect value={sports} onChange={setSports} />
        </div>
        <div>
          <label className={label}>Expertise</label>
          <ExpertiseMultiSelect value={expertise} onChange={setExpertise} />
        </div>
        <div>
          <label className={label}>Languages</label>
          <LanguagesMultiSelect value={languages} onChange={setLanguages} />
        </div>
        <div>
          <label className={label}>City</label>
          <input
            className={field}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Session mode</label>
          <select
            className={field}
            value={form.sessionMode}
            onChange={(e) => set("sessionMode", e.target.value)}
          >
            <option value="ONLINE">Online</option>
            <option value="IN_PERSON">In-person</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        {(form.sessionMode === "IN_PERSON" || form.sessionMode === "BOTH") && (
          <div>
            <label className={label}>In-person location</label>
            <input
              className={field}
              placeholder="e.g. 2nd Floor, ABC Sports Complex, Sector 15, Chandigarh"
              value={form.inPersonAddress}
              onChange={(e) => set("inPersonAddress", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Shown to a client only after they've booked a session.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Session fee (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.sessionFee}
              onChange={(e) => set("sessionFee", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Length (min)</label>
            <input
              type="number"
              min={15}
              step={15}
              className={field}
              value={form.sessionDurationMinutes}
              onChange={(e) => set("sessionDurationMinutes", e.target.value)}
            />
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-sm font-bold text-slate-900">
            Weekly availability
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Clients can only book slots inside these windows.
          </p>
          <div className="mt-3">
            <AvailabilityEditor
              windows={windows}
              blackout={blackout}
              onWindowsChange={setWindows}
              onBlackoutChange={setBlackout}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={saveEdit}
            disabled={busy}
            className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              resetForm();
            }}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Approve / Reject panel for PENDING self-registered experts */}
      {expert.verificationStatus === "PENDING" && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 text-sm font-bold text-amber-900">Awaiting Review</p>
          <p className="mb-3 text-xs text-amber-700">
            This expert self-registered and submitted their profile for review. Review their profile details below, then approve or reject.
          </p>
          {!rejecting ? (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                <AlertCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={2}
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                placeholder="Rejection reason — the expert will see this in their email..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? "Rejecting…" : "Send Rejection"}
                </button>
                <button
                  onClick={() => { setRejecting(false); setRejectionReason(""); }}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {expert.verificationStatus === "REJECTED" && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-sm font-bold text-red-900">Profile Rejected</p>
          {expert.rejectionReason && (
            <p className="mb-3 text-xs text-red-700">{expert.rejectionReason}</p>
          )}
          <button
            onClick={handleApprove}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" /> Approve anyway
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Edit profile
        </button>
        <button
          onClick={toggleActive}
          disabled={
            busy || (!expert.isActive && expert.verificationStatus !== "APPROVED")
          }
          title={
            !expert.isActive && expert.verificationStatus !== "APPROVED"
              ? "Approve this expert first — only APPROVED experts can be activated"
              : undefined
          }
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
        <DetailRow
          label="Session length"
          value={`${expert.sessionDurationMinutes || 60} min`}
        />
        <DetailRow
          label="Availability"
          value={expert.hasAvailability ? "Published" : "Not set"}
        />
        <DetailRow
          label="Rating"
          value={`${expert.rating.toFixed(1)} (${expert.reviewCount} reviews)`}
        />
        <DetailRow label="City" value={expert.city || "—"} />
        <DetailRow label="Joined" value={formatDate(expert.createdAt)} />
      </DetailSection>

      <DetailSection title="Sports & expertise">
        <div className="flex flex-wrap gap-1.5">
          {(expert.sports || []).map((s) => (
            <span
              key={s}
              className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-medium text-power-orange"
            >
              {s}
            </span>
          ))}
          {(expert.expertise || []).map((s) => (
            <span
              key={s}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {s}
            </span>
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
              <SummaryStat
                label="Total"
                value={String(sessions.summary.total)}
              />
              <SummaryStat
                label="Completed"
                value={String(sessions.summary.completed)}
              />
              <SummaryStat
                label="Gross earnings"
                value={formatInr(sessions.summary.grossEarnings)}
              />
              <SummaryStat
                label="Refunds pending"
                value={formatInr(sessions.summary.refundsPending)}
              />
              <SummaryStat
                label="Payout pending"
                value={formatInr(sessions.summary.payoutPending)}
              />
              <SummaryStat
                label="Payout released"
                value={formatInr(sessions.summary.payoutReleased)}
              />
            </div>
            <div className="divide-y divide-slate-100">
              {sessions.sessions.map((s) => (
                <div key={s.id || s._id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      {s.clientName || "Client"}
                    </span>
                    <span className="text-slate-500">
                      {formatInr(s.amount)} · {s.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {s.reviewed && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      {s.rating}★ {s.reviewHidden ? "(hidden)" : ""}{" "}
                      {s.review ? `— "${s.review}"` : ""}
                    </p>
                  )}
                  {s.refundStatus === "REQUIRED" &&
                    s.cancellationNoticeHours != null && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.cancellationNoticeHours >= 0
                          ? `Cancelled ${s.cancellationNoticeHours}h before the scheduled session.`
                          : `Cancelled ${Math.abs(s.cancellationNoticeHours)}h after the scheduled time.`}
                      </p>
                    )}
                  {s.status === "COMPLETED" &&
                    s.paymentStatus === "COMPLETED" && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.payoutStatus === "PAID" ? (
                          `Payout released${s.payoutPaidAt ? ` on ${formatDate(s.payoutPaidAt)}` : ""}.`
                        ) : (
                          <>
                            Payout pending (auto-releases 24h after completion,
                            or process it now from{" "}
                            <Link
                              href="/admin/payouts"
                              className="font-semibold text-power-orange hover:underline"
                            >
                              Pending Payouts
                            </Link>
                            ).
                          </>
                        )}
                      </p>
                    )}
                  <div className="mt-1 flex gap-2">
                    {s.refundStatus === "REQUIRED" && (
                      <button
                        onClick={() => refundDone(s.id || s._id || "")}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Mark refund done
                      </button>
                    )}
                    {s.reviewed && (
                      <button
                        onClick={() =>
                          toggleHide(s.id || s._id || "", !s.reviewHidden)
                        }
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
