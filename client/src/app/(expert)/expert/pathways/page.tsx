"use client";

import {
  pathwayApi,
  type ExpertVerifiablePathway,
} from "@/modules/sports/services/pathway";
import { toast } from "sonner";
import { BadgeCheck, Eye, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function ExpertPathwaysPage() {
  const [pathways, setPathways] = useState<ExpertVerifiablePathway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pathwayApi.getForExpertVerification();
      setPathways(data);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load pathways.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateOne = (
    sportSlug: string,
    patch: Partial<ExpertVerifiablePathway>,
  ) =>
    setPathways((list) =>
      list.map((p) => (p.sportSlug === sportSlug ? { ...p, ...patch } : p)),
    );

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          <ShieldCheck className="h-3.5 w-3.5" /> Expert
        </span>
        <h1 className="relative mt-3 text-2xl font-bold sm:text-3xl">
          Verify Pathways
        </h1>
        <p className="relative mt-1 max-w-xl text-sm text-slate-200">
          Pathways for the sports on your profile. Add your name as a verified
          expert and parents will see your credit on the public roadmap page.
        </p>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="font-semibold text-red-600">{error}</p>
            <button
              onClick={load}
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        ) : pathways.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
            <p className="font-semibold text-slate-700">
              No pathways found for your sports yet.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Pathways are created the first time a parent looks up your sport
              on the roadmap page — check back later, or add more sports to your
              profile.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pathways.map((p) => (
              <PathwayRow key={p.sportSlug} pathway={p} onChange={updateOne} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PathwayRow({
  pathway,
  onChange,
}: {
  pathway: ExpertVerifiablePathway;
  onChange: (
    sportSlug: string,
    patch: Partial<ExpertVerifiablePathway>,
  ) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    try {
      const res = await pathwayApi.verifyAsExpert(
        pathway.sportSlug,
        note.trim() || undefined,
      );
      if (res.success) {
        onChange(pathway.sportSlug, {
          verifiedByMe: true,
          expertVerificationCount:
            pathway.expertVerificationCount + (pathway.verifiedByMe ? 0 : 1),
        });
        setExpanded(false);
        toast.success("You're now credited as a verifier on this pathway.");
      } else {
        toast.error(res.message || "Failed to verify.");
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to verify.",
      );
    } finally {
      setBusy(false);
    }
  };

  const unverify = async () => {
    setBusy(true);
    try {
      const res = await pathwayApi.removeExpertVerification(pathway.sportSlug);
      if (res.success) {
        onChange(pathway.sportSlug, {
          verifiedByMe: false,
          expertVerificationCount: Math.max(
            0,
            pathway.expertVerificationCount - 1,
          ),
        });
        toast.success("Your verification was removed.");
      } else {
        toast.error(res.message || "Failed to update.");
      }
    } catch {
      toast.error("Failed to update.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{pathway.sportName}</p>
            {pathway.category && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {pathway.category}
              </span>
            )}
            {pathway.verifiedByMe && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="h-3 w-3" /> Verified by you
              </span>
            )}
          </div>
          {pathway.overview && (
            <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
              {pathway.overview}
            </p>
          )}
          <p className="mt-1.5 text-xs text-slate-400">
            {pathway.expertVerificationCount} expert
            {pathway.expertVerificationCount === 1 ? "" : "s"} verified ·{" "}
            {pathway.lookupCount} lookups
            {pathway.stateVariants > 1 &&
              ` · covers ${pathway.stateVariants} state variants`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/roadmap?sport=${encodeURIComponent(pathway.sportName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </a>
          {pathway.verifiedByMe ? (
            <button
              onClick={unverify}
              disabled={busy}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Remove verification
            </button>
          ) : (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="rounded-lg bg-power-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
            >
              Verify
            </button>
          )}
        </div>
      </div>

      {expanded && !pathway.verifiedByMe && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Note to show parents (optional)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. This matches what I've seen coaching state-level players."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={verify}
              disabled={busy}
              className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {busy ? "Saving..." : "Confirm verification"}
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
