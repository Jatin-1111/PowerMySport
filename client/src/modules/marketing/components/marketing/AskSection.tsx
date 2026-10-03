"use client";

import { openAssistantChat } from "@/modules/guidance/utils/assistantLauncher";
import { ArrowRight, MessageCircle } from "lucide-react";
import React, { useState } from "react";
import { SectionLabel } from "./SectionLabel";

// Each of these is something the assistant can answer from real data it can
// look up (pathway levels, upcoming tournaments, the expert directory, the
// site's own policies), so a click never lands on a guess. Tennis is named on
// purpose: it is the sport with the deepest guide today.
const SUGGESTED_QUESTIONS = [
  "Help me pick a sport for my child",
  "What does the Tennis pathway look like, stage by stage?",
  "Which tennis tournaments are coming up?",
  "Can I talk to an expert about my child?",
  "How does PowerMySport work, and is it free?",
];

/**
 * "Ask before you decide": a way into the assistant from the homepage. It does
 * not run a chat of its own. Typing or tapping a question opens the same
 * assistant as the floating button, with the question already sent, so there
 * is one chat to maintain and one set of limits.
 *
 * The assistant needs an account, and the copy says so up front rather than
 * after the parent has typed a question.
 */
export const AskSection: React.FC = () => {
  const [question, setQuestion] = useState("");

  const ask = (text: string) => openAssistantChat(text);

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

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="bg-power-orange-solid flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <p className="font-title text-base font-bold text-slate-900">PowerMySport AI</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
                setQuestion("");
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
              {SUGGESTED_QUESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="focus-visible:ring-power-orange-solid hover:border-power-orange-solid/40 group flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2"
                  >
                    {suggestion}
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </button>
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
