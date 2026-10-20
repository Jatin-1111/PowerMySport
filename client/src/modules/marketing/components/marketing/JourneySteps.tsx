import { cn } from "@/utils/cn";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import React from "react";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * The five steps from the 20 Oct review, shown as one example conversation so a
 * parent can see them happen in order: choose a question, PMS understands, PMS
 * recommends, PMS helps execute, PMS remembers. PMS must gather context before it
 * recommends, so the questions come back before the advice does.
 *
 * Layout ideas from awesome-design-md: Intercom and Slack lead with the product
 * itself as a framed card on a warm band, Airbnb separates rows with hairlines and
 * marks position with a single ink line. The card sits in a thin outer tray with
 * concentric corners; no shadows, one accent used once.
 *
 * The conversation is invented and labelled "Example". The titles follow the review.
 * The last step says "remembers" where the review says "learns", and does not
 * promise that outcomes change future recommendations: outcomes are kept (decisions,
 * check-ins) but nothing reads them back yet. Change it when that is built.
 */

interface Message {
  from: "parent" | "pms";
  text: React.ReactNode;
}

interface Step {
  title: string;
  description: string;
  messages: Message[];
}

const STEPS: Step[] = [
  {
    title: "Choose a question",
    description: "Pick a suggested question, or describe what you want for your child.",
    messages: [{ from: "parent", text: "Is my child ready to start competing?" }],
  },
  {
    title: "PMS understands",
    description:
      "We ask about your child, your goals, their current level and anything that limits you.",
    messages: [
      {
        from: "pms",
        text: "Happy to help. A few questions first. How old is she, and how long has she played? What would you like from this season? Any limits on time, budget or travel?",
      },
      {
        from: "parent",
        text: "She is 9 and has played tennis for two years. A first district event would be great. We can travel up to two hours.",
      },
    ],
  },
  {
    title: "PMS recommends",
    description:
      "Your child's situation is combined with what we know about the sport, and the next step is explained.",
    messages: [
      {
        from: "pms",
        text: "At 9, with two years of play, a district junior event is a sensible first one. The District Junior Open in Pune is under two hours away, and entries close in 6 days.",
      },
    ],
  },
  {
    title: "PMS helps execute",
    description:
      "Find the options, connect with experts, plan the season, book or complete the step.",
    messages: [
      { from: "parent", text: "Can you add it to her plan?" },
      {
        from: "pms",
        text: (
          <>
            Added to Anaya&apos;s season plan. Here is the entry page.
            <span className="border-ink/15 mt-2 block rounded-md border bg-white px-3 py-2">
              <span className="text-ink block text-sm font-semibold">
                District Junior Open, Pune
              </span>
              <span className="text-ink-muted block text-sm">Entries close in 6 days</span>
            </span>
          </>
        ),
      },
    ],
  },
  {
    title: "PMS remembers",
    description:
      "Your decisions and check-ins are kept with your child's journey, so you can pick up where you left off.",
    messages: [
      {
        from: "pms",
        text: "I have saved this with Anaya's journey. I will check in with you in four weeks to see how it went.",
      },
    ],
  },
];

function Bubble({ from, children }: { from: Message["from"]; children: React.ReactNode }) {
  const parent = from === "parent";
  return (
    <p
      className={cn(
        "max-w-[88%] text-pretty px-4 py-3 text-[0.9375rem] leading-snug sm:max-w-[80%]",
        parent
          ? "bg-ink ml-auto rounded-2xl rounded-br-md text-white"
          : "bg-paper-deep text-ink rounded-2xl rounded-bl-md"
      )}
    >
      {children}
    </p>
  );
}

export function JourneySteps() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div className="reveal-on-scroll lg:sticky lg:top-28 lg:self-start">
            <SectionKicker label="How it works" />
            <h2 className={`${SECTION_HEADING} mb-6`}>From questions to action</h2>
            <p className="text-ink-body max-w-[44ch] text-pretty text-lg leading-relaxed">
              Here is how one conversation can go, from a first question to a plan.
            </p>

            {/* A visual index of the five steps, in the same order as the thread. */}
            <ol aria-hidden className="mt-10 hidden lg:block">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="border-hairline first:border-t-ink/25 flex items-baseline gap-4 border-t py-3"
                >
                  <span className="font-editorial text-ink-muted w-5 text-xl font-light tabular-nums">
                    {index + 1}
                  </span>
                  <span className="text-ink text-base font-medium">{step.title}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* The thread. A thin outer tray with concentric corners around a white card. */}
          <div className="border-hairline bg-paper-deep/60 rounded-3xl border p-2 sm:p-2.5">
            <div className="rounded-[1.0625rem] bg-white sm:rounded-[1.25rem]">
              <div className="border-hairline flex items-center gap-3 border-b px-5 py-4 sm:px-6">
                <span
                  aria-hidden
                  className="bg-paper-deep text-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-semibold leading-tight">PowerMySport</p>
                  <p className="text-ink-muted whitespace-nowrap text-sm">On WhatsApp</p>
                </div>
                <span className="border-ink/25 text-ink-muted inline-block rounded-sm border px-1.5 py-0.5 text-xs font-medium">
                  Example
                </span>
              </div>

              <ol className="px-5 pb-6 pt-2 sm:px-6 sm:pb-8">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="reveal-on-scroll pt-6">
                    <div className="mb-4 flex items-start gap-3">
                      <span className="font-editorial text-ink w-6 shrink-0 text-3xl font-light tabular-nums leading-none">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-ink text-base font-semibold leading-tight">
                          {step.title}
                        </h3>
                        <p className="text-ink-muted mt-1 text-sm leading-snug">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pl-9">
                      {step.messages.map((message, i) => (
                        <Bubble key={i} from={message.from}>
                          {message.text}
                        </Bubble>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
