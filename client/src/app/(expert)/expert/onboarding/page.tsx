"use client";

import { authApi } from "@/modules/auth/services/auth";
import { expertApi, type ExpertAvailabilityWindow } from "@/modules/expert/services/expert";
import { ExpertPhotoUpload } from "@/modules/expert/components/ExpertPhotoUpload";
import ExpertiseMultiSelect from "@/modules/shared/components/ExpertiseMultiSelect";
import LanguagesMultiSelect from "@/modules/shared/components/LanguagesMultiSelect";
import { Button } from "@/modules/shared/ui/Button";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CalendarOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const field =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100";
const label =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const card =
  "rounded-2xl border-0 bg-white p-6 shadow-[0_2px_16px_rgb(0,0,0,0.06)] dark:bg-slate-900 sm:p-8";

const STEPS = [
  { id: 1, title: "Your Identity", icon: User },
  { id: 2, title: "Expertise", icon: Award },
  { id: 3, title: "Session Setup", icon: Zap },
  { id: 4, title: "Availability", icon: Clock },
];

function SectionHeading({
  icon: Icon,
  tint,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  tint: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ExpertOnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Step 1 — Identity
  const [name, setName] = useState(user?.name || "");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [bio, setBio] = useState("");
  const [achievements, setAchievements] = useState("");
  const [city, setCity] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  // Step 2 — Expertise
  const [sports, setSports] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string[]>([]);

  // Step 3 — Session Setup
  const [sessionFee, setSessionFee] = useState("");
  const [sessionMode, setSessionMode] = useState<"ONLINE" | "IN_PERSON" | "BOTH">("ONLINE");
  const [inPersonAddress, setInPersonAddress] = useState("");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState("60");

  // Step 4 — Availability
  const [windows, setWindows] = useState<ExpertAvailabilityWindow[]>([]);
  const [blackout, setBlackout] = useState<string[]>([]);
  const [newBlackout, setNewBlackout] = useState("");

  // The auth store hydrates from localStorage asynchronously (see
  // HydrationBoundary), so `user` can still be null on the render where this
  // component's `name` state initializer runs. Sync once it arrives.
  useEffect(() => {
    if (user?.name && !name) setName(user.name);
  }, [user?.name, name]);

  useEffect(() => {
    // Load existing profile — if already PENDING or APPROVED, show status screen
    expertApi.getMyProfile().then((res) => {
      if (res.success && res.data) {
        const p = res.data;
        if (p.verificationStatus === "APPROVED") {
          router.replace("/expert/dashboard");
          return;
        }
        if (p.verificationStatus === "PENDING") {
          setSubmitted(true);
          setLoading(false);
          return;
        }
        // Pre-fill from any saved draft
        setPhotoUrl(p.photoUrl || "");
        setPhotoKey(p.photoKey || "");
        setBio(p.bio || "");
        setAchievements(p.achievements || "");
        setCity(p.city || "");
        setLanguages(p.languages || []);
        setSports(p.sports || []);
        setExpertise(p.expertise || []);
        setSessionFee(p.sessionFee > 0 ? String(p.sessionFee) : "");
        setSessionMode(p.sessionMode || "ONLINE");
        setInPersonAddress(p.inPersonAddress || "");
        setSessionDurationMinutes(String(p.sessionDurationMinutes || 60));
        setWindows(p.weeklyAvailability || []);
        setBlackout(p.blackoutDates || []);
        // If rejected, show rejection reason
        if (p.verificationStatus === "REJECTED") {
          setStep(1);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  // ── Availability helpers ─────────────────────────────────────────────────

  const addWindow = (dayOfWeek: number) =>
    setWindows((w) => [...w, { dayOfWeek, start: "09:00", end: "10:00" }]);

  const updateWindow = (idx: number, key: "start" | "end", val: string) =>
    setWindows((w) => w.map((item, i) => (i === idx ? { ...item, [key]: val } : item)));

  const removeWindow = (idx: number) =>
    setWindows((w) => w.filter((_, i) => i !== idx));

  const addBlackout = () => {
    if (!newBlackout) return;
    setBlackout((b) => [...b, newBlackout]);
    setNewBlackout("");
  };

  // ── Save draft to server silently ────────────────────────────────────────

  const saveDraft = async (patch: Parameters<typeof expertApi.updateMyProfile>[0]) => {
    try {
      await expertApi.updateMyProfile(patch);
    } catch {
      // Best-effort; don't block navigation
    }
  };

  // ── Step navigation ──────────────────────────────────────────────────────

  const goNext = async () => {
    if (step === 1) {
      if (!name.trim()) {
        toast.error("Name is required");
        return;
      }
      if (!bio.trim() || bio.trim().length < 20) {
        toast.error("Bio must be at least 20 characters");
        return;
      }
      if (!achievements.trim()) {
        toast.error("Achievements are required — this is your main trust signal with clients");
        return;
      }
      if (name.trim() !== user?.name) {
        const nameRes = await authApi.updateProfile({ name: name.trim() });
        if (nameRes.success && nameRes.data) setUser(nameRes.data);
      }
      await saveDraft({ bio, achievements, city, languages, photoUrl: photoUrl || undefined, photoKey: photoKey || undefined });
    }
    if (step === 2) {
      if (sports.length === 0) {
        toast.error("Select at least one sport");
        return;
      }
      if (expertise.length === 0) {
        toast.error("Add at least one expertise tag");
        return;
      }
      await saveDraft({ sports, expertise });
    }
    if (step === 3) {
      const fee = Number(sessionFee);
      if (!sessionFee || isNaN(fee) || fee <= 0) {
        toast.error("Enter a valid session fee");
        return;
      }
      if ((sessionMode === "IN_PERSON" || sessionMode === "BOTH") && !inPersonAddress.trim()) {
        toast.error("In-person address is required for in-person sessions");
        return;
      }
      await saveDraft({
        sessionFee: fee,
        sessionMode,
        inPersonAddress: inPersonAddress || undefined,
        sessionDurationMinutes: Number(sessionDurationMinutes) || 60,
      });
    }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => s - 1);

  // ── Final submission ─────────────────────────────────────────────────────

  const handleSubmit = async () => {
    for (const w of windows) {
      if (w.start >= w.end) {
        toast.error(`Availability window on ${DAYS[w.dayOfWeek]} has an invalid time range`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await expertApi.updateMyProfile({
        weeklyAvailability: windows,
        blackoutDates: blackout,
      });
      const res = await expertApi.submitForReview();
      if (res.success) {
        setSubmitted(true);
        toast.success("Profile submitted for review!");
      } else {
        toast.error(res.message || "Submission failed");
      }
    } catch {
      toast.error("Failed to submit profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-power-orange" />
        <p className="text-sm text-slate-500">Loading your profile...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-16 text-center">
        <div className="w-full rounded-2xl border-0 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.1)] sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <Clock className="h-10 w-10 text-amber-500" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
            Profile Under Review
          </h1>
          <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            Our team is reviewing your profile. We&apos;ll email you at{" "}
            <strong>{user?.email}</strong> once it&apos;s approved. This
            usually takes 1–2 business days.
          </p>
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            While you wait, you can log in to update your profile or set
            your availability from the dashboard.
          </div>
          <Button
            variant="primary"
            fullWidth
            className="mt-6"
            onClick={() => router.push("/expert/dashboard")}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-power-orange/30 bg-power-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-power-orange">
            <ShieldCheck className="h-3.5 w-3.5" /> Expert Onboarding
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Set Up Your Expert Profile
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Step {step} of {STEPS.length} — complete your profile to submit for review
          </p>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                step > s.id
                  ? "bg-emerald-500 text-white"
                  : step === s.id
                    ? "bg-power-orange text-white shadow-lg shadow-power-orange/30"
                    : "bg-white text-slate-400 shadow-[0_2px_8px_rgb(0,0,0,0.05)] dark:bg-slate-800"
              }`}>
                {step > s.id ? <CheckCircle2 className="h-5 w-5" /> : s.id}
              </div>
              <p className={`ml-2 hidden text-xs font-semibold sm:block ${
                step === s.id ? "text-power-orange" : "text-slate-400"
              }`}>
                {s.title}
              </p>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-px flex-1 transition-colors ${step > s.id ? "bg-emerald-300" : "bg-slate-200 dark:bg-slate-700"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Identity */}
        {step === 1 && (
          <SlideUp key={1} className="space-y-5">
            <div className={card}>
              <SectionHeading
                icon={User}
                tint="bg-indigo-50 text-indigo-600"
                title="Professional Identity"
                subtitle="How clients will get to know you"
              />

              <div className="mb-5 flex justify-center">
                <ExpertPhotoUpload
                  currentPhotoUrl={photoUrl || undefined}
                  onPhotoReady={(url, key) => {
                    setPhotoUrl(url);
                    setPhotoKey(key);
                  }}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className={label}>
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={field}
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className={label}>
                    Bio <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    className={field}
                    placeholder="Tell clients about your background, experience, and what makes you unique as an expert..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={4000}
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{bio.length}/4000</p>
                </div>

                <div>
                  <label className={label}>
                    Achievements <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className={field}
                    placeholder="e.g. National champion 2018, Represented India U23, State gold medallist 2020..."
                    value={achievements}
                    onChange={(e) => setAchievements(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    This is your primary trust signal with clients — be specific.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>City</label>
                    <input
                      className={field}
                      placeholder="e.g. Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Languages</label>
                    <LanguagesMultiSelect value={languages} onChange={setLanguages} />
                  </div>
                </div>
              </div>
            </div>
          </SlideUp>
        )}

        {/* Step 2 — Expertise */}
        {step === 2 && (
          <SlideUp key={2} className={card}>
            <SectionHeading
              icon={Award}
              tint="bg-purple-50 text-purple-600"
              title="Your Expertise"
              subtitle="Drives search discovery and which sport pathways you can endorse"
            />

            <div className="space-y-4">
              <div>
                <label className={label}>
                  Sports <span className="text-red-500">*</span>
                </label>
                <SportsMultiSelect value={sports} onChange={setSports} />
              </div>
              <div>
                <label className={label}>
                  Expertise / Specialisations <span className="text-red-500">*</span>
                </label>
                <ExpertiseMultiSelect value={expertise} onChange={setExpertise} />
                <p className="mt-1 text-xs text-slate-500">
                  e.g. Batting technique, Penalty kicks, Serve & return, Mental conditioning…
                </p>
              </div>
            </div>
          </SlideUp>
        )}

        {/* Step 3 — Session Setup */}
        {step === 3 && (
          <SlideUp key={3} className={card}>
            <SectionHeading
              icon={Zap}
              tint="bg-emerald-50 text-emerald-600"
              title="Session Setup"
              subtitle="Fee, format, and length of your sessions"
            />

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>
                    Session Fee (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    className={field}
                    placeholder="e.g. 1500"
                    value={sessionFee}
                    onChange={(e) => setSessionFee(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Session Length</label>
                  <select
                    className={field}
                    value={sessionDurationMinutes}
                    onChange={(e) => setSessionDurationMinutes(e.target.value)}
                  >
                    {[30, 45, 60, 75, 90, 120].map((m) => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={label}>
                  Session Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["ONLINE", "IN_PERSON", "BOTH"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSessionMode(mode)}
                      className={`rounded-xl border py-3 text-sm font-semibold transition-all ${
                        sessionMode === mode
                          ? "border-power-orange bg-power-orange/10 text-power-orange"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-power-orange/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {mode === "ONLINE" ? "Online" : mode === "IN_PERSON" ? "In-person" : "Both"}
                    </button>
                  ))}
                </div>
              </div>

              {(sessionMode === "IN_PERSON" || sessionMode === "BOTH") && (
                <div>
                  <label className={label}>
                    In-person Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={field}
                    placeholder="e.g. 2nd Floor, ABC Sports Complex, Sector 15, Chandigarh"
                    value={inPersonAddress}
                    onChange={(e) => setInPersonAddress(e.target.value)}
                  />
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />
                    Only shared with clients who have an active booking — never shown on the public listing.
                  </p>
                </div>
              )}
            </div>
          </SlideUp>
        )}

        {/* Step 4 — Availability */}
        {step === 4 && (
          <SlideUp key={4} className="space-y-4">
            <div className={card}>
              <SectionHeading
                icon={Clock}
                tint="bg-power-orange/10 text-power-orange"
                title="Weekly Availability"
                subtitle="Clients can only book slots inside these windows — you can skip this and set it later"
              />

              {DAYS.map((day, dayIdx) => {
                const dayWindows = windows
                  .map((w, i) => ({ w, i }))
                  .filter(({ w }) => w.dayOfWeek === dayIdx);
                const hasSlots = dayWindows.length > 0;
                return (
                  <div
                    key={day}
                    className={`mb-2.5 rounded-xl border p-3 transition-colors ${
                      hasSlots
                        ? "border-emerald-100 bg-emerald-50/40"
                        : "border-slate-100 bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex w-16 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasSlots ? "bg-emerald-500" : "bg-slate-300"}`} />
                        {day}
                      </span>
                      <button
                        type="button"
                        onClick={() => addWindow(dayIdx)}
                        className="flex items-center gap-1 text-xs font-semibold text-power-orange hover:text-orange-600"
                      >
                        <Plus className="h-3 w-3" /> Add slot
                      </button>
                    </div>
                    {dayWindows.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {dayWindows.map(({ w, i }) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="time"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                              value={w.start}
                              onChange={(e) => updateWindow(i, "start", e.target.value)}
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="time"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                              value={w.end}
                              onChange={(e) => updateWindow(i, "end", e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeWindow(i)}
                              className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={card}>
              <SectionHeading
                icon={CalendarOff}
                tint="bg-slate-100 text-slate-600"
                title="Blackout Dates"
                subtitle="Optional — days you're unavailable even within your weekly hours"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  className={field}
                  value={newBlackout}
                  onChange={(e) => setNewBlackout(e.target.value)}
                />
                <Button variant="secondary" onClick={addBlackout}>Add</Button>
              </div>
              {blackout.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {blackout.map((d) => (
                    <span
                      key={d}
                      className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {d}
                      <button type="button" onClick={() => setBlackout((b) => b.filter((x) => x !== d))}>
                        <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <p className="pt-1">
                <strong>Submitting for review</strong> — our team will verify your profile before it goes live. You&apos;ll receive an email notification once approved (typically 1–2 business days).
              </p>
            </div>
          </SlideUp>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <Button variant="secondary" onClick={goBack} icon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < STEPS.length ? (
            <Button variant="primary" onClick={goNext}>
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit for Review"}
            </Button>
          )}
        </div>

        {step === 4 && (
          <p className="mt-3 text-center text-xs text-slate-400">
            You can skip availability for now and set it from your dashboard after approval.{" "}
            <button
              type="button"
              className="font-semibold text-power-orange hover:underline"
              onClick={handleSubmit}
              disabled={submitting}
            >
              Skip &amp; submit anyway
            </button>
          </p>
        )}
    </div>
  );
}
