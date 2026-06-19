"use client";

import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import axiosInstance from "@/lib/api/axios";
import { motion } from "framer-motion";
import { Bell, Clock, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

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

  const intervalItems = [
    {
      key: "twentyFourHours" as const,
      label: "24 hours before",
      description: "A day in advance — great for planning ahead",
      icon: "🗓️",
    },
    {
      key: "oneHour" as const,
      label: "1 hour before",
      description: "An hour in advance — time to get ready",
      icon: "⏰",
    },
    {
      key: "fifteenMinutes" as const,
      label: "15 minutes before",
      description: "Last-minute heads up — just before the session",
      icon: "🔔",
    },
  ];

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

      <Card className="shop-surface premium-shadow overflow-hidden p-0">
        <ProfileSectionHeader
          icon={Bell}
          title="Booking Reminders"
          description="Receive push notifications before your upcoming sessions."
          action={
            <label className="relative inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={bookingReminders.enabled}
                onChange={(e) => toggleEnabled(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
                  bookingReminders.enabled ? "bg-power-orange" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    bookingReminders.enabled
                      ? "translate-x-5"
                      : "translate-x-0"
                  }`}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                {bookingReminders.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          }
        />

        <CardContent className="px-6 py-6 space-y-4">
          {bookingReminders.enabled ? (
            <>
              <p className="text-sm font-semibold text-slate-700">
                Remind me before a booking:
              </p>
              <div className="space-y-3">
                {intervalItems.map(({ key, label, description, icon }) => {
                  const isChecked = bookingReminders.intervals[key];
                  return (
                    <motion.label
                      key={key}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all",
                        isChecked
                          ? "border-power-orange/30 bg-orange-50/50"
                          : "border-slate-200/70 bg-slate-50/40 hover:border-slate-300 hover:bg-white",
                      )}
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg",
                            isChecked
                              ? "bg-power-orange/10"
                              : "bg-slate-100",
                          )}
                        >
                          {icon}
                        </div>
                        <div>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              isChecked ? "text-slate-900" : "text-slate-700",
                            )}
                          >
                            {label}
                          </p>
                          <p className="text-xs text-slate-500">
                            {description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isChecked && (
                          <CheckCircle className="h-4 w-4 text-power-orange" />
                        )}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleInterval(key, e.target.checked)}
                          className="h-4 w-4 cursor-pointer accent-power-orange"
                        />
                      </div>
                    </motion.label>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center">
              <Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                Booking reminders are currently disabled.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Toggle the switch above to enable notifications.
              </p>
            </div>
          )}

          <div className="flex justify-end border-t border-slate-200/60 pt-4">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
