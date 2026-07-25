"use client";

import api from "@/lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type CheckInStatus = "progressing" | "not_progressing" | "ambiguous" | "abandoned";

interface PlanCheckIn {
  _id: string;
  source: "find_sport_trial" | "guidance_short_plan" | "guidance_journey";
  sport: string;
  title: string;
  signals: string[];
  status: string;
}

type FollowUp =
  | { kind: "done"; message: string }
  | { kind: "try_next_sport"; message: string }
  | { kind: "re_diagnose"; message: string }
  | { kind: "escalate"; message: string; whatsappUrl: string | null };

const RESPONSE_OPTIONS: { value: CheckInStatus; label: string }[] = [
  { value: "progressing", label: "Going well" },
  { value: "not_progressing", label: "Not really working" },
  { value: "ambiguous", label: "Not sure yet" },
  { value: "abandoned", label: "We didn't get to try it" },
];

export default function CheckInPage() {
  const params = useParams();
  const id = params?.id as string;
  const { token } = useAuthStore();

  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "submitted">("loading");
  const [checkIn, setCheckIn] = useState<PlanCheckIn | null>(null);
  const [selected, setSelected] = useState<CheckInStatus | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    api
      .get<{ success: boolean; data: PlanCheckIn }>(`/plan-checkins/${id}`)
      .then((res) => {
        setCheckIn(res.data.data);
        setPhase(res.data.data.status === "active" || res.data.data.status === "due" ? "ready" : "submitted");
      })
      .catch(() => setPhase("error"));
  }, [token, id]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; data: { followUp: FollowUp } }>(
        `/plan-checkins/${id}/respond`,
        { status: selected, outcomeNote: note || undefined },
      );
      setFollowUp(res.data.data.followUp);
      setPhase("submitted");
    } catch {
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-title text-xl font-bold text-slate-900 mb-2">Log in to continue</h1>
          <p className="text-sm text-slate-500 mb-6">
            This check-in is tied to your account.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/check-in/${id}`)}`}
            className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 transition"
          >
            Log in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-power-orange" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <p className="text-sm text-slate-500">
          Couldn&apos;t load this check-in — it may not belong to your account.
        </p>
      </div>
    );
  }

  if (phase === "submitted") {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="font-title text-xl font-bold text-slate-900 mb-2">
            Thanks for letting us know
          </h1>
          <p className="text-sm text-slate-500 mb-7 leading-relaxed">
            {followUp?.message ?? "Your answer has been recorded."}
          </p>

          {followUp?.kind === "try_next_sport" && (
            <Link
              href="/assessment/discover"
              className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 transition"
            >
              Explore other sports <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {followUp?.kind === "re_diagnose" && (
            <Link
              href={checkIn ? `/guidance?sport=${encodeURIComponent(checkIn.sport)}` : "/guidance"}
              className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 transition"
            >
              Take another look <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {followUp?.kind === "escalate" && (
            <a
              href={followUp.whatsappUrl ?? "https://wa.me/918968582443"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white hover:bg-[#1ebe5d] transition"
            >
              <MessageCircle className="h-4 w-4" /> Talk to our team
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-power-orange/10">
            <Sparkles className="h-6 w-6 text-power-orange" />
          </div>
          <h1 className="font-title text-2xl font-bold text-slate-900 mb-2">
            {checkIn?.title}
          </h1>
        </div>

        {checkIn && checkIn.signals.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              What we asked you to watch for
            </p>
            <ul className="space-y-1.5">
              {checkIn.signals.map((s, i) => (
                <li key={i} className="text-sm text-slate-600 leading-relaxed">
                  • {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2.5 mb-4">
          {RESPONSE_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              whileTap={{ scale: 0.98 }}
              className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors ${
                selected === opt.value
                  ? "border-power-orange bg-orange-50 text-power-orange"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else worth mentioning? (optional)"
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20 resize-none mb-5"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!selected || submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-power-orange px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.45)] transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}
