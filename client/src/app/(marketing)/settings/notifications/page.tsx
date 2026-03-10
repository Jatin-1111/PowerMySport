"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Checkbox } from "@/components/ui/checkbox";
import { PushNotificationPermission } from "@/components/layout/PushNotificationPermission";
import {
  notificationApi,
  NotificationPreferences,
  NotificationChannelPreferences,
} from "@/lib/api/notification";
import {
  Bell,
  Mail,
  Smartphone,
  MonitorSmartphone,
  Save,
  Lightbulb,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

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
    label: "Friend Requests",
    description: "Get notified when someone sends you a friend request",
    category: "Social",
  },

  // Booking Notifications
  {
    key: "bookingInvitations",
    label: "Booking Invitations",
    description: "Get notified when you're invited to join a booking",
    category: "Bookings",
  },
  {
    key: "bookingConfirmations",
    label: "Booking Confirmations",
    description: "Get notified when your booking is confirmed",
    category: "Bookings",
  },
  {
    key: "bookingReminders",
    label: "Booking Reminders",
    description: "Get reminders about upcoming bookings",
    category: "Bookings",
  },
  {
    key: "bookingCancellations",
    label: "Booking Cancellations",
    description: "Get notified when a booking is cancelled",
    category: "Bookings",
  },

  // Reviews
  {
    key: "reviews",
    label: "Reviews",
    description: "Get notified about reviews and ratings",
    category: "Reviews & Feedback",
  },

  // Payments
  {
    key: "payments",
    label: "Payments",
    description: "Get notified about payment confirmations and receipts",
    category: "Payments",
  },

  // Admin
  {
    key: "admin",
    label: "Administrative",
    description:
      "Get notified about account updates and administrative actions",
    category: "Administrative",
  },

  // Marketing
  {
    key: "marketing",
    label: "Marketing & Promotions",
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
  {} as Record<string, NotificationType[]>,
);

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {},
    push: {},
    inApp: {},
  });
  const [originalPreferences, setOriginalPreferences] =
    useState<NotificationPreferences | null>(null);
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
    value: boolean,
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
      toast.success("Notification preferences saved successfully");
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

  const hasChanges =
    JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Notification Preferences
          </h1>
          <p className="mt-2 text-slate-600">Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-power-orange/30 bg-power-orange/10 px-3 py-1 text-sm text-power-orange">
          <Bell size={14} />
          Notification Settings
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          Notification Preferences
        </h1>
        <p className="mt-2 text-slate-600">
          Choose how you want to receive notifications for different types of
          activity.
        </p>
        <div className="mt-4">
          <Link
            href="/settings"
            className="text-sm text-power-orange hover:underline"
          >
            ← Back to Settings
          </Link>
        </div>
      </div>

      {/* Channel Legend */}
      <Card className="mb-6 bg-white">
        <div className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            Notification Channels
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 text-power-orange" size={18} />
              <div>
                <h4 className="text-sm font-medium text-slate-900">Email</h4>
                <p className="text-xs text-slate-600">Sent to {user.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 text-power-orange" size={18} />
              <div>
                <h4 className="text-sm font-medium text-slate-900">Push</h4>
                <p className="text-xs text-slate-600">
                  Mobile & browser notifications
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MonitorSmartphone
                className="mt-0.5 text-power-orange"
                size={18}
              />
              <div>
                <h4 className="text-sm font-medium text-slate-900">In-App</h4>
                <p className="text-xs text-slate-600">
                  Notification center bell
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Push Notification Permission Request */}
      <div className="mb-6">
        <PushNotificationPermission />
      </div>

      {/* Notification Preferences Table */}
      <Card className="bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Notification Type
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-slate-900">
                  <Mail size={16} className="mx-auto text-slate-600" />
                  <span className="mt-1 block text-xs">Email</span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-slate-900">
                  <Smartphone size={16} className="mx-auto text-slate-600" />
                  <span className="mt-1 block text-xs">Push</span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-slate-900">
                  <MonitorSmartphone
                    size={16}
                    className="mx-auto text-slate-600"
                  />
                  <span className="mt-1 block text-xs">In-App</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedNotifications).map(
                ([category, types], categoryIndex) => (
                  <React.Fragment key={category}>
                    {/* Category Header */}
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td
                        colSpan={4}
                        className="px-6 py-3 text-sm font-semibold text-slate-900"
                      >
                        {category}
                      </td>
                    </tr>
                    {/* Notification Types in Category */}
                    {types.map((type, typeIndex) => (
                      <tr
                        key={type.key}
                        className={
                          typeIndex === types.length - 1 &&
                          categoryIndex ===
                            Object.keys(groupedNotifications).length - 1
                            ? ""
                            : "border-b border-slate-100"
                        }
                      >
                        <td className="px-6 py-4">
                          <div>
                            <h4 className="text-sm font-medium text-slate-900">
                              {type.label}
                            </h4>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {type.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={preferences.email?.[type.key] ?? true}
                              onCheckedChange={(checked) =>
                                handleToggle("email", type.key, checked)
                              }
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={preferences.push?.[type.key] ?? true}
                              onCheckedChange={(checked) =>
                                handleToggle("push", type.key, checked)
                              }
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={preferences.inApp?.[type.key] ?? true}
                              onCheckedChange={(checked) =>
                                handleToggle("inApp", type.key, checked)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ),
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Save Actions */}
      {hasChanges && (
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <X size={16} className="mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save size={16} className="mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Info Banner */}
      <Card className="mt-6 border-l-4 border-l-power-orange bg-white">
        <div className="p-6">
          <h3 className="text-sm font-semibold text-slate-900">
            <span className="inline-flex items-center gap-2">
              <Lightbulb size={15} /> About Notification Preferences
            </span>
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>
              • <strong>Email:</strong> Notifications sent to your registered
              email address
            </li>
            <li>
              • <strong>Push:</strong> Real-time notifications on your mobile
              device or browser (requires permission)
            </li>
            <li>
              • <strong>In-App:</strong> Notifications visible in the bell icon
              notification center
            </li>
            <li className="mt-3 text-xs text-slate-500">
              Note: Some critical notifications (e.g., security alerts) cannot
              be disabled and will always be sent.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
