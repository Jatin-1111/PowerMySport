"use client";

import { authApi } from "@/modules/auth/services/auth";
import {
  expertApi,
  type Expert,
  type ExpertAvailabilityWindow,
} from "@/modules/expert/services/expert";
import ExpertiseMultiSelect from "@/modules/shared/components/ExpertiseMultiSelect";
import LanguagesMultiSelect from "@/modules/shared/components/LanguagesMultiSelect";
import {
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
  ProfileSection,
} from "@/modules/shared/components/settings/ProfileSection";
import { Button } from "@/modules/shared/ui/Button";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { UnderlineFilter } from "@/modules/shared/ui/UnderlineFilter";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { SUPPORTED_SPORT_NAMES } from "@/modules/sports/config/supportedSports";
import { cn } from "@/utils/cn";
import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ExpertPhotoUpload } from "./ExpertPhotoUpload";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Kept identical to the regexes enforced during onboarding
// (TaxPayoutInfoStep.tsx) and server-side (ExpertsService.ts).
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const TIME_INPUT = cn(FIELD_INPUT, "w-36 tabular-nums");
const ACTION = `${TEXT_LINK} ring-offset-paper min-h-11 text-sm`;

/**
 * The expert's own profile as ruled sections, each a heading and its fields. It
 * is one form with one Save: nothing is stored until the expert saves, and the
 * same rules apply here as in onboarding, so a profile cannot be saved into a
 * state onboarding would have refused.
 */
