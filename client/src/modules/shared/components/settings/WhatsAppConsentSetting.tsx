"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { ProfileSection } from "./ProfileSection";
import { useEffect, useState } from "react";

/**
 * The switch for WhatsApp updates. Off unless the person turned it on, here or
 * when signing up. Replying STOP to us on WhatsApp turns it off too, so the
 * state is read from the server instead of being remembered in the browser.
 */
export function WhatsAppConsentSetting() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .getWhatsAppConsent()
      .then((state) => {
        if (!cancelled) setGranted(state.granted);
      })
      .catch(() => {
        if (!cancelled) setGranted(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    if (granted === null || saving) return;
    const next = !granted;
    setSaving(true);
    try {
      const state = await authApi.setWhatsAppConsent(next);
      setGranted(state.granted);
      toast.success(next ? "WhatsApp updates are on." : "WhatsApp updates are off.");
    } catch {
      toast.error("We could not save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileSection
      id="whatsapp"
      title="WhatsApp"
      description="Updates about your bookings and expert sessions, on the app you already use."
    >
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="max-w-xl">
          <h3 id="whatsapp-consent-label" className="text-ink font-medium">
            Booking and session updates on WhatsApp
          </h3>
          <p className="text-ink-body mt-1 text-pretty text-sm">
            Get a message when a booking or an expert session is confirmed, cancelled or moved. We
            use the phone number on your account. You can turn this off here, or by replying STOP to
            any message.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={granted === true}
          aria-labelledby="whatsapp-consent-label"
          disabled={granted === null || saving}
          onClick={toggle}
          className="focus-visible:ring-ink inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={`relative h-7 w-12 rounded-full transition-colors ${
              granted ? "bg-ink" : "bg-ink-ash"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                granted ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
        </button>
      </div>
    </ProfileSection>
  );
}
