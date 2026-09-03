"use client";

import {
  Activity,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Send,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api/axios";
import { expertApi } from "@/modules/expert/services/expert";
import { ScreeningRequestModal } from "../ScreeningRequestModal";

// Real bookings only — an unpaid hold or a cancelled session was never a
// completed step from the parent's point of view.
const REAL_EXPERT_SESSION_STATUSES = ["PAID", "SCHEDULED", "COMPLETED"];

type BookedState = { screeningDone: boolean; expertDone: boolean };

const EMPTY_BOOKED: BookedState = { screeningDone: false, expertDone: false };

function storageKey(dependentId?: string): string {
  return `pms_journey_${dependentId || "guest"}`;
}

// Local persistence covers guests (no server record to check against at all)
// and gives an instant, optimistic reflection of a just-submitted screening
// request before the next server reconciliation confirms it.
function loadBooked(dependentId?: string): BookedState {
  if (typeof window === "undefined") return EMPTY_BOOKED;
  try {
    const raw = localStorage.getItem(storageKey(dependentId));
    if (!raw) return EMPTY_BOOKED;
    const parsed = JSON.parse(raw) as Partial<BookedState>;
    return {
      screeningDone: parsed.screeningDone === true,
      expertDone: parsed.expertDone === true,
    };
  } catch {
    return EMPTY_BOOKED;
  }
}

function AddOnTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-white/[0.07] px-2 py-0.5 text-[9px] font-bold tracking-wider text-white/50 uppercase ring-1 ring-white/10">
      Optional add-on
    </span>
  );
}

function BookedTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/**
 * The CTA section below the results. Physical screening and an expert session
 * live here as add-ons rather than as steps between the assessment and a trial
 * class — a parent can book either at any point, or none of them, without it
 * blocking the trial.
 */
