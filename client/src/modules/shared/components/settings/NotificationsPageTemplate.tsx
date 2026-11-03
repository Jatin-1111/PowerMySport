"use client";

import { PushNotificationPermission } from "../PushNotificationPermission";
import { Checkbox } from "../../ui/Checkbox";
import {
  notificationApi,
  NotificationChannelPreferences,
  NotificationPreferences,
} from "@/lib/api/notification";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { ProfileSection } from "./ProfileSection";

interface NotificationType {
  key: keyof NotificationChannelPreferences;
  label: string;
  description: string;
  category: string;
}

const notificationTypes: NotificationType[] = [
  // Social Notifications
  {
    key: "friendRequests",
    label: "Friend requests",
    description: "Get notified when someone sends you a friend request",
    category: "Social",
  },

  // Booking Notifications
  {
    key: "bookingInvitations",
    label: "Booking invitations",
    description: "Get notified when you're invited to join a booking",
    category: "Bookings",
  },
  {
    key: "bookingConfirmations",
    label: "Booking confirmations",
    description: "Get notified when your booking is confirmed",
    category: "Bookings",
  },
  {
    key: "bookingReminders",
    label: "Booking reminders",
    description: "Get reminders about upcoming bookings",
    category: "Bookings",
  },
  {
    key: "bookingCancellations",
    label: "Booking cancellations",
    description: "Get notified when a booking is cancelled",
    category: "Bookings",
  },

  // Reviews
  {
    key: "reviews",
    label: "Reviews",
    description: "Get notified about reviews and ratings",
    category: "Reviews and feedback",
  },

  // Payments
  {
    key: "payments",
    label: "Payments",
    description: "Get notified about payment confirmations and receipts",
    category: "Payments",
  },

  // Rankings
  {
    key: "rankingUpdates",
    label: "Ranking updates",
    description:
      "Get the weekly update when a new list is published for a player whose ranking you have linked",
    category: "Rankings",
  },

  // Admin
  {
    key: "admin",
    label: "Account and admin updates",
    description: "Get notified about account updates and administrative actions",
    category: "Administrative",
  },

  // Marketing
  {
    key: "marketing",
    label: "Marketing and promotions",
    description: "Get notified about new features, tips, and special offers",
    category: "Marketing",
  },
];

const groupedNotifications = notificationTypes.reduce(
  (acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  },
  {} as Record<string, NotificationType[]>
);

export function NotificationsPageTemplate({ backUrl = "/settings" }: { backUrl?: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {},
    push: {},
    inApp: {},
  });
  const [originalPreferences, setOriginalPreferences] = useState<NotificationPreferences | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }

    const fetchPreferences = async () => {
      try {
        const response = await notificationApi.getPreferences();
        const prefs = response.data || { email: {}, push: {}, inApp: {} };
        setPreferences(prefs);
        setOriginalPreferences(prefs);
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
        toast.error("Failed to load notification preferences");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleToggle = (
    channel: "email" | "push" | "inApp",
    key: keyof NotificationChannelPreferences,
    value: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationApi.updatePreferences(preferences);
      setOriginalPreferences(preferences);
      toast.success("Preferences saved");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalPreferences) {
      setPreferences(originalPreferences);
    }
  };

  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  if (!user) {
    return null;
  }

  const channels = [
    { key: "email", label: "Email" },
    { key: "push", label: "Push" },
    { key: "inApp", label: "In-app" },
  ] as const;

  const header = (
    <header>
      <p>
        <Link href={backUrl} className={`${TEXT_LINK} ring-offset-paper text-sm`}>
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          Back to settings
        </Link>
      </p>
      <h1 className="font-editorial text-ink mt-6 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
        Notification preferences
      </h1>
      <p className="text-ink-body mt-3 max-w-[56ch] text-pretty">
        Choose how each kind of update reaches you.
      </p>
    </header>
  );

  if (loading) {
    return (
      <div className="space-y-10" role="status" aria-busy="true">
        {header}
        <span className="sr-only">Loading your preferences</span>
        <div aria-hidden="true" className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div>
        <PushNotificationPermission />

        <ProfileSection
          id="preferences"
          title="Preferences"
          description={`Email goes to ${user.email}. In-app updates appear under the bell.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-hairline border-b">
                  <th scope="col" className="text-ink-body py-3 pr-4 text-left font-medium">
                    Notify me about
                  </th>
                  {channels.map((channel) => (
                    <th
                      key={channel.key}
                      scope="col"
                      className="text-ink-body w-20 px-2 py-3 text-center font-medium"
                    >
                      {channel.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedNotifications).map(([category, types]) => (
                  <React.Fragment key={category}>
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={4}
                        className="text-ink pb-1 pt-6 text-left text-sm font-semibold"
                      >
                        {category}
                      </th>
                    </tr>
                    {types.map((type) => (
                      <tr key={type.key} className="border-hairline border-b">
                        <th scope="row" className="py-3 pr-4 text-left font-normal">
                          <span className="text-ink block font-medium">{type.label}</span>
                          <span className="text-ink-body block text-sm">{type.description}</span>
                        </th>
                        {channels.map((channel) => (
                          <td key={channel.key} className="px-2 py-1 text-center">
                            <label className="mx-auto flex h-11 w-11 cursor-pointer items-center justify-center">
                              <Checkbox
                                aria-label={`${type.label} by ${channel.label.toLowerCase()}`}
                                checked={preferences[channel.key]?.[type.key] ?? true}
                                onCheckedChange={(checked) =>
                                  handleToggle(channel.key, type.key, checked)
                                }
                              />
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-ink-body mt-6 max-w-[60ch] text-pretty text-sm">
            Some updates, such as security alerts, cannot be turned off and are always sent.
          </p>
        </ProfileSection>
      </div>

      {hasChanges && (
        <div className="bg-paper border-hairline sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t py-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50`}
          >
            Discard changes
          </button>
          <Button onClick={handleSave} disabled={saving} className="min-h-11">
            {saving ? "Saving" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
