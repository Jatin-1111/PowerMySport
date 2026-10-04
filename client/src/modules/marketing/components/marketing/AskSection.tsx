"use client";

import { ASK_SUGGESTED_QUESTIONS, askHref } from "@/modules/guidance/config/askQuestions";
import { startAskTransition } from "@/modules/guidance/utils/askTransition";
import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { SectionLabel } from "./SectionLabel";

/**
 * "Ask before you decide": a way into the assistant from the homepage. It does
 * not run a chat of its own. Typing or tapping a question goes to /ask, which
 * sends it once the chat is ready, so there is one chat to maintain and one set
 * of limits.
 *
 * Going there plays the card growing into the full page (see
 * utils/askTransition), then the route changes under it. The assistant needs an account, and the copy says so up front rather than
 * after the parent has typed a question.
 */
export const AskSection: React.FC = () => {
  const [question, setQuestion] = useState("");
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  // Plays the grow, then navigates. Modified clicks (new tab, new window) are
  // left to the browser, which opens the link as usual.
  const go = (href: string, event?: React.MouseEvent) => {
    if (
      event &&
      (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    ) {
      return;
    }
    event?.preventDefault();
    // The route changes once the homepage has dissolved behind the growing card.
    startAskTransition(cardRef.current, () => router.push(href));
  };

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <div className="mb-4">
              <SectionLabel label="Ask PowerMySport AI" color="orange" />
            </div>
            <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Ask before you decide
            </h2>
            <p className="max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
              Questions about a sport, a pathway stage or an upcoming tournament, answered from the
              guides and listings on this site. It needs a free account to chat.
            </p>
          </div>

          <div
            ref={cardRef}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="bg-power-orange-solid flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <p className="font-title text-base font-bold text-slate-900">PowerMySport AI</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(askHref(question));
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <label htmlFor="home-ask" className="sr-only">
                Ask a question about your child&apos;s sport
              </label>
              <input
                id="home-ask"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about a sport or tournament"
                maxLength={300}
                className="focus-visible:border-power-orange-solid focus-visible:ring-power-orange-solid/30 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2"
              />
              <button
                type="submit"
                className="btn-motion bg-power-orange-solid focus-visible:ring-power-orange-solid inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                Ask
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </form>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Try asking
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {ASK_SUGGESTED_QUESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <Link
                    href={askHref(suggestion)}
                    onClick={(event) => go(askHref(suggestion), event)}
                    className="focus-visible:ring-power-orange-solid hover:border-power-orange-solid/40 group flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2"
                  >
                    {suggestion}
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              AI can make mistakes. Check dates and eligibility with the federation before you act.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