export function WhatsNextPanel({
  childName,
  topSport,
  city,
  dependentId,
  isLoggedIn,
}: {
  childName: string;
  topSport?: string;
  city?: string;
  dependentId?: string;
  isLoggedIn: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [booked, setBooked] = useState<BookedState>(() => loadBooked(dependentId));
  const name = childName || "your child";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey(dependentId), JSON.stringify(booked));
    } catch {}
  }, [dependentId, booked]);

  // Reconcile with real server records for a logged-in parent's saved child —
  // if a screening or expert session was actually booked, say so instead of
  // inviting them to book it a second time.
  useEffect(() => {
    if (!dependentId) return;
    let cancelled = false;

    api
      .get("/screenings/mine", { params: { dependentId } })
      .then((res) => {
        if (cancelled) return;
        const requests: Array<{ status: string }> = res.data?.data?.requests ?? [];
        if (requests.some((r) => r.status !== "cancelled")) {
          setBooked((prev) => (prev.screeningDone ? prev : { ...prev, screeningDone: true }));
        }
      })
      .catch(() => {});

    expertApi
      .mySessions()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const hasReal = res.data.some(
          (s) => s.player?._id === dependentId && REAL_EXPERT_SESSION_STATUSES.includes(s.status)
        );
        if (hasReal) setBooked((prev) => (prev.expertDone ? prev : { ...prev, expertDone: true }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [dependentId]);

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Ambient glow accents */}
      <div className="bg-power-orange/[0.07] pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-violet-500/[0.07] blur-3xl" />

      {/* Panel header — title and qualifier share the row on desktop instead of
          stacking into a third full-width line of centred-looking text. */}
      <div className="relative flex flex-col gap-2 border-b border-white/[0.06] px-6 pt-6 pb-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-bold tracking-[0.22em] text-white/40 uppercase">
            Add-ons &amp; extras
          </p>
          <h3 className="font-title text-xl font-bold text-white">
            Optional ways to go deeper on {name}
          </h3>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-slate-400 lg:text-right">
          None of these are required before a trial class — add them whenever they&apos;d be useful.
        </p>
      </div>

      {/* ── Add-ons ── */}
      <div className="relative grid grid-cols-1 divide-y divide-white/[0.06] border-b border-white/[0.06] md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Physical screening */}
        <div className="group flex flex-col p-6 transition-colors duration-300 hover:bg-white/[0.03] sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="bg-power-orange/15 ring-power-orange/20 flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105">
              <Activity className="text-power-orange h-[18px] w-[18px]" />
            </div>
            {booked.screeningDone ? <BookedTag label="Booked" /> : <AddOnTag />}
          </div>
          <p className="mb-1.5 text-[15px] font-semibold text-white">Physical screening</p>
          <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-400">
            A six-test fitness battery at a partner venue — speed, power, endurance, agility — with
            a printed report. Turns the trait answers you gave us into measured numbers.
          </p>

          {booked.screeningDone ? (
            <p className="text-[13px] text-emerald-400/90">
              Your screening request is in — our team will call you to confirm the slot.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-white hover:bg-white hover:text-slate-900"
            >
              <Send className="h-4 w-4" />
              Request a slot
            </button>
          )}
        </div>

        {/* Expert session */}
        <div className="group flex flex-col p-6 transition-colors duration-300 hover:bg-white/[0.03] sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-400/20 transition-transform duration-300 group-hover:scale-105">
              <UserCheck className="h-[18px] w-[18px] text-sky-400" />
            </div>
            {booked.expertDone ? <BookedTag label="Booked" /> : <AddOnTag />}
          </div>
          <p className="mb-1.5 text-[15px] font-semibold text-white">Expert session</p>
          <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-400">
            A paid one-on-one with a coach or sports professional who knows the pathway — useful
            when the scores above are close, or when a gap needs a second opinion.
          </p>

          <a
            href={booked.expertDone ? "/experts/sessions" : "/booking?tab=experts"}
            className="group/cta flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-white hover:bg-white hover:text-slate-900"
          >
            {booked.expertDone ? "View your session" : "Talk to an Expert"}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </a>
        </div>
      </div>

      {/* ── Free extras ──
          A slim row rather than two more full-height cards: these are free links,
          not paid add-ons, and giving them the same weight as the two above made
          the panel a wall of four near-identical boxes. */}
      <div className="relative grid grid-cols-1 divide-y divide-white/[0.06] md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Community */}
        <a
          href="/community"
          className="group flex items-center gap-4 px-6 py-5 transition-colors duration-300 hover:bg-white/[0.03] sm:px-7"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-400/20 transition-transform duration-300 group-hover:scale-105">
            <Users className="h-[18px] w-[18px] text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">
              Join the community{" "}
              <span className="text-[11px] font-medium text-white/30">· Free</span>
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">
              Academy reviews, training tips, and real experiences from parents across India.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
        </a>

        {/* Save profile */}
        {!isLoggedIn ? (
          <a
            href="/register"
            className="group flex items-center gap-4 px-6 py-5 transition-colors duration-300 hover:bg-white/[0.03] sm:px-7"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/20 transition-transform duration-300 group-hover:scale-105">
              <CheckCircle className="h-[18px] w-[18px] text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">
                Save {name}&apos;s profile{" "}
                <span className="text-[11px] font-medium text-white/30">· Under a minute</span>
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">
                Keep these fit scores, get a personalised roadmap, and track them as {name} grows.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
          </a>
        ) : (
          <div className="flex items-center gap-4 px-6 py-5 sm:px-7">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/20">
              <CheckCircle className="h-[18px] w-[18px] text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">Profile saved</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">
                {name}&apos;s sport profile is saved. Retake the assessment anytime as they grow.
              </p>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <ScreeningRequestModal
          childName={childName}
          sport={topSport}
          city={city}
          dependentId={dependentId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setBooked((prev) => ({ ...prev, screeningDone: true }))}
        />
      )}
    </div>
  );
}
