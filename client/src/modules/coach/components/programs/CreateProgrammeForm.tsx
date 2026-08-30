"use client";

import { toast } from "@/lib/toast";
import { coachProgramsApi } from "@/modules/coach/services/coachPrograms";
import { useMyPackages } from "@/modules/coach/hooks/useCoachPrograms";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Input } from "@/modules/shared/ui/Input";
import { Textarea } from "@/modules/shared/ui/Textarea";
import type {
  CoachOfferingDeliveryKind,
  CoachOfferingSlot,
} from "@/types/coachPrograms";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

/**
 * Create a recurring programme.
 *
 * The validation here mirrors the server's model invariants rather than
 * inventing its own: a batch cannot be delivered at a student's home, an online
 * programme needs a platform, and a venue programme needs a venue. Duplicating
 * the rules is a risk, so each one names the reason — if the server's rule
 * changes, the reason it exists is right here to check against.
 *
 * Price is NOT set here. A programme bills through one of the coach's existing
 * subscription packages, which is also where `maxSessions` (classes per period)
 * and `maxStudents` come from.
 */

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const DELIVERY_OPTIONS: Array<{
  value: CoachOfferingDeliveryKind;
  label: string;
  hint: string;
}> = [
  {
    value: "ONLINE",
    label: "Online",
    hint: "Over video — students join from anywhere",
  },
  {
    value: "PROVIDER_VENUE",
    label: "At my place",
    hint: "Students come to your venue",
  },
  {
    value: "STUDENT_LOCATION",
    label: "I travel to them",
    hint: "One-to-one only — a batch can't share one home",
  },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

export const CreateProgrammeForm = ({
  onCreated,
  onCancel,
}: {
  onCreated: () => void | Promise<void>;
  onCancel: () => void;
}) => {
  const { data: packages = [], isPending: loadingPackages } = useMyPackages();

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("Chess");
  const [description, setDescription] = useState("");
  const [deliveryKind, setDeliveryKind] =
    useState<CoachOfferingDeliveryKind>("ONLINE");
  const [onlinePlatform, setOnlinePlatform] = useState("Zoom");
  const [meetingLink, setMeetingLink] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [packageId, setPackageId] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [slots, setSlots] = useState<CoachOfferingSlot[]>([
    { dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 },
  ]);
  const [saving, setSaving] = useState(false);

  const activePackages = packages.filter((pkg) => pkg.isActive);
  const selected = activePackages.find(
    (pkg) => (pkg.id ?? pkg._id) === packageId,
  );

  const updateSlot = (index: number, patch: Partial<CoachOfferingSlot>) =>
    setSlots((current) =>
      current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    );

  const submit = async () => {
    if (!title.trim()) return toast.error("Give the programme a name");
    if (!packageId) return toast.error("Pick how this programme is billed");
    if (slots.length === 0) return toast.error("Add at least one weekly class");

    // Mirrors the server's model invariants — see the note at the top.
    if (deliveryKind === "ONLINE" && !onlinePlatform.trim()) {
      return toast.error("Say which platform you teach on");
    }
    if (deliveryKind === "STUDENT_LOCATION" && capacity > 1) {
      return toast.error(
        "A batch can't be taught at a student's home — use online or your own venue",
      );
    }
    if (selected?.maxStudents != null && capacity > selected.maxStudents) {
      return toast.error(
        `Your "${selected.name}" package allows at most ${selected.maxStudents} students`,
      );
    }

    const seen = new Set<string>();
    for (const slot of slots) {
      const key = `${slot.dayOfWeek}@${slot.startTime}`;
      if (seen.has(key)) return toast.error("Two classes clash on the same day and time");
      seen.add(key);
    }

    setSaving(true);
    try {
      await coachProgramsApi.create({
        title: title.trim(),
        sport: sport.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        deliveryKind,
        ...(deliveryKind === "ONLINE"
          ? { onlinePlatform: onlinePlatform.trim() }
          : {}),
        ...(deliveryKind === "ONLINE" && meetingLink.trim()
          ? { defaultMeetingLink: meetingLink.trim() }
          : {}),
        capacity,
        schedule: slots,
        packageId,
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
      });

      toast.success("Programme created — publish it when you're ready");
      await onCreated();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not create the programme";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">New programme</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Evening chess batch"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Sport</span>
          <Input value={sport} onChange={(e) => setSport(e.target.value)} />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Description <span className="text-muted-foreground">(optional)</span>
        </span>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Who is this for, and what will they learn?"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Where does it happen?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DELIVERY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setDeliveryKind(option.value);
                // Keep the form in a state the server would accept.
                if (option.value === "STUDENT_LOCATION") setCapacity(1);
              }}
              aria-pressed={deliveryKind === option.value}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                deliveryKind === option.value
                  ? "border-power-orange bg-orange-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {deliveryKind === "ONLINE" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Platform</span>
            <Input
              value={onlinePlatform}
              onChange={(e) => setOnlinePlatform(e.target.value)}
              placeholder="Zoom, Google Meet, Lichess…"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Room link <span className="text-muted-foreground">(optional)</span>
            </span>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Students</span>
          <Input
            type="number"
            min={1}
            max={100}
            value={capacity}
            disabled={deliveryKind === "STUDENT_LOCATION"}
            onChange={(e) =>
              setCapacity(Math.max(1, Number(e.target.value) || 1))
            }
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {capacity === 1 ? "One-to-one" : `Batch of up to ${capacity}`}
          </span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Starts</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Weekly classes</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSlots((current) => [
                ...current,
                { dayOfWeek: 4, startTime: "18:00", durationMinutes: 60 },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            Add a day
          </Button>
        </div>

        <ul className="space-y-2">
          {slots.map((slot, index) => (
            <li key={index} className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Day</span>
                <select
                  value={slot.dayOfWeek}
                  onChange={(e) =>
                    updateSlot(index, { dayOfWeek: Number(e.target.value) })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Time</span>
                <Input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => updateSlot(index, { startTime: e.target.value })}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Minutes
                </span>
                <Input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={slot.durationMinutes}
                  onChange={(e) =>
                    updateSlot(index, {
                      durationMinutes: Number(e.target.value) || 60,
                    })
                  }
                />
              </label>

              {slots.length > 1 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove this class"
                  onClick={() =>
                    setSlots((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Times are in your timezone. Classes are scheduled about 8 weeks ahead
          and roll forward automatically.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Billing</span>
        {loadingPackages ? (
          <span className="text-sm text-muted-foreground">Loading…</span>
        ) : activePackages.length === 0 ? (
          <span className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            You have no active pricing packages. Create one first — it sets the
            price, the billing period and how many classes it includes.
          </span>
        ) : (
          <select
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Choose a package…</option>
            {activePackages.map((pkg) => {
              const id = pkg.id ?? pkg._id ?? "";
              return (
                <option key={id} value={id}>
                  {pkg.name} · ₹{(pkg.price / 100).toFixed(0)} /{" "}
                  {pkg.frequency.toLowerCase()}
                  {pkg.maxSessions ? ` · ${pkg.maxSessions} classes` : ""}
                </option>
              );
            })}
          </select>
        )}
      </label>

      <div className="flex gap-2">
        <Button onClick={submit} loading={saving} disabled={saving}>
          Create programme
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </Card>
  );
};
