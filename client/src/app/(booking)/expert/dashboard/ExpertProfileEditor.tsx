"use client";

import {
  expertApi,
  type Expert,
  type ExpertAvailabilityWindow,
} from "@/modules/expert/services/expert";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const field =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none";
const toList = (v: string) =>
  v.split(",").map((s) => s.trim()).filter(Boolean);

export function ExpertProfileEditor({
  profile,
  onSaved,
}: {
  profile: Expert;
  onSaved: (p: Expert) => void;
}) {
  const [bio, setBio] = useState(profile.bio || "");
  const [achievements, setAchievements] = useState(profile.achievements || "");
  const [sports, setSports] = useState((profile.sports || []).join(", "));
  const [expertise, setExpertise] = useState((profile.expertise || []).join(", "));
  const [languages, setLanguages] = useState((profile.languages || []).join(", "));
  const [city, setCity] = useState(profile.city || "");
  const [sessionMode, setSessionMode] = useState(profile.sessionMode || "ONLINE");
  const [sessionFee, setSessionFee] = useState(String(profile.sessionFee ?? ""));
  const [duration, setDuration] = useState(
    String(profile.sessionDurationMinutes ?? 60),
  );
  const [windows, setWindows] = useState<ExpertAvailabilityWindow[]>(
    profile.weeklyAvailability || [],
  );
  const [blackout, setBlackout] = useState<string[]>(profile.blackoutDates || []);
  const [newBlackout, setNewBlackout] = useState("");
  const [saving, setSaving] = useState(false);

  const addWindow = (dayOfWeek: number) =>
    setWindows((w) => [...w, { dayOfWeek, start: "09:00", end: "10:00" }]);

  const updateWindow = (idx: number, patch: Partial<ExpertAvailabilityWindow>) =>
    setWindows((w) => w.map((win, i) => (i === idx ? { ...win, ...patch } : win)));

  const removeWindow = (idx: number) =>
    setWindows((w) => w.filter((_, i) => i !== idx));

  const save = async () => {
    const fee = Number(sessionFee);
    if (isNaN(fee) || fee < 0) {
      toast.error("Enter a valid session fee.");
      return;
    }
    for (const w of windows) {
      if (w.start >= w.end) {
        toast.error(`Availability on ${DAYS[w.dayOfWeek]} has an invalid time range.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await expertApi.updateMyProfile({
        bio,
        achievements,
        sports: toList(sports),
        expertise: toList(expertise),
        languages: toList(languages),
        city,
        sessionMode,
        sessionFee: fee,
        sessionDurationMinutes: Number(duration) || 60,
        weeklyAvailability: windows,
        blackoutDates: blackout,
      });
      if (res.success && res.data) {
        onSaved(res.data);
        toast.success("Profile updated.");
      } else {
        toast.error(res.message || "Could not save.");
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bio
            </label>
            <textarea rows={3} className={field} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Achievements
            </label>
            <textarea rows={2} className={field} value={achievements} onChange={(e) => setAchievements(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sports (comma separated)
            </label>
            <input className={field} value={sports} onChange={(e) => setSports(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Expertise (comma separated)
            </label>
            <input className={field} value={expertise} onChange={(e) => setExpertise(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Languages (comma separated)
            </label>
            <input className={field} value={languages} onChange={(e) => setLanguages(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              City
            </label>
            <input className={field} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Session mode
            </label>
            <select
              className={field}
              value={sessionMode}
              onChange={(e) => setSessionMode(e.target.value as Expert["sessionMode"])}
            >
              <option value="ONLINE">Online</option>
              <option value="IN_PERSON">In-person</option>
              <option value="BOTH">Online or in-person</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Session fee (₹)
            </label>
            <input type="number" min="0" className={field} value={sessionFee} onChange={(e) => setSessionFee(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Session length (minutes)
            </label>
            <input type="number" min="15" step="15" className={field} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Weekly availability</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set the times you&apos;re available each week. Clients can only book
          slots inside these windows.
        </p>
        <div className="mt-4 space-y-4">
          {DAYS.map((day, dayIdx) => {
            const dayWindows = windows
              .map((w, i) => ({ w, i }))
              .filter(({ w }) => w.dayOfWeek === dayIdx);
            return (
              <div key={day} className="flex flex-col gap-2 border-b border-slate-100 pb-3 last:border-0 sm:flex-row sm:items-start">
                <div className="w-14 pt-2 text-sm font-semibold text-slate-700">{day}</div>
                <div className="flex-1 space-y-2">
                  {dayWindows.length === 0 && (
                    <p className="pt-2 text-sm text-slate-400">Unavailable</p>
                  )}
                  {dayWindows.map(({ w, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={w.start}
                        onChange={(e) => updateWindow(i, { start: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="time"
                        value={w.end}
                        onChange={(e) => updateWindow(i, { end: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => removeWindow(i)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove window"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addWindow(dayIdx)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-power-orange hover:underline"
                  >
                    <Plus size={13} /> Add window
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Blackout dates */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-900">Blackout dates</h3>
          <p className="mt-1 text-xs text-slate-500">Days you&apos;re unavailable even if within your weekly hours.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {blackout.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {d}
                <button onClick={() => setBlackout((b) => b.filter((x) => x !== d))} aria-label="Remove date">
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              value={newBlackout}
              onChange={(e) => setNewBlackout(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => {
                if (newBlackout && !blackout.includes(newBlackout)) {
                  setBlackout((b) => [...b, newBlackout].sort());
                  setNewBlackout("");
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-power-orange px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
