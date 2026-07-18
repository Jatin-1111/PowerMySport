"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import api from "@/lib/api/axios";

interface Props {
  childName: string;
  sport?: string;
  city?: string;
  onClose: () => void;
}

export function ScreeningRequestModal({ childName, sport, city, onClose }: Props) {
  const [phone, setPhone] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setError("Phone number is required."); return; }
    setError("");
    setLoading(true);
    try {
      await api.post("/screenings", {
        dependentName: childName,
        sport,
        phone: phone.trim(),
        preferredTime: preferredTime.trim() || undefined,
        city: city || undefined,
      });
      setDone(true);
    } catch {
      setError("Something went wrong. Please try WhatsApp instead.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-title text-base font-bold text-slate-900">
              Book Physical Screening
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {childName}{sport ? ` · ${sport}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-turf-green/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-turf-green" />
            </div>
            <h3 className="font-title text-lg font-bold text-slate-900 mb-1">
              Request received!
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Our team will contact you on{" "}
              <span className="font-semibold text-slate-700">{phone}</span>{" "}
              within 24 hours to confirm the slot.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500 leading-relaxed">
              Share your contact details and we&apos;ll reach out to schedule{" "}
              <span className="font-medium text-slate-700">{childName}</span>&apos;s
              physical screening session.
            </p>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-power-orange/30 focus:border-power-orange transition-colors"
              />
            </div>

            {/* Preferred time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Preferred availability{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                placeholder="e.g. Weekday evenings, this Saturday…"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-power-orange/30 focus:border-power-orange transition-colors"
              />
            </div>

            {/* City — read-only */}
            {city && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  City
                </label>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
                  {city}
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-power-orange py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
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
