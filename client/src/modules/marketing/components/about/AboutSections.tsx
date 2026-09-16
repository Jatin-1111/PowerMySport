import { ArrowRight, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { ORGANIZATION } from "@/lib/seo";
import {
  LIVE_CAPABILITIES,
  PHASES,
  PRINCIPLES,
  SAFETY_COMMITMENTS,
  TEAM,
} from "@/modules/marketing/data/about";

// ─── /about sections ─────────────────────────────────────────────────────────
//
// Server components. The page is prose and facts, so none of it needs to be a
// client component, and the reveals are the `.reveal-on-scroll` CSS utility in
// globals.css rather than a framer-motion stagger.

const SURFACE = "rounded-2xl border border-white/70 bg-white/80 backdrop-blur-sm premium-shadow";

function SectionHead({
  eyebrow,
  title,
  children,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-power-orange text-[11px] font-black uppercase tracking-[0.2em]">
        {eyebrow}
      </p>
      <h2 className="font-title mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      {children && (
        <p
          className={`mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base ${
            centered ? "mx-auto" : ""
          }`}
        >
          {children}
        </p>
      )}
    </div>
  );
}

/** The problem, in the words a parent would use for it. */
export function WhyWeExist() {
  return (
    <section className="reveal-on-scroll relative overflow-hidden py-16 sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute left-0 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-100/40 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHead
              align="left"
              eyebrow="Why we exist"
              title="The system assumes you already know how it works"
            />
            <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-slate-600 sm:text-base">
              <p>
                Every parent starts in the same place. Which sport suits your child. Which academy
                is worth the fees. When trials happen, who runs them, and what a district tournament
                actually requires. The answers exist, scattered across federation PDFs, WhatsApp
                groups, and whoever happens to be standing next to you at the ground.
              </p>
              <p>
                Nobody has written it down for you. So you guess, you ask around, and you hope the
                person you asked knew more than you did.
              </p>
              <p className="font-semibold text-slate-900">
                We started PowerMySport because that is a poor way to make decisions about a
                child&apos;s decade.
              </p>
            </div>
          </div>

          <div className="premium-shadow group relative h-[320px] overflow-hidden rounded-3xl shadow-2xl sm:h-[400px] lg:h-[460px]">
            <Image
              src="https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=1200&q=80"
              alt="Children playing sport on an outdoor court"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

interface LiveTodayProps {
  /** Names of the sports we publish a pathway guide for, newest list from the API. */
  sportNames?: string[];
  /** Federations we publish a fact sheet for. */
  federationCount?: number;
}

/**
 * Turn a live list into the phrase a parent would actually read.
 *
 * At two sports "Tennis and chess" says more than "2" does, and is the same
 * fact. Past four the names stop being scannable and the count carries it. The
 * empty case returns nothing rather than a zero, so an API outage drops the
 * detail line instead of advertising that we publish nothing.
 */
function coverage(names: string[] | undefined, noun: string): string | null {
  if (!names || names.length === 0) return null;
  const titled = names.map((n) => n.trim()).filter(Boolean);
  if (titled.length === 0) return null;
  if (titled.length > 4) return `${titled.length} ${noun}s today.`;
  if (titled.length === 1) return `${titled[0]} today, with more being written.`;
  return `${titled.slice(0, -1).join(", ")} and ${titled[titled.length - 1]} today, with more being written.`;
}

/**
 * What is actually usable today.
 *
 * The detail lines are read from the same endpoints /roadmap and /federations
 * render from, so the page cannot claim coverage we do not have. A number typed
 * in here would be stale the week after a sport is published, and this is the
 * page where being caught overstating would cost the most.
 */
export function LiveToday({ sportNames, federationCount }: LiveTodayProps) {
  const detail: Record<string, string | null> = {
    "Pathway guides": coverage(sportNames, "sport"),
    "Federations and their calendars":
      federationCount && federationCount > 0
        ? `${federationCount} governing bodies covered today.`
        : null,
  };

  return (
    <section className="reveal-on-scroll border-y border-white/60 bg-white/50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Live today" title="What you can use right now">
          We would rather ship one thing that works than six that almost do. All of this is free.
        </SectionHead>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {LIVE_CAPABILITIES.map((item) => (
            <li key={item.title} className={`flex h-full flex-col gap-2 p-5 ${SURFACE}`}>
              <h3 className="text-[15px] font-bold leading-snug text-slate-900">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
              {detail[item.title] && (
                <p className="text-power-orange mt-auto pt-1 text-[13px] font-semibold">
                  {detail[item.title]}
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-8 text-center">
          <Link
            href="/how-it-works"
            className="text-power-orange group inline-flex items-center gap-1.5 text-sm font-bold"
          >
            See how it works
            <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Three principles that commit us to something falsifiable. */
export function Principles() {
  return (
    <section className="reveal-on-scroll py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="What we believe" title="Three things we hold to">
          Not values in the abstract, the rules we lose arguments to.
        </SectionHead>

        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {PRINCIPLES.map((principle, i) => (
            <li key={principle.title} className={`flex h-full flex-col gap-3 p-6 ${SURFACE}`}>
              <span className="text-power-orange text-[11px] font-black tabular-nums tracking-[0.2em]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-bold leading-snug text-slate-900">{principle.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{principle.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Pre-empts the "what's the catch" question the free product invites. */
export function WhyItsFree() {
  return (
    <section className="reveal-on-scroll border-y border-white/60 bg-white/50 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <SectionHead eyebrow="The obvious question" title="So what's the catch?">
          There isn&apos;t one, and this is the honest accounting.
        </SectionHead>
        <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-slate-600 sm:text-base">
          <p>
            The roadmap, the pathway guides and the guidance are free, and they are how you find out
            whether we are worth trusting at all. Charging for them would mean asking you to pay
            before you can tell.
          </p>
          <p>
            Later, we intend to earn money from the parts where we genuinely save you effort,
            bookings, gear, and helping academies and coaches reach the families looking for them.
            When that arrives, it will be obvious which part you are paying for.
          </p>
        </div>
      </div>
    </section>
  );
}

/** The section a parent scrolls this page looking for. */
export function ChildSafety() {
  return (
    <section className="reveal-on-scroll py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Your child's data" title="Built around a child, carefully">
          A dependent profile exists to make their plan better, and for nothing else.
        </SectionHead>

        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {SAFETY_COMMITMENTS.map((item) => (
            <li key={item.title} className={`flex h-full flex-col gap-2.5 p-6 ${SURFACE}`}>
              <h3 className="text-[15px] font-bold leading-snug text-slate-900">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-slate-500">
          In full:{" "}
          <Link
            href="/privacy"
            className="font-semibold text-slate-700 underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          {" · "}
          <Link
            href="/parental-consent"
            className="font-semibold text-slate-700 underline-offset-2 hover:underline"
          >
            Parental Consent &amp; Minor Protection
          </Link>
          {" · "}
          <Link
            href="/content-policy"
            className="font-semibold text-slate-700 underline-offset-2 hover:underline"
          >
            Content Policy
          </Link>
        </p>
      </div>
    </section>
  );
}

/** The team, described honestly rather than aspirationally. */
export function WhoWeAre() {
  return (
    <section className="reveal-on-scroll border-y border-white/60 bg-white/50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Who's building this" title="A small team, building in the open">
          Three engineers in {ORGANIZATION.addressLocality}, {ORGANIZATION.addressRegion}, who got
          tired of watching families guess. We are not a sports institution and we do not pretend to
          be, what we do is read the federation documents nobody else will, talk to coaches and
          parents, and turn what we learn into something you can act on in ten minutes.
        </SectionHead>

        <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          {TEAM.map((member) => (
            <li
              key={member.name}
              className={`flex h-full flex-col gap-1.5 p-6 text-center ${SURFACE}`}
            >
              <h3 className="text-base font-bold text-slate-900">{member.name}</h3>
              <p className="text-power-orange text-xs font-semibold uppercase tracking-wider">
                {member.role}
              </p>
              <p className="text-sm leading-relaxed text-slate-600">{member.desc}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-slate-600">
          When we get something wrong, tell us.{" "}
          <a
            href={`mailto:${ORGANIZATION.email}`}
            className="text-power-orange inline-flex items-center gap-1 font-semibold"
          >
            <Mail aria-hidden className="h-3.5 w-3.5" />
            {ORGANIZATION.email}
          </a>{" "}
          reaches all three of us. We are also{" "}
          <Link
            href="/careers"
            className="font-semibold text-slate-700 underline underline-offset-2"
          >
            hiring
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/** Where this goes, phrased as shipping order rather than ambition. */
export function WhatsNext() {
  return (
    <section className="reveal-on-scroll py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="What's next" title="We build in phases, on purpose">
          Each piece ships when it is genuinely useful, not when a roadmap says it is due.
        </SectionHead>

        <ol className="mt-10 space-y-3">
          {PHASES.map((phase) => (
            <li
              key={phase.when}
              className={`flex flex-col gap-1.5 p-5 sm:flex-row sm:items-baseline sm:gap-6 ${SURFACE}`}
            >
              <span className="text-power-orange w-24 shrink-0 text-[11px] font-black uppercase tracking-[0.2em]">
                {phase.when}
              </span>
              <span className="text-[15px] leading-relaxed text-slate-700">{phase.what}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Quiet, high-trust: who you are actually dealing with. */
export function CompanyFacts() {
  return (
    <section className="border-t border-slate-200/70 py-10">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-slate-700">{ORGANIZATION.legalName}</p>
        <p className="mt-1 text-sm text-slate-500">
          {ORGANIZATION.addressLocality}, {ORGANIZATION.addressRegion}, India · Founded{" "}
          {ORGANIZATION.foundingDate}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          <a href={`mailto:${ORGANIZATION.email}`} className="hover:text-slate-700">
            {ORGANIZATION.email}
          </a>
          {" · "}
          <a href={`tel:${ORGANIZATION.phone}`} className="hover:text-slate-700">
            {ORGANIZATION.phone}
          </a>
        </p>
      </div>
    </section>
  );
}
