"use client";

import {
  expertApi,
  type Expert,
  type ExpertReview,
  type ExpertSessionMode,
} from "@/modules/expert/services/expert";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { toast } from "sonner";
import {
  Award,
  CalendarCheck,
  MapPin,
  Star,
  Globe,
  Languages,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function ExpertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const expertId = String(params?.expertId || "");
  const user = useAuthStore((s) => s.user);

  const [expert, setExpert] = useState<Expert | null>(null);
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [mode, setMode] = useState<ExpertSessionMode>("ONLINE");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [e, r] = await Promise.all([
        expertApi.getExpert(expertId),
        expertApi.getExpertReviews(expertId),
      ]);
      if (e.success && e.data) {
        setExpert(e.data);
        if (e.data.sessionMode === "IN_PERSON") setMode("IN_PERSON");
      } else {
        setError(e.message || "Expert not found.");
      }
      if (r.success && r.data) setReviews(r.data);
    } catch {
      setError("Failed to load expert.");
    } finally {
      setLoading(false);
    }
  }, [expertId]);

  useEffect(() => {
    if (expertId) load();
  }, [expertId, load]);

  const handleConnect = async () => {
    if (!user) {
      router.push(`/login?redirect=/experts/${expertId}`);
      return;
    }
    setConnecting(true);
    try {
      const res = await expertApi.initiateSession(expertId, {
        mode: expert?.sessionMode === "BOTH" ? mode : undefined,
        clientNote: note.trim() || undefined,
      });
      if (res.success && res.data?.redirectUrl) {
        // Hand off to PhonePe hosted checkout.
        window.location.href = res.data.redirectUrl;
      } else {
        toast.error(res.message || "Could not start payment.");
        setConnecting(false);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not start payment.";
      toast.error(msg);
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Loading expert...
      </div>
    );
  }

  if (error || !expert) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-semibold text-red-600">
          {error || "Expert not found."}
        </p>
        <Link
          href="/experts"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-power-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to experts
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/experts"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-power-orange"
          >
            <ArrowLeft className="h-4 w-4" /> All experts
          </Link>
          <Link
            href="/experts/sessions"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-power-orange"
          >
            <CalendarCheck className="h-4 w-4" /> My sessions
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Profile */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-56 w-full bg-slate-100">
                {expert.photoUrl ? (
                  <Image
                    src={expert.photoUrl}
                    alt={expert.name || "Expert"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-6xl font-bold text-slate-300">
                    {(expert.name || "E").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1
                      className="text-2xl font-bold text-slate-900"
                      style={{ fontFamily: "var(--font-syne)" }}
                    >
                      {expert.name || "Expert"}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      {expert.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> {expert.city}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-4 w-4" />{" "}
                        {expert.sessionMode === "BOTH"
                          ? "Online or in-person"
                          : expert.sessionMode === "ONLINE"
                            ? "Online"
                            : "In-person"}
                      </span>
                      {expert.languages && expert.languages.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Languages className="h-4 w-4" />{" "}
                          {expert.languages.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {expert.reviewCount > 0 && (
                    <div className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-100/60 px-2.5 py-1 text-sm font-semibold text-amber-700">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      {expert.rating.toFixed(1)}
                      <span className="text-xs font-normal text-amber-600">
                        ({expert.reviewCount})
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(expert.sports || []).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-medium text-power-orange"
                    >
                      {s}
                    </span>
                  ))}
                  {(expert.expertise || []).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {expert.bio && (
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {expert.bio}
                  </p>
                )}
                {expert.achievements && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Award className="h-4 w-4 text-power-orange" /> Achievements
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                      {expert.achievements}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No reviews yet. Be the first to book a session.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {reviews.map((r, i) => (
                    <div
                      key={i}
                      className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">
                          {r.reviewerName || "A player"}
                        </span>
                        <span className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${s < Math.round(r.rating) ? "fill-amber-500" : "text-slate-200"}`}
                            />
                          ))}
                        </span>
                      </div>
                      {r.review && (
                        <p className="mt-1 text-sm text-slate-600">{r.review}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Connect / pay card */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Session fee</p>
              <p className="text-3xl font-extrabold text-slate-900">
                {formatInr(expert.sessionFee)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Pay securely, then pick a time that suits you.
              </p>

              {expert.sessionMode === "BOTH" && (
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Session mode
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ExpertSessionMode)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ONLINE">Online</option>
                    <option value="IN_PERSON">In-person</option>
                  </select>
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Note to expert (optional)
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What would you like to work on?"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-power-orange px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connecting
                  ? "Redirecting to payment..."
                  : `Connect — Pay ${formatInr(expert.sessionFee)}`}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure payment via PhonePe
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
