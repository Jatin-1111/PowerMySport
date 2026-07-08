"use client";

import {
    expertApi,
    type Expert,
    type ExpertAvailabilityWindow,
} from "@/modules/expert/services/expert";
import ExpertiseMultiSelect from "@/modules/shared/components/ExpertiseMultiSelect";
import LanguagesMultiSelect from "@/modules/shared/components/LanguagesMultiSelect";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import {
    Award,
    BadgeIndianRupee,
    CalendarClock,
    MapPin,
    Plus,
    Star,
    Trash2,
    User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ExpertPhotoUpload } from "./ExpertPhotoUpload";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const field =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20";
const fieldLabel =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

function SectionHeader({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  iconClassName: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function ExpertProfileEditor({
  profile,
  onSaved,
}: {
  profile: Expert;
  onSaved: (p: Expert) => void;
}) {
  const [bio, setBio] = useState(profile.bio || "");
  const [achievements, setAchievements] = useState(profile.achievements || "");
  const [sports, setSports] = useState<string[]>(profile.sports || []);
  const [expertise, setExpertise] = useState<string[]>(profile.expertise || []);
  const [languages, setLanguages] = useState<string[]>(profile.languages || []);
  const [city, setCity] = useState(profile.city || "");
  const [inPersonAddress, setInPersonAddress] = useState(
    profile.inPersonAddress || "",
  );
  const [sessionMode, setSessionMode] = useState(
    profile.sessionMode || "ONLINE",
  );
  const [sessionFee, setSessionFee] = useState(
    String(profile.sessionFee ?? ""),
  );
  const [duration, setDuration] = useState(
    String(profile.sessionDurationMinutes ?? 60),
  );
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || "");
  const [photoKey, setPhotoKey] = useState(profile.photoKey || "");
  const [windows, setWindows] = useState<ExpertAvailabilityWindow[]>(
    profile.weeklyAvailability || [],
  );
  const [blackout, setBlackout] = useState<string[]>(
    profile.blackoutDates || [],
  );
  const [newBlackout, setNewBlackout] = useState("");
  const [saving, setSaving] = useState(false);

  const addWindow = (dayOfWeek: number) =>
    setWindows((w) => [...w, { dayOfWeek, start: "09:00", end: "10:00" }]);

  const updateWindow = (
    idx: number,
    patch: Partial<ExpertAvailabilityWindow>,
  ) =>
    setWindows((w) =>
      w.map((win, i) => (i === idx ? { ...win, ...patch } : win)),
    );

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
        toast.error(
          `Availability on ${DAYS[w.dayOfWeek]} has an invalid time range.`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const res = await expertApi.updateMyProfile({
        bio,
        achievements,
        sports,
        expertise,
        languages,
        city,
        inPersonAddress,
        sessionMode,
        sessionFee: fee,
        sessionDurationMinutes: Number(duration) || 60,
        photoUrl: photoUrl || undefined,
        photoKey: photoKey || undefined,
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

  const totalSlots = windows.length;
  const modeLabel =
    sessionMode === "BOTH"
      ? "Online + In-person"
      : sessionMode === "ONLINE"
        ? "Online"
        : "In-person";

  return (
    <div className="space-y-6 pb-24 sm:space-y-8">
      {/* Hero */}
      <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm">
        <div className="bg-linear-to-r from-slate-50 to-white px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
              <ExpertPhotoUpload
                currentPhotoUrl={photoUrl || undefined}
                onPhotoReady={(url, key) => {
                  setPhotoUrl(url);
                  setPhotoKey(key);
                }}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expert Profile
                </p>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  {profile.name || "Expert"}
                </h2>
                {profile.email && (
                  <p className="mt-0.5 text-sm text-slate-500">
                    {profile.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                {(profile.rating || 0).toFixed(1)} ({profile.reviewCount || 0})
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  profile.isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-100 text-slate-500"
                }`}
              >
                {profile.isActive ? "Live on PowerMySport" : "Inactive"}
              </span>
              {profile.id && (
                <Link
                  href={`/experts/${profile.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-power-orange hover:text-power-orange"
                >
                  View public profile
                </Link>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatChip label="Sports" value={String(sports.length)} />
            <StatChip
              label="Session fee"
              value={`₹${Number(sessionFee || 0).toLocaleString("en-IN")}`}
            />
            <StatChip label="Mode" value={modeLabel} />
            <StatChip label="Weekly slots" value={String(totalSlots)} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-12 xl:items-start">
        {/* Left column */}
        <div className="space-y-6 xl:col-span-7">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={User}
              iconClassName="bg-indigo-50 text-indigo-600"
              title="About you"
              subtitle="Shown on your public profile"
            />
            <div className="space-y-4">
              <div>
                <label className={fieldLabel}>Bio</label>
                <textarea
                  rows={4}
                  className={field}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
              <div>
                <label className={fieldLabel}>Achievements</label>
                <textarea
                  rows={2}
                  className={field}
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                />
              </div>
              <div>
                <label className={fieldLabel}>City</label>
                <input
                  className={field}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Award}
              iconClassName="bg-purple-50 text-purple-600"
              title="Expertise"
              subtitle="Helps parents find and trust you"
            />
            <div className="space-y-4">
              <div>
                <label className={fieldLabel}>Sports</label>
                <SportsMultiSelect value={sports} onChange={setSports} />
              </div>
              <div>
                <label className={fieldLabel}>Expertise</label>
                <ExpertiseMultiSelect
                  value={expertise}
                  onChange={setExpertise}
                />
              </div>
              <div>
                <label className={fieldLabel}>Languages</label>
                <LanguagesMultiSelect
                  value={languages}
                  onChange={setLanguages}
                />
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={BadgeIndianRupee}
              iconClassName="bg-emerald-50 text-emerald-600"
              title="Session settings"
              subtitle="Fee, format, and length of your sessions"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>Session fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  className={field}
                  value={sessionFee}
                  onChange={(e) => setSessionFee(e.target.value)}
                />
              </div>
              <div>
                <label className={fieldLabel}>Session length (minutes)</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  className={field}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Session mode</label>
                <select
                  className={field}
                  value={sessionMode}
                  onChange={(e) =>
                    setSessionMode(e.target.value as Expert["sessionMode"])
                  }
                >
                  <option value="ONLINE">Online</option>
                  <option value="IN_PERSON">In-person</option>
                  <option value="BOTH">Online or in-person</option>
                </select>
              </div>
              {(sessionMode === "IN_PERSON" || sessionMode === "BOTH") && (
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>
                    <MapPin className="mr-1 inline h-3.5 w-3.5" /> In-person
                    location
                  </label>
                  <input
                    className={field}
                    placeholder="e.g. 2nd Floor, ABC Sports Complex, Sector 15, Chandigarh"
                    value={inPersonAddress}
                    onChange={(e) => setInPersonAddress(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Shown to a client only after they&apos;ve booked a session
                    with you.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6 xl:col-span-5">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={CalendarClock}
              iconClassName="bg-orange-50 text-power-orange"
              title="Weekly availability"
              subtitle="Clients can only book slots inside these windows"
            />
            <div className="space-y-3">
              {DAYS.map((day, dayIdx) => {
                const dayWindows = windows
                  .map((w, i) => ({ w, i }))
                  .filter(({ w }) => w.dayOfWeek === dayIdx);
                return (
                  <div
                    key={day}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        {day}
                      </span>
                      <button
                        onClick={() => addWindow(dayIdx)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-power-orange hover:underline"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>
                    {dayWindows.length === 0 ? (
                      <p className="mt-1.5 text-xs text-slate-400">
                        Unavailable
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {dayWindows.map(({ w, i }) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={w.start}
                              onChange={(e) =>
                                updateWindow(i, { start: e.target.value })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="time"
                              value={w.end}
                              onChange={(e) =>
                                updateWindow(i, { end: e.target.value })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            />
                            <button
                              onClick={() => removeWindow(i)}
                              className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              aria-label="Remove window"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Blackout dates */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h4 className="text-sm font-bold text-slate-900">
                Blackout dates
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Days you&apos;re unavailable even if within your weekly hours.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {blackout.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {d}
                    <button
                      onClick={() =>
                        setBlackout((b) => b.filter((x) => x !== d))
                      }
                      aria-label="Remove date"
                    >
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
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => {
                    if (newBlackout && !blackout.includes(newBlackout)) {
                      setBlackout((b) => [...b, newBlackout].sort());
                      setNewBlackout("");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-sm lg:left-72">
        <div className="mx-auto flex max-w-5xl justify-end">
          <Button onClick={save} loading={saving} variant="primary" size="md">
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
