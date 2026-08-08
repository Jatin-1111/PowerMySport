"use client";

import { CalendarCheck, CheckCircle2 } from "lucide-react";

const WA_NUMBER = "918968582443";

// ─── Journey after the assessment ────────────────────────────────────────────
// Two steps, not four. Physical screening and an expert session used to sit
// between the assessment and a trial class, gating it — a parent who skipped
// neither had three things to resolve before they could do the one thing that
// actually tells them something: put the child on a court. Both are now
// optional add-ons in the CTA section below, and booking a trial is the
// immediate next step.

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
  onRetake,
}: {
  childName: string;
  /** The sport the family is most likely to try — their own first pick when they made one. */
  topSport?: string;
  onRetake?: () => void;
}) {
  const name = childName || "your child";

  const trialWaMessage = topSport
    ? `Hi! I just completed the sport assessment for ${name} on PowerMySport. I'd like to book a trial class in ${topSport}. Please help me get started.`
    : `Hi! I just completed the sport assessment for ${name} on PowerMySport and I'd like to book a trial class. Please help me get started.`;

  const trialWaUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(trialWaMessage)}`;

  return (
    // One card, not a white shell wrapping a dark one. The old version spent a
    // full row plus an arrow connector restating a step the parent had just
    // finished; that now sits in the header strip.
    <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 shadow-sm">
      {/* ── Step 1: done ── */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-3 sm:px-7">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-turf-green" />
        <p className="min-w-0 flex-1 text-xs font-semibold text-slate-400">
          <span className="text-turf-green">Step 1 complete</span> · Assessment
        </p>
        {onRetake && (
          <button
            type="button"
            onClick={onRetake}
            className="shrink-0 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-300"
          >
            Retake
          </button>
        )}
      </div>

      {/* ── Step 2: the actual next step ──
          Copy and action sit side by side on desktop — stacked, the CTA button
          stretched the full card width and read as a footer rather than a step. */}
      <div className="grid items-center gap-5 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:gap-10">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-power-orange text-white shadow-md shadow-power-orange/25">
            <CalendarCheck className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-power-orange">
              Step 2 · Next up
            </p>
            <p className="font-title text-xl font-bold leading-tight text-white">
              Book a trial class{topSport ? ` in ${topSport}` : ""}
            </p>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">
              One session on an actual court tells you more than any score can. We&apos;ll find a
              coach near you and set it up — no commitment beyond the one class.
            </p>
          </div>
        </div>

        <div className="lg:w-[300px] lg:shrink-0">
          <a
            href={trialWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-[#20bd5a] hover:shadow-lg hover:shadow-[#25D366]/25 active:scale-[0.99]"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Book a Trial Class on WhatsApp
          </a>
          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-white/40">
            Usually answered the same day. Screening and expert sessions are optional add-ons —
            see below.
          </p>
        </div>
      </div>
    </div>
  );
}
