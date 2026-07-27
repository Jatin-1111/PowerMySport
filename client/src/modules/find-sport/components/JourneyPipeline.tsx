"use client";

import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Lock,
  Send,
  SkipForward,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api/axios";
import { expertApi } from "@/modules/expert/services/expert";
import { ScreeningRequestModal } from "./ScreeningRequestModal";

const WA_NUMBER = "918968582443";

type StageStatus = "done" | "active" | "skipped" | "upcoming";

const STAGE_META = [
  { id: "assessment", label: "Assessment", icon: CheckCircle2, optional: false },
  { id: "screening", label: "Physical Screening", icon: Activity, optional: true },
  { id: "expert", label: "Expert Session", icon: UserCheck, optional: true },
  { id: "trial", label: "Book a Trial Class", icon: CalendarCheck, optional: false },
] as const;

type StageId = (typeof STAGE_META)[number]["id"];

type JourneyState = {
  // Set once a real ScreeningRequest / ExpertSession is confirmed for this
  // child — takes priority over "skipped" since the parent actually went
  // through with it.
  screeningDone: boolean;
  expertDone: boolean;
  screeningSkipped: boolean;
  expertSkipped: boolean;
};

const EMPTY_JOURNEY_STATE: JourneyState = {
  screeningDone: false,
  expertDone: false,
  screeningSkipped: false,
  expertSkipped: false,
};

// Real bookings only — an unpaid hold or a cancelled session was never a
// completed step from the parent's point of view.
const REAL_EXPERT_SESSION_STATUSES = ["PAID", "SCHEDULED", "COMPLETED"];

function journeyStorageKey(dependentId?: string): string {
  return `pms_journey_${dependentId || "guest"}`;
}

