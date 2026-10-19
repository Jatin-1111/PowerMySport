"use client";

import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
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
  const [preferences, setPreferences] = useState<ReminderPreferences>(defaultPreferences);
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
        preferences
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
    value: boolean
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
          items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reminder preferences" }]}
        />
        <PlayerPageHeader
          badge="Player"
          title="Reminder preferences"
          subtitle="Control when and how you receive booking reminders."
        />
        <ListSkeleton count={3} />
      </div>
    );
  }

  const { bookingReminders } = preferences;

  const intervalItems = [
    {
      key: "twentyFourHours" as const,
      label: "24 hours before",
      description: "A day in advance, good for planning ahead",
    },
    {
      key: "oneHour" as const,
      label: "1 hour before",
      description: "An hour in advance, time to get ready",
    },
    {
      key: "fifteenMinutes" as const,
      label: "15 minutes before",
      description: "A last-minute heads up, just before the session",
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reminder preferences" }]}
      />

      <PlayerPageHeader
        badge="Player"
        title="Reminder preferences"
        subtitle="Control when and how you receive booking reminders."
      />

      <Card className="overflow-hidden p-0">
        <ProfileSectionHeader
          icon={Bell}
          title="Booking reminders"
          description="Receive push notifications before your upcoming sessions."
          action={
            <label className="relative inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={bookingReminders.enabled}
                onChange={(e) => toggleEnabled(e.target.checked)}
                role="switch"
                className="peer sr-only"
              />
              <div
                className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${
                  bookingReminders.enabled ? "bg-ink" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    bookingReminders.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
              <span className="text-ink text-sm font-medium">
                {bookingReminders.enabled ? "On" : "Off"}
              </span>
            </label>
          }
        />

        <CardContent className="space-y-4 px-6 py-6">
          {bookingReminders.enabled ? (
            <fieldset>
              <legend className="text-ink mb-1 text-base font-medium">
                Remind me before a booking
              </legend>
              <ul className="border-hairline divide-hairline divide-y border-y">
                {intervalItems.map(({ key, label, description }) => {
                  const isChecked = bookingReminders.intervals[key];
                  return (
                    <li key={key}>
                      <label className="hover:bg-paper-deep/60 flex cursor-pointer items-center justify-between gap-4 px-1 py-4 transition-colors">
                        <span>
                          <span className="text-ink block font-medium">{label}</span>
                          <span className="text-ink-muted block text-sm">{description}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleInterval(key, e.target.checked)}
                          className="accent-ink h-5 w-5 shrink-0 cursor-pointer"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <EmptyState
              icon={Bell}
              title="Reminders are off"
              description="Switch booking reminders on above to be told before your sessions."
            />
          )}

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSave} disabled={isSaving} loading={isSaving}>
              {isSaving ? "Saving" : "Save preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
