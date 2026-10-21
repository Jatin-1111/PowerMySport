"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { Card } from "@/modules/shared/ui/Card";
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
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        WhatsApp
      </h2>
      <Card className="border-0 bg-white p-0 shadow-[0_2px_16px_rgb(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h3 id="whatsapp-consent-label" className="text-base font-semibold text-slate-900">
              Booking updates on WhatsApp
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Get a message when a booking is confirmed, cancelled or moved. We use the phone number
              on your account. You can turn this off here, or by replying STOP to any message.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={granted === true}
            aria-labelledby="whatsapp-consent-label"
            disabled={granted === null || saving}
            onClick={toggle}
            className={`focus-visible:ring-ink relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${
              granted ? "bg-ink" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                granted ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </Card>
    </div>
  );
}