export function ExpertProfileEditor({
  profile,
  onSaved,
}: {
  profile: Expert;
  onSaved: (p: Expert) => void;
}) {
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [achievements, setAchievements] = useState(profile.achievements || "");
  const [sports, setSports] = useState<string[]>(profile.sports || []);
  const [expertise, setExpertise] = useState<string[]>(profile.expertise || []);
  const [languages, setLanguages] = useState<string[]>(profile.languages || []);
  const [city, setCity] = useState(profile.city || "");
  const [panNumber, setPanNumber] = useState(profile.panNumber || "");
  const [gstNumber, setGstNumber] = useState(profile.gstNumber || "");
  const [inPersonAddress, setInPersonAddress] = useState(profile.inPersonAddress || "");
  const [sessionMode, setSessionMode] = useState(profile.sessionMode || "ONLINE");
  const [sessionFee, setSessionFee] = useState(String(profile.sessionFee ?? ""));
  const [duration, setDuration] = useState(String(profile.sessionDurationMinutes ?? 60));
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || "");
  const [photoKey, setPhotoKey] = useState(profile.photoKey || "");
  const [windows, setWindows] = useState<ExpertAvailabilityWindow[]>(
    profile.weeklyAvailability || []
  );
  const [blackout, setBlackout] = useState<string[]>(profile.blackoutDates || []);
  const [newBlackout, setNewBlackout] = useState("");
  const [saving, setSaving] = useState(false);

  const addWindow = (dayOfWeek: number) =>
    setWindows((w) => [...w, { dayOfWeek, start: "09:00", end: "10:00" }]);

  const updateWindow = (idx: number, patch: Partial<ExpertAvailabilityWindow>) =>
    setWindows((w) => w.map((win, i) => (i === idx ? { ...win, ...patch } : win)));

  const removeWindow = (idx: number) => setWindows((w) => w.filter((_, i) => i !== idx));

  const save = async () => {
    // Same validation rules as onboarding — keep create and edit in sync.
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!bio.trim() || bio.trim().length < 20) {
      toast.error("Bio must be at least 20 characters.");
      return;
    }
    if (!achievements.trim()) {
      toast.error("Achievements are required.");
      return;
    }
    const fee = Number(sessionFee);
    if (!sessionFee || isNaN(fee) || fee <= 0) {
      toast.error("Enter a valid session fee.");
      return;
    }
    if ((sessionMode === "IN_PERSON" || sessionMode === "BOTH") && !inPersonAddress.trim()) {
      toast.error("In-person address is required.");
      return;
    }
    for (const w of windows) {
      if (w.start >= w.end) {
        toast.error(`Invalid time range on ${DAYS[w.dayOfWeek]}.`);
        return;
      }
    }
    const pan = panNumber.trim().toUpperCase();
    if (!pan || !PAN_REGEX.test(pan)) {
      toast.error("Enter a valid PAN number (e.g. ABCDE1234F).");
      return;
    }
    const gst = gstNumber.trim().toUpperCase();
    if (gst && !GST_REGEX.test(gst)) {
      toast.error("Enter a valid GST number, or leave it blank.");
      return;
    }
    setSaving(true);
    try {
      if (name.trim() !== profile.name) {
        const nameRes = await authApi.updateProfile({ name: name.trim() });
        if (!nameRes.success) {
          toast.error(nameRes.message || "Could not update name.");
          setSaving(false);
          return;
        }
      }
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
        panNumber: pan,
        gstNumber: gst,
      });
      if (res.success && res.data) {
        onSaved({ ...res.data, name: name.trim() });
        toast.success("Profile updated.");
      } else {
        toast.error(res.message || "Could not save.");
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not save your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pb-10">
        <ExpertPhotoUpload
          currentPhotoUrl={photoUrl || undefined}
          onPhotoReady={(url, key) => {
            setPhotoUrl(url);
            setPhotoKey(key);
          }}
        />
        <div className="min-w-0">
          <p className="text-ink text-lg font-medium">{name || "Expert"}</p>
          {profile.email && <p className="text-ink-body text-sm">{profile.email}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusTag tone={profile.isActive ? "live" : "neutral"}>
              {profile.isActive ? "Live" : "Inactive"}
            </StatusTag>
            <span className="text-ink-body text-sm tabular-nums">
              {profile.reviewCount
                ? `${(profile.rating || 0).toFixed(1)} from ${profile.reviewCount} reviews`
                : "No reviews yet"}
            </span>
            {profile.id && (
              <Link href={`/experts/${profile.id}`} target="_blank" className={ACTION}>
                View public profile
                <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <ProfileSection id="about" title="About you" description="Shown on your public profile.">
        <div className="max-w-2xl space-y-5">
          <div>
            <label htmlFor="expert-name" className={FIELD_LABEL}>
              Name
            </label>
            <input
              id="expert-name"
              className={FIELD_INPUT}
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="expert-bio" className={FIELD_LABEL}>
              Bio
            </label>
            <textarea
              id="expert-bio"
              rows={5}
              className={FIELD_INPUT}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={4000}
            />
            <p className={cn(FIELD_HINT, "tabular-nums")}>
              At least 20 characters. {bio.length} of 4000.
            </p>
          </div>
          <div>
            <label htmlFor="expert-achievements" className={FIELD_LABEL}>
              Achievements
            </label>
            <textarea
              id="expert-achievements"
              rows={3}
              className={FIELD_INPUT}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="expert-city" className={FIELD_LABEL}>
              City
            </label>
            <input
              id="expert-city"
              className={cn(FIELD_INPUT, "md:max-w-xs")}
              value={city}
              autoComplete="address-level2"
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>
      </ProfileSection>

      <ProfileSection
        id="expertise"
        title="Expertise"
        description="Helps parents find and trust you."
      >
        <div className="max-w-2xl space-y-6">
          <div>
            <p className={FIELD_LABEL}>Sports</p>
            <SportsMultiSelect
              value={sports}
              onChange={setSports}
              allowedSports={SUPPORTED_SPORT_NAMES}
            />
          </div>
          <div>
            <p className={FIELD_LABEL}>Expertise</p>
            <ExpertiseMultiSelect value={expertise} onChange={setExpertise} />
          </div>
          <div>
            <p className={FIELD_LABEL}>Languages</p>
            <LanguagesMultiSelect value={languages} onChange={setLanguages} />
          </div>
        </div>
      </ProfileSection>

      <ProfileSection
        id="session-settings"
        title="Session settings"
        description="Your fee, the format and the length of a session."
      >
        <div className="max-w-2xl space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="expert-fee" className={FIELD_LABEL}>
                Session fee (₹)
              </label>
              <input
                id="expert-fee"
                type="number"
                inputMode="numeric"
                min="0"
                className={cn(FIELD_INPUT, "tabular-nums")}
                value={sessionFee}
                onChange={(e) => setSessionFee(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="expert-length" className={FIELD_LABEL}>
                Session length
              </label>
              <select
                id="expert-length"
                className={FIELD_INPUT}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                {[30, 45, 60, 75, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className={FIELD_LABEL}>How you hold sessions</p>
            <UnderlineFilter
              label="Session mode"
              value={sessionMode}
              onChange={setSessionMode}
              items={[
                { label: "Online", value: "ONLINE" },
                { label: "In person", value: "IN_PERSON" },
                { label: "Both", value: "BOTH" },
              ]}
            />
          </div>

          {(sessionMode === "IN_PERSON" || sessionMode === "BOTH") && (
            <div>
              <label htmlFor="expert-address" className={FIELD_LABEL}>
                In-person location
              </label>
              <input
                id="expert-address"
                className={FIELD_INPUT}
                placeholder="For example, 2nd Floor, ABC Sports Complex, Sector 15, Chandigarh"
                value={inPersonAddress}
                onChange={(e) => setInPersonAddress(e.target.value)}
              />
              <p className={FIELD_HINT}>Shown to a parent only after they have booked you.</p>
            </div>
          )}
        </div>
      </ProfileSection>

      <ProfileSection
        id="availability"
        title="Weekly availability"
        description="Parents can only book times inside these windows."
      >
        <ul className="border-hairline border-t">
          {DAY_NAMES.map((day, dayIdx) => {
            const dayWindows = windows
              .map((w, i) => ({ w, i }))
              .filter(({ w }) => w.dayOfWeek === dayIdx);
            return (
              <li
                key={day}
                className="border-hairline grid gap-x-6 gap-y-2 border-b py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                <p className="text-ink flex min-h-11 items-center self-start text-sm font-medium">
                  {day}
                </p>
                <div className="space-y-2">
                  {dayWindows.length === 0 && (
                    <p className="text-ink-body flex min-h-11 items-center text-sm">Unavailable</p>
                  )}
                  {dayWindows.map(({ w, i }) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <input
                        type="time"
                        aria-label={`${day}, window ${i + 1} starts`}
                        value={w.start}
                        onChange={(e) => updateWindow(i, { start: e.target.value })}
                        className={TIME_INPUT}
                      />
                      <span className="text-ink-body text-sm">to</span>
                      <input
                        type="time"
                        aria-label={`${day}, window ${i + 1} ends`}
                        value={w.end}
                        onChange={(e) => updateWindow(i, { end: e.target.value })}
                        className={TIME_INPUT}
                      />
                      <button
                        type="button"
                        onClick={() => removeWindow(i)}
                        aria-label={`Remove ${day} window`}
                        className={ACTION}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addWindow(dayIdx)}
                    aria-label={`Add a ${day} window`}
                    className={ACTION}
                  >
                    Add a window
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </ProfileSection>

      <ProfileSection
        id="blackout"
        title="Days off"
        description="Days you are unavailable even if they fall inside your weekly hours."
      >
        <div className="max-w-2xl">
          {blackout.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Days off">
              {blackout.map((d) => (
                <li
                  key={d}
                  className="border-hairline bg-paper-deep text-ink flex min-h-11 items-center gap-1 rounded-md border pl-3 text-sm font-medium tabular-nums"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => setBlackout((b) => b.filter((x) => x !== d))}
                    aria-label={`Remove ${d}`}
                    className="text-ink-body hover:text-ink focus-visible:ring-ink inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
                  >
                    <X size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label htmlFor="expert-day-off" className="sr-only">
              Add a day off
            </label>
            <input
              id="expert-day-off"
              type="date"
              value={newBlackout}
              onChange={(e) => setNewBlackout(e.target.value)}
              className={cn(FIELD_INPUT, "w-auto")}
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={!newBlackout}
              onClick={() => {
                if (newBlackout && !blackout.includes(newBlackout)) {
                  setBlackout((b) => [...b, newBlackout].sort());
                  setNewBlackout("");
                }
              }}
            >
              Add day off
            </Button>
          </div>
        </div>
      </ProfileSection>

      <ProfileSection
        id="tax"
        title="Tax details"
        description="Used for session-fee payouts and tax reporting."
      >
        <div className="max-w-2xl">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="expert-pan" className={FIELD_LABEL}>
                PAN number
              </label>
              <input
                id="expert-pan"
                className={cn(FIELD_INPUT, "font-mono uppercase tracking-wider")}
                value={panNumber}
                maxLength={10}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              />
              <p className={FIELD_HINT}>Five letters, four digits, one letter.</p>
            </div>
            <div>
              <label htmlFor="expert-gst" className={FIELD_LABEL}>
                GST number <span className="text-ink-body font-normal">(optional)</span>
              </label>
              <input
                id="expert-gst"
                className={cn(FIELD_INPUT, "font-mono uppercase tracking-wider")}
                value={gstNumber}
                maxLength={15}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              />
              <p className={FIELD_HINT}>Only if you are GST-registered.</p>
            </div>
          </div>
          <p className="text-ink-body mt-5 text-sm">
            Your bank account or UPI ID is managed on the{" "}
            <Link href="/expert/payouts" className={`${TEXT_LINK} ring-offset-paper`}>
              Payouts
            </Link>{" "}
            page.
          </p>
        </div>
      </ProfileSection>

      <div className="bg-paper border-hairline sticky bottom-0 z-10 flex justify-end border-t py-4">
        <Button onClick={save} loading={saving} className="min-h-11">
          Save changes
        </Button>
      </div>
    </div>
  );
}
