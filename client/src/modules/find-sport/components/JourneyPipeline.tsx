"use client";

import {
  Activity,
  CheckCircle2,
  Lock,
  Send,
  Trophy,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { ScreeningRequestModal } from "./ScreeningRequestModal";

const WA_NUMBER = "918968582443";

const STAGES = [
  {
    id: "assessment",
    label: "Assessment",
    sublabel: "Complete",
    icon: CheckCircle2,
    status: "done" as const,
  },
  {
    id: "screening",
    label: "Physical Screening",
    sublabel: "Book your slot",
    icon: Activity,
    status: "active" as const,
  },
  {
    id: "expert",
    label: "Expert Session",
    sublabel: "After screening",
    icon: UserCheck,
    status: "upcoming" as const,
  },
  {
    id: "recommendation",
    label: "Recommendation",
    sublabel: "Final outcome",
    icon: Trophy,
    status: "upcoming" as const,
  },
] as const;

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

export function JourneyPipeline({
  childName,
  topSport,
  city,
}: {
  childName: string;
  topSport?: string;
  city?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const name = childName || "your child";
  const waMessage = topSport
    ? `Hi! I just completed the sport assessment for ${name} on PowerMySport. ${topSport} was the top recommendation. I'd like to book a physical screening session to take the next step.`
    : `Hi! I just set up ${name}'s sport profile on PowerMySport and would like to book a physical screening session. Please guide me on the next steps.`;

  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 mb-6">
      {/* Header */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
        Your journey
      </p>
      <h3 className="font-title text-lg font-bold text-slate-900 mb-5">
        4 steps to the right sport for {name}
      </h3>

      {/* Stepper — horizontal on md+, vertical on mobile */}
      <div className="hidden md:flex items-start gap-0 mb-6">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isDone = stage.status === "done";
          const isActive = stage.status === "active";

          return (
            <div key={stage.id} className="flex items-start flex-1 min-w-0">
              {/* Stage */}
              <div className="flex flex-col items-center flex-1 min-w-0 px-2">
                {/* Icon circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mb-2 transition-colors ${
                    isDone
                      ? "bg-turf-green/10 text-turf-green border-2 border-turf-green/20"
                      : isActive
                        ? "bg-power-orange/10 text-power-orange border-2 border-power-orange/30"
                        : "bg-slate-50 text-slate-300 border-2 border-slate-100"
                  }`}
                >
                  {isActive || isDone ? (
                    <Icon className="w-4.5 h-4.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </div>
                {/* Step number */}
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                    isDone
                      ? "text-turf-green"
                      : isActive
                        ? "text-power-orange"
                        : "text-slate-300"
                  }`}
                >
                  Step {i + 1}
                </span>
                {/* Label */}
                <p
                  className={`text-xs font-semibold text-center leading-tight mb-0.5 ${
                    isDone || isActive ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {stage.label}
                </p>
                <p
                  className={`text-[10px] text-center ${
                    isDone
                      ? "text-turf-green"
                      : isActive
                        ? "text-slate-500"
                        : "text-slate-300"
                  }`}
                >
                  {stage.sublabel}
                </p>
              </div>

              {/* Connector line */}
              {i < STAGES.length - 1 && (
                <div className="flex-shrink-0 w-6 mt-5">
                  <div
                    className={`h-px w-full ${
                      isDone ? "bg-turf-green/30" : "bg-slate-100"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stepper — vertical on mobile */}
      <div className="flex md:hidden flex-col gap-0 mb-6">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isDone = stage.status === "done";
          const isActive = stage.status === "active";
          const isLast = i === STAGES.length - 1;

          return (
            <div key={stage.id} className="flex gap-3">
              {/* Left rail */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDone
                      ? "bg-turf-green/10 text-turf-green border-2 border-turf-green/20"
                      : isActive
                        ? "bg-power-orange/10 text-power-orange border-2 border-power-orange/30"
                        : "bg-slate-50 text-slate-300 border-2 border-slate-100"
                  }`}
                >
                  {isActive || isDone ? (
                    <Icon className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`w-px flex-1 min-h-[20px] mt-1 ${
                      isDone ? "bg-turf-green/30" : "bg-slate-100"
                    }`}
                  />
                )}
              </div>
              {/* Content */}
              <div className="pb-4">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isDone
                      ? "text-turf-green"
                      : isActive
                        ? "text-power-orange"
                        : "text-slate-300"
                  }`}
                >
                  Step {i + 1}
                </span>
                <p
                  className={`text-sm font-semibold leading-tight ${
                    isDone || isActive ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {stage.label}
                </p>
                <p
                  className={`text-xs ${
                    isDone
                      ? "text-turf-green"
                      : isActive
                        ? "text-slate-500"
                        : "text-slate-300"
                  }`}
                >
                  {stage.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Booking CTA */}
      <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
        <p className="text-sm font-semibold text-slate-900 mb-0.5">
          Ready for the next step?
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          Schedule {name}&apos;s physical screening session. Choose how you&apos;d like to connect with our team.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-[#1ebe5d] transition-colors"
          >
            <WhatsAppIcon className="w-4 h-4" />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Request Directly
          </button>
        </div>
      </div>

      {modalOpen && (
        <ScreeningRequestModal
          childName={childName}
          sport={topSport}
          city={city}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