// Local persistence covers guests (no server record to check against at all)
// and gives an instant, optimistic reflection of a just-submitted screening
// request before the next server reconciliation confirms it.
function loadJourneyState(dependentId?: string): JourneyState {
  if (typeof window === "undefined") return EMPTY_JOURNEY_STATE;
  try {
    const raw = localStorage.getItem(journeyStorageKey(dependentId));
    if (!raw) return EMPTY_JOURNEY_STATE;
    return { ...EMPTY_JOURNEY_STATE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_JOURNEY_STATE;
  }
}

// Screening and Expert Session both resolve either by the parent actually
// booking (done) or explicitly bypassing (skipped) — either advances the
// pipeline instead of leaving it stuck on a step they've already moved past.
// Trial class booking is the final step and always resolves through
// WhatsApp, since in-app booking is currently down.
function getStageStatus(id: StageId, s: JourneyState): StageStatus {
  if (id === "assessment") return "done";
  if (id === "screening") return s.screeningDone ? "done" : s.screeningSkipped ? "skipped" : "active";

  const screeningResolved = s.screeningDone || s.screeningSkipped;
  if (id === "expert") {
    if (!screeningResolved) return "upcoming";
    return s.expertDone ? "done" : s.expertSkipped ? "skipped" : "active";
  }

  const expertResolved = s.expertDone || s.expertSkipped;
  return screeningResolved && expertResolved ? "active" : "upcoming"; // trial
}

function getSublabel(id: StageId, s: JourneyState): string {
  if (id === "assessment") return "Complete";
  if (id === "screening") {
    if (s.screeningDone) return "Screening booked";
    return s.screeningSkipped ? "Skipped for now" : "Book your slot";
  }

  const screeningResolved = s.screeningDone || s.screeningSkipped;
  if (id === "expert") {
    if (!screeningResolved) return "After screening";
    if (s.expertDone) return "Session booked";
    return s.expertSkipped ? "Skipped for now" : "Talk to an expert";
  }

  const expertResolved = s.expertDone || s.expertSkipped;
  return screeningResolved && expertResolved ? "Reserve your spot" : "After expert session"; // trial
}

const isCovered = (status: StageStatus) => status !== "upcoming";

function stepTextColor(status: StageStatus): string {
  if (status === "done") return "text-turf-green";
  if (status === "active") return "text-power-orange";
  if (status === "skipped") return "text-slate-400";
  return "text-slate-300";
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// Icon-circle treatment for a single step — solid fill for done/active
// (confident, not just tinted+outlined) so the completed/current step reads at
// a glance instead of blending with upcoming ones. "skipped" gets its own
// neutral treatment — distinct from "done" (never happened) and from
// "upcoming" (it's behind us, not locked ahead).
function StepIcon({ status, Icon }: { status: StageStatus; Icon: typeof CheckCircle2 }) {
  const style =
    status === "done"
      ? "bg-turf-green text-white shadow-sm shadow-turf-green/30"
      : status === "active"
        ? "bg-power-orange text-white shadow-md shadow-power-orange/25 ring-4 ring-power-orange/10"
        : status === "skipped"
          ? "bg-slate-200 text-slate-500"
          : "bg-slate-50 text-slate-300 ring-1 ring-slate-100";

  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${style}`}>
      {status === "upcoming" ? (
        <Lock className="w-4 h-4" />
      ) : status === "skipped" ? (
        <SkipForward className="w-4 h-4" />
      ) : (
        <Icon className="w-[18px] h-[18px]" />
      )}
    </div>
  );
}

export function JourneyPipeline({
  childName,
  topSport,
  city,
  dependentId,
  onRetake,
}: {
  childName: string;
  topSport?: string;
  city?: string;
  dependentId?: string;
  onRetake?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [state, setState] = useState<JourneyState>(() => loadJourneyState(dependentId));
  const name = childName || "your child";

  // Persist skip choices (and any optimistic "done" flag) so the journey
  // survives a reload — the only option for guests, and an instant reflection
  // for logged-in parents ahead of the next server reconciliation below.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(journeyStorageKey(dependentId), JSON.stringify(state));
    } catch {}
  }, [dependentId, state]);

  // Reconcile with real server records for a logged-in parent's saved child —
  // if a screening or expert session was actually booked, auto-advance past
  // it instead of leaving the step stuck on "active" forever.
  useEffect(() => {
    if (!dependentId) return;
    let cancelled = false;

    api
      .get("/screenings/mine", { params: { dependentId } })
      .then((res) => {
        if (cancelled) return;
        const requests: Array<{ status: string }> = res.data?.data?.requests ?? [];
        const hasReal = requests.some((r) => r.status !== "cancelled");
        if (hasReal) setState((prev) => (prev.screeningDone ? prev : { ...prev, screeningDone: true }));
      })
      .catch(() => {});

    expertApi
      .mySessions()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const hasReal = res.data.some(
          (s) => s.player?._id === dependentId && REAL_EXPERT_SESSION_STATUSES.includes(s.status),
        );
        if (hasReal) setState((prev) => (prev.expertDone ? prev : { ...prev, expertDone: true }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [dependentId]);

  const waMessage = topSport
    ? `Hi! I just completed the sport assessment for ${name} on PowerMySport. ${topSport} was the top recommendation. I'd like to book a physical screening session to take the next step.`
    : `Hi! I just set up ${name}'s sport profile on PowerMySport and would like to book a physical screening session. Please guide me on the next steps.`;

  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const trialWaMessage = topSport
    ? `Hi! I'd like to book a trial class for ${name} in ${topSport} on PowerMySport. Please help me get started.`
    : `Hi! I'd like to book a trial class for ${name} on PowerMySport. Please help me get started.`;

  const trialWaUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(trialWaMessage)}`;

  const stages = STAGE_META.map((meta) => ({
    ...meta,
    status: getStageStatus(meta.id, state),
    sublabel: getSublabel(meta.id, state),
  }));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 sm:p-7 mb-6 shadow-sm">
      {/* Header */}
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-1.5">
        Your journey
      </p>
      <h3 className="font-title text-lg font-bold text-slate-900 mb-6">
        4 steps to the right sport for {name}
      </h3>

      {/* Steps — one row each, with its own dedicated action on the right */}
      <div className="flex flex-col">
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;

          return (
            <div key={stage.id} className="flex gap-4">
              {/* Rail */}
              <div className="flex flex-col items-center flex-shrink-0">
                <StepIcon status={stage.status} Icon={stage.icon} />
                {!isLast && (
                  <div
                    className={`w-[3px] flex-1 min-h-[28px] my-1 rounded-full ${
                      isCovered(stage.status) ? "bg-turf-green" : "bg-slate-100"
                    }`}
                  />
                )}
              </div>

              {/* Content + dedicated action */}
              <div className={`flex-1 min-w-0 ${isLast ? "pb-1" : "pb-6"}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${stepTextColor(stage.status)}`}>
                      Step {i + 1}
                    </span>
                    <p className={`text-sm font-semibold leading-tight ${stage.status === "upcoming" ? "text-slate-300" : "text-slate-900"}`}>
                      {stage.label}
                      {stage.optional && (stage.status === "active" || stage.status === "upcoming") && (
                        <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-power-orange/70 align-middle">
                          optional
                        </span>
                      )}
                    </p>
                    <p className={`text-xs mt-0.5 ${stage.status === "active" ? "text-slate-500" : stepTextColor(stage.status)}`}>
                      {stage.sublabel}
                    </p>
                  </div>

                  {/* Dedicated action per step */}
                  <div className="flex-shrink-0">
                    {stage.id === "assessment" && onRetake && (
                      <button
                        type="button"
                        onClick={onRetake}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Retake
                      </button>
                    )}

                    {stage.id === "screening" &&
                      (stage.status === "done" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-turf-green">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Booked
                        </span>
                      ) : stage.status === "skipped" ? (
                        <button
                          type="button"
                          onClick={() => setState((prev) => ({ ...prev, screeningSkipped: false }))}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          Undo
                        </button>
                      ) : (
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex gap-2 w-full sm:w-auto">
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-[#25D366] text-white rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 hover:bg-[#20bd5a] hover:shadow-lg hover:shadow-[#25D366]/25"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                            <button
                              type="button"
                              onClick={() => setModalOpen(true)}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-slate-900 text-white rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Request
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setState((prev) => ({ ...prev, screeningSkipped: true }))}
                            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Skip for now
                          </button>
                        </div>
                      ))}

                    {stage.id === "expert" &&
                      (stage.status === "done" ? (
                        <a
                          href="/experts/sessions"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-turf-green hover:text-turf-green/80 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Booked
                        </a>
                      ) : stage.status === "skipped" ? (
                        <button
                          type="button"
                          onClick={() => setState((prev) => ({ ...prev, expertSkipped: false }))}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          Undo
                        </button>
                      ) : stage.status === "active" ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <a
                            href="/experts"
                            className="group/cta inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20"
                          >
                            Talk to an Expert
                            <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setState((prev) => ({ ...prev, expertSkipped: true }))}
                            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Skip for now
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-300">Unlocks after screening</span>
                      ))}

                    {stage.id === "trial" &&
                      (stage.status === "active" ? (
                        <a
                          href={trialWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-[#25D366] text-white rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:bg-[#20bd5a] hover:shadow-lg hover:shadow-[#25D366]/25"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                          Book on WhatsApp
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-300">Unlocks after expert session</span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <ScreeningRequestModal
          childName={childName}
          sport={topSport}
          city={city}
          dependentId={dependentId}
          onClose={() => setModalOpen(false)}
          onSuccess={() =>
            setState((prev) => ({ ...prev, screeningDone: true, screeningSkipped: false }))
          }
        />
      )}
    </div>
  );
}
