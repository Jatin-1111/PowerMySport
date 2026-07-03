"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  expertAdminApi,
  type AdminExpertAvailabilityWindow,
} from "@/modules/expert/services/expert";
import CoachPhotoUpload from "@/modules/admin/components/CoachPhotoUpload";
import { AvailabilityEditor } from "@/modules/expert/components/AvailabilityEditor";
import { toast } from "@/lib/toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const toList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export default function AddExpertPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    sessionFee: "",
    sessionMode: "ONLINE" as "ONLINE" | "IN_PERSON" | "BOTH",
    city: "",
    sports: "",
    expertise: "",
    languages: "",
    bio: "",
    achievements: "",
    photoUrl: "",
  });
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [duration, setDuration] = useState("60");
  const [windows, setWindows] = useState<AdminExpertAvailabilityWindow[]>([]);
  const [blackout, setBlackout] = useState<string[]>([]);

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Name, email and phone are required.");
      return;
    }
    const fee = Number(form.sessionFee);
    if (!fee || fee <= 0) {
      toast.error("Enter a valid session fee.");
      return;
    }
    for (const w of windows) {
      if (w.start >= w.end) {
        toast.error("An availability window has an invalid time range.");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await expertAdminApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        sessionFee: fee,
        sessionMode: form.sessionMode,
        city: form.city.trim() || undefined,
        sports: toList(form.sports),
        expertise: toList(form.expertise),
        languages: toList(form.languages),
        bio: form.bio.trim() || undefined,
        achievements: form.achievements.trim() || undefined,
        photoUrl: form.photoUrl.trim() || undefined,
        photoKey: photoKey || undefined,
        sessionDurationMinutes: Number(duration) || 60,
        weeklyAvailability: windows,
        blackoutDates: blackout,
      });
      if (res.success) {
        toast.success("Expert created — login credentials emailed.");
        router.push("/admin/experts");
      } else {
        toast.error(res.message || "Failed to create expert.");
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create expert.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-power-orange/40";
  const label =
    "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Add expert"
        subtitle="Create an expert profile. This provisions their login and emails temporary credentials."
      />

      <Link
        href="/admin/experts"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-power-orange"
      >
        <ArrowLeft className="h-4 w-4" /> Back to experts
      </Link>

      <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Full name *</label>
            <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={label}>Email *</label>
            <input type="email" className={field} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={label}>Phone *</label>
            <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className={label}>Session fee (₹) *</label>
            <input type="number" min={0} className={field} value={form.sessionFee} onChange={(e) => set("sessionFee", e.target.value)} />
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
          <div>
            <label className={label}>City</label>
            <input className={field} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className={label}>Sports (comma-separated)</label>
            <input className={field} value={form.sports} onChange={(e) => set("sports", e.target.value)} placeholder="Football, Cricket" />
          </div>
          <div>
            <label className={label}>Expertise (comma-separated)</label>
            <input className={field} value={form.expertise} onChange={(e) => set("expertise", e.target.value)} placeholder="Finishing, Fitness" />
          </div>
          <div>
            <label className={label}>Languages (comma-separated)</label>
            <input className={field} value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="English, Hindi" />
          </div>
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
        </div>

        <div className="mt-4">
          <label className={label}>Bio</label>
          <textarea rows={4} className={field} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </div>
        <div className="mt-4">
          <label className={label}>Achievements</label>
          <textarea rows={3} className={field} value={form.achievements} onChange={(e) => set("achievements", e.target.value)} />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-bold text-slate-900">Availability</h3>
          <p className="mt-1 text-xs text-slate-500">
            Set the expert&apos;s weekly hours so clients can book right away. You can leave this blank and let the expert set it themselves later — but they won&apos;t be bookable until availability is published.
          </p>
          <div className="mt-4 max-w-xs">
            <label className={label}>Session length (minutes)</label>
            <input
              type="number"
              min={15}
              step={15}
              className={field}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <AvailabilityEditor
              windows={windows}
              blackout={blackout}
              onWindowsChange={setWindows}
              onBlackoutChange={setBlackout}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Link
            href="/admin/experts"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-power-orange px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create expert & email credentials"}
          </button>
        </div>
      </div>
    </div>
  );
}
