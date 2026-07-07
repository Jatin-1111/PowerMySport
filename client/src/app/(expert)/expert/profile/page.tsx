"use client";

import { expertApi, type Expert } from "@/modules/expert/services/expert";
import { ExpertProfileEditor } from "@/modules/expert/components/ExpertProfileEditor";
import { useCallback, useEffect, useState } from "react";

export default function ExpertProfilePage() {
  const [profile, setProfile] = useState<Expert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await expertApi.getMyProfile();
      if (res.success && res.data) setProfile(res.data);
      else setError(res.message || "Failed to load your profile.");
    } catch {
      setError("Failed to load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
        <span className="relative inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          Expert
        </span>
        <h1 className="relative mt-3 text-2xl font-bold sm:text-3xl">
          Profile &amp; availability
        </h1>
        <p className="relative mt-1 text-sm text-slate-200">
          Manage your public profile, session settings, and weekly availability.
        </p>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading...</div>
        ) : error || !profile ? (
          <div className="py-12 text-center">
            <p className="font-semibold text-red-600">
              {error || "Expert profile not found."}
            </p>
            <button
              onClick={load}
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        ) : (
          <ExpertProfileEditor profile={profile} onSaved={setProfile} />
        )}
      </div>
    </div>
  );
}
