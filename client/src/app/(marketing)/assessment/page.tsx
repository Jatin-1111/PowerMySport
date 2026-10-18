"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

const PATHS = [
  {
    href: "/assessment/discover",
    kicker: "Not sure yet?",
    title: "Help me find a sport",
    body: "Answer a few questions about your child's personality, physical traits and goals. We'll recommend the best sport match.",
    time: "About 5 minutes",
    cta: "Find the sport",
  },
  {
    href: "/sport-profile",
    kicker: "Already know it?",
    title: "Build the profile",
    body: "Tell us your child's sport and we'll build their profile, so the roadmap and guidance fit exactly where they are.",
    time: "About 5 minutes, more questions",
    cta: "Build the profile",
  },
] as const;

export default function AssessmentPage() {
  return (
    <div className="bg-paper flex-1 px-4 pb-24 pt-16 sm:pt-24">
      <div className="mx-auto w-full max-w-4xl">
        <header className="max-w-2xl">
          <p className="text-ink-muted text-sm">Get started</p>
          <h1 className="font-editorial text-ink mt-3 text-balance text-4xl font-light leading-tight tracking-tight sm:text-6xl">
            How can we help you <span className="italic">today?</span>
          </h1>
          <p className="text-ink-body mt-5 max-w-xl text-pretty text-lg leading-relaxed">
            Whether you already know the sport or not, we&apos;ll build the right plan for your
            child.
          </p>
        </header>

        <ul className="border-hairline sm:divide-hairline mt-14 grid border-y sm:grid-cols-2 sm:divide-x">
          {PATHS.map((path) => (
            <li key={path.href} className="border-hairline border-b last:border-b-0 sm:border-b-0">
              <Link
                href={path.href}
                className="focus-visible:ring-ink hover:bg-paper-deep/60 group flex h-full flex-col px-1 py-8 transition-colors focus-visible:outline-none focus-visible:ring-2 sm:px-8 sm:first:pl-1 sm:last:pr-1"
              >
                <p className="text-ink-muted text-sm">{path.kicker}</p>
                <h2 className="font-editorial text-ink mt-2 text-3xl font-light tracking-tight">
                  {path.title}
                </h2>
                <p className="text-ink-body mt-3 flex-1 text-pretty leading-relaxed">{path.body}</p>
                <div className="mt-8 flex items-center justify-between gap-4">
                  <span className="text-ink-muted text-sm">{path.time}</span>
                  <span className="text-ink inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 group-hover:underline">
                    {path.cta}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-ink-muted mt-6 text-sm">Free to use. No account needed to explore.</p>
      </div>
    </div>
  );
}
