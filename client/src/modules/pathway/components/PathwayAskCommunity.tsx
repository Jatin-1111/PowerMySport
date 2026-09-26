"use client";

// ─── Ask the community, from inside a stage ─────────────────────────────────
//
// A parent reading a stage is the parent with a question the stage did not
// answer. Sending them to the community's front page loses the question on the
// way, so the box takes it here and hands it over in the URL: the Q&A page
// opens its ask form with the title and sport already filled in, and a parent
// who is signed out goes through login and comes back to the same form.

import { MessageCircleQuestion } from "lucide-react";
import { useId, useState } from "react";

import { getCommunityAppUrl } from "@/lib/community/url";

export function PathwayAskCommunity({
  sportName,
  stageName,
}: {
  sportName: string;
  stageName: string;
}) {
  const [question, setQuestion] = useState("");
  const inputId = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    window.location.href = getCommunityAppUrl({
      path: "questions",
      searchParams: { ask: "1", sport: sportName, title: question.trim() },
    });
  };

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="border-t border-slate-100 px-4 py-6 sm:px-6"
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
            <MessageCircleQuestion aria-hidden className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3
              id={`${inputId}-heading`}
              className="text-[15px] font-extrabold tracking-tight text-slate-900"
            >
              Still have a question about {stageName}?
            </h3>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-500">
              Ask it in the community. Parents who have been through this stage answer there.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <label htmlFor={inputId} className="sr-only">
            Your question
          </label>
          <input
            id={inputId}
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder={`Type your ${sportName} question`}
            className="focus:border-power-orange/60 focus:ring-power-orange/15 min-h-11 w-full min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-[14.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4"
          />
          <button
            type="submit"
            className="bg-power-orange-solid min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold text-white transition hover:bg-orange-600"
          >
            Ask the community
          </button>
        </form>
      </div>
    </section>
  );
}
