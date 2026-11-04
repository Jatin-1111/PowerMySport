"use client";

import api, { API_BASE_URL } from "@/lib/api/axios";
import { resolveApiPath } from "@/lib/api/resolveApiPath";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { cn } from "@/utils/cn";
import { ArrowRight, Loader2, MessageCircle } from "lucide-react";
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

const PRIMARY_LINK =
  "bg-power-orange-solid focus-visible:ring-ink inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-medium text-white transition-colors hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

/** The page frame: paper background, one centred column. */
function Frame({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="bg-paper flex-1 px-4 pb-24 pt-16 sm:pt-24">
      <div className={cn("mx-auto w-full", narrow ? "max-w-md" : "max-w-xl")}>{children}</div>
    </div>
  );
}

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
        setPhase(
          res.data.data.status === "active" || res.data.data.status === "due"
            ? "ready"
            : "submitted"
        );
      })
      .catch(() => setPhase("error"));
  }, [token, id]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; data: { followUp: FollowUp } }>(
        `/plan-checkins/${id}/respond`,
        { status: selected, outcomeNote: note || undefined }
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
      <Frame>
        <h1 className="font-editorial text-ink text-4xl font-light tracking-tight sm:text-5xl">
          Log in to continue
        </h1>
        <p className="text-ink-body mt-4 text-lg">This check-in is tied to your account.</p>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/check-in/${id}`)}`}
          className={cn(PRIMARY_LINK, "mt-8")}
        >
          Log in <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Frame>
    );
  }

  if (phase === "loading") {
    return (
      <Frame>
        <div className="text-ink-muted flex items-center gap-2 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your check-in
        </div>
      </Frame>
    );
  }

  if (phase === "error") {
    return (
      <Frame>
        <h1 className="font-editorial text-ink text-4xl font-light tracking-tight">
          We couldn&apos;t load this check-in
        </h1>
        <p className="text-ink-body mt-4 text-lg">It may not belong to your account.</p>
      </Frame>
    );
  }

  if (phase === "submitted") {
    return (
      <Frame>
        <h1 className="font-editorial text-ink text-balance text-4xl font-light leading-tight tracking-tight sm:text-5xl">
          Thanks for <span className="italic">letting us know</span>
        </h1>
        <p className="text-ink-body mt-5 max-w-prose text-pretty text-lg leading-relaxed">
          {followUp?.message ?? "Your answer has been recorded."}
        </p>

        <div className="mt-8">
          {followUp?.kind === "try_next_sport" && (
            <Link href="/assessment/discover" className={PRIMARY_LINK}>
              Explore other sports <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          {followUp?.kind === "re_diagnose" && (
            <Link
              href={checkIn ? `/guidance?sport=${encodeURIComponent(checkIn.sport)}` : "/guidance"}
              className={PRIMARY_LINK}
            >
              Take another look <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          {followUp?.kind === "escalate" && (
            <a
              href={
                followUp.whatsappUrl
                  ? resolveApiPath(followUp.whatsappUrl, API_BASE_URL)
                  : "https://wa.me/918968582443"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="focus-visible:ring-ink inline-flex items-center gap-2 rounded-md bg-green-700 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Talk to our team
            </a>
          )}
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <p className="text-ink-muted text-sm">Check-in</p>
      <h1 className="font-editorial text-ink mt-3 text-balance text-4xl font-light leading-tight tracking-tight sm:text-5xl">
        {checkIn?.title}
      </h1>

      {checkIn && checkIn.signals.length > 0 && (
        <section aria-labelledby="signals" className="border-hairline mt-10 border-t pt-6">
          <h2 id="signals" className="text-ink-muted text-sm">
            What we asked you to watch for
          </h2>
          <ul className="mt-3 space-y-2">
            {checkIn.signals.map((s, i) => (
              <li key={i} className="text-ink-body flex gap-3 text-pretty leading-relaxed">
                <span className="bg-ink-ash mt-2.5 h-1 w-1 shrink-0 rounded-full" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <fieldset className="mt-10">
        <legend className="text-ink mb-3 font-medium">How did it go?</legend>
        <div className="space-y-2.5">
          {RESPONSE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected === opt.value}
              onClick={() => setSelected(opt.value)}
              className={cn(
                "focus-visible:ring-ink w-full rounded-lg border px-4 py-3.5 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 active:scale-[0.99]",
                selected === opt.value
                  ? "border-ink bg-paper-deep text-ink font-medium"
                  : "border-hairline text-ink hover:border-ink/40 bg-white"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label htmlFor="checkin-note" className="text-ink mb-2 mt-8 block font-medium">
        Anything else worth mentioning?{" "}
        <span className="text-ink-muted font-normal">(optional)</span>
      </label>
      <textarea
        id="checkin-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="border-hairline text-ink focus:border-ink focus:ring-ink/15 w-full resize-none rounded-lg border bg-white px-4 py-3 text-base focus:outline-none focus:ring-2"
      />

      <button
        type="button"
        onClick={submit}
        disabled={!selected || submitting}
        className={cn(PRIMARY_LINK, "mt-8 w-full disabled:cursor-not-allowed disabled:opacity-40")}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            Submit <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </Frame>
  );
}
