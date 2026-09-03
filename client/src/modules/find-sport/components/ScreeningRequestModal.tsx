"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import api from "@/lib/api/axios";

interface Props {
  childName: string;
  sport?: string;
  city?: string;
  dependentId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ScreeningRequestModal({
  childName,
  sport,
  city,
  dependentId,
  onClose,
  onSuccess,
}: Props) {
  const [phone, setPhone] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/screenings", {
        dependentName: childName,
        dependentId,
        sport,
        phone: phone.trim(),
        preferredTime: preferredTime.trim() || undefined,
        city: city || undefined,
      });
      setDone(true);
      onSuccess?.();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 pb-4 pt-5">
          <div>
            <h2 className="font-title text-base font-bold text-slate-900">
              Book Physical Screening
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {childName}
              {sport ? ` · ${sport}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center px-6 py-8 text-center">
            <div className="bg-turf-green/10 mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <CheckCircle2 className="text-turf-green h-7 w-7" />
            </div>
            <h3 className="font-title mb-1 text-lg font-bold text-slate-900">Request received!</h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">
              Our team will contact you on{" "}
              <span className="font-semibold text-slate-700">{phone}</span> within 24 hours to
              confirm the slot.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-500">
              Share your contact details and we&apos;ll reach out to schedule{" "}
              <span className="font-medium text-slate-700">{childName}</span>&apos;s physical
              screening session.
            </p>

            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Phone number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="focus:ring-power-orange/30 focus:border-power-orange w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-300 focus:outline-none focus:ring-2"
              />
            </div>

            {/* Preferred time */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Preferred availability{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                placeholder="e.g. Weekday evenings, this Saturday…"
                className="focus:ring-power-orange/30 focus:border-power-orange w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-300 focus:outline-none focus:ring-2"
              />
            </div>

            {/* City — read-only */}
            {city && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">City</label>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
                  {city}
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-power-orange flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Submit Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
