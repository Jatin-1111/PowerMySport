"use client";

import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import axiosInstance from "@/lib/api/axios";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

interface ReminderPreferences {
  bookingReminders: {
    enabled: boolean;
    intervals: {
      twentyFourHours: boolean;
      oneHour: boolean;
      fifteenMinutes: boolean;
    };
  };
}

const defaultPreferences: ReminderPreferences = {
  bookingReminders: {
    enabled: true,
    intervals: {
      twentyFourHours: true,
      oneHour: true,
      fifteenMinutes: true,
    },
  },
};

export default function ReminderPreferencesPage() {
  const [preferences, setPreferences] =
    useState<ReminderPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get<{
          success: boolean;
          data: ReminderPreferences;
        }>("/reminders/preferences");
        if (response.data.success && response.data.data) {
          setPreferences(response.data.data);
        }
      } catch {
        toast.error("Failed to load reminder preferences");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await axiosInstance.patch<{ success: boolean }>(
        "/reminders/preferences",
        preferences,
      );
      if (response.data.success) {
        toast.success("Reminder preferences saved");
      }
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = (enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      bookingReminders: { ...prev.bookingReminders, enabled },
    }));
  };

  const toggleInterval = (
    interval: keyof ReminderPreferences["bookingReminders"]["intervals"],
    value: boolean,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      bookingReminders: {
        ...prev.bookingReminders,
        intervals: { ...prev.bookingReminders.intervals, [interval]: value },
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Reminder Preferences" },
          ]}
        />
        <PlayerPageHeader
          badge="Player"
          title="Reminder Preferences"
          subtitle="Control when and how you receive booking reminders."
        />
        <ListSkeleton count={3} />
      </div>
    );
  }

  const { bookingReminders } = preferences;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reminder Preferences" },
        ]}
      />

      <PlayerPageHeader
        badge="Player"
        title="Reminder Preferences"
        subtitle="Control when and how you receive booking reminders."
      />

      <Card className="bg-white space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-power-orange/10 p-2">
            <Bell className="h-5 w-5 text-power-orange" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Booking Reminders
            </h2>
            <p className="text-sm text-slate-500">
              Receive notifications before your upcoming sessions.
            </p>
          </div>
          <div className="ml-auto">
            <label className="relative inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={bookingReminders.enabled}
                onChange={(e) => toggleEnabled(e.target.checked)}
                className="sr-only"
              />
              <div
                onClick={() => toggleEnabled(!bookingReminders.enabled)}
                className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
                  bookingReminders.enabled ? "bg-power-orange" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    bookingReminders.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-slate-700">
                {bookingReminders.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
        </div>

        {bookingReminders.enabled && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Remind me before a booking:
            </p>
            {(
              [
                {
                  key: "twentyFourHours" as const,
                  label: "24 hours before",
                  description: "A day in advance",
                },
                {
                  key: "oneHour" as const,
                  label: "1 hour before",
                  description: "An hour in advance",
                },
                {
                  key: "fifteenMinutes" as const,
                  label: "15 minutes before",
                  description: "Just before the session",
                },
              ] as const
            ).map(({ key, label, description }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-transparent bg-white px-4 py-3 transition hover:border-slate-200"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={bookingReminders.intervals[key]}
                  onChange={(e) => toggleInterval(key, e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-power-orange"
                />
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
