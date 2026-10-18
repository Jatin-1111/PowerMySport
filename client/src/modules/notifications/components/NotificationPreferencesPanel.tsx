"use client";

import type {
  NotificationChannelPreferences,
  NotificationPreferences,
} from "@/lib/api/notification";
import { cn } from "@/utils/cn";
import { Loader2, X } from "lucide-react";

const preferenceKeys: Array<{
  key: keyof NotificationChannelPreferences;
  label: string;
}> = [
  { key: "friendRequests", label: "Friend requests" },
  { key: "bookingInvitations", label: "Booking invitations" },
  { key: "bookingConfirmations", label: "Booking confirmations" },
  { key: "bookingReminders", label: "Booking reminders" },
  { key: "reviews", label: "Reviews" },
  { key: "payments", label: "Payments" },
  { key: "admin", label: "Admin updates" },
  { key: "marketing", label: "Marketing" },
];

const channels = ["inApp", "push", "email"] as const;
const channelLabels = { inApp: "In-app", push: "Push", email: "Email" };

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "focus-visible:ring-ink relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        checked ? "bg-ink" : "bg-ink-ash"
      )}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export function NotificationPreferencesPanel({
  preferences,
  isSaving,
  onClose,
  onToggle,
}: {
  preferences: NotificationPreferences;
  isSaving: boolean;
  onClose: () => void;
  onToggle: (
    channel: "email" | "push" | "inApp",
    key: keyof NotificationChannelPreferences
  ) => void;
}) {
  return (
    <section
      aria-labelledby="notification-preferences"
      className="border-hairline mb-8 rounded-2xl border bg-white"
    >
      <div className="border-hairline flex items-center justify-between border-b px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <h2
            id="notification-preferences"
            className="font-editorial text-ink text-xl font-light sm:text-2xl"
          >
            Preferences
          </h2>
          {isSaving && (
            <span className="text-ink-muted flex items-center gap-1 text-sm" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preferences"
          className="text-ink-muted hover:bg-paper-deep hover:text-ink focus-visible:ring-ink rounded-md p-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="border-hairline border-b">
              <th scope="col" className="text-ink-muted px-4 py-3 text-left font-medium sm:px-6">
                Notify me about
              </th>
              {channels.map((ch) => (
                <th
                  key={ch}
                  scope="col"
                  className="text-ink-muted whitespace-nowrap px-4 py-3 text-center font-medium"
                >
                  {channelLabels[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-hairline divide-y">
            {preferenceKeys.map((pref) => (
              <tr key={pref.key}>
                <th scope="row" className="text-ink px-4 py-3.5 text-left font-normal sm:px-6">
                  {pref.label}
                </th>
                {channels.map((ch) => (
                  <td key={ch} className="px-4 py-3.5">
                    <div className="flex justify-center">
                      <Toggle
                        checked={Boolean(preferences[ch]?.[pref.key])}
                        onChange={() => onToggle(ch, pref.key)}
                        label={`${pref.label} by ${channelLabels[ch].toLowerCase()}`}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
