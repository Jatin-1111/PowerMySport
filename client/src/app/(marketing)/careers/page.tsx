import type { Metadata } from "next";

import { ORGANIZATION } from "@/lib/seo";
import { PRINCIPLES, TEAM } from "@/modules/marketing/data/about";
import { Button } from "@/modules/shared/ui/Button";
import { PageHeader } from "@/modules/shared/ui/PageHeader";
import { Mail } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "PowerMySport is three engineers in Mullanpur, Punjab. What the work is, how we work, and how to get in touch if you want to help.",
  alternates: {
    canonical: "/careers",
  },
};

/**
 * Careers, stated plainly.
 *
 * This page used to list six full-time openings across five cities, with
 * health insurance, learning budgets and "industry-leading salaries and
 * equity". None of it was real, and the About page says, correctly, that we
 * are three engineers in Mullanpur. Everything here comes from that page's own
 * data (`PRINCIPLES`, `TEAM`) or is true of this codebase, so the two pages
 * cannot drift apart again. Add a role here only once it actually exists.
 */
const WORK = [
  {
    title: "Pathway guides",
    description:
      "Reading federation documents, rulebooks and calendars, and turning them into stage-by-stage guides a parent can act on.",
  },
  {
    title: "Rankings and calendars",
    description:
      "Mirroring official federation ranking lists and tournament calendars, and making them searchable.",
  },
  {
    title: "The platform",
    description:
      "A Next.js and TypeScript web app on a Node and MongoDB backend, built and shipped by the three of us.",
  },
];

const MAILTO = `mailto:${ORGANIZATION.email}?subject=${encodeURIComponent("Working on PowerMySport")}`;

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        eyebrow="Careers"
        title="Work with us"
        description={`PowerMySport is three engineers in ${ORGANIZATION.addressLocality}, ${ORGANIZATION.addressRegion}, building the guide we wish every sports parent in India had. We don't post job descriptions. If you want to help, write to us.`}
        width="5xl"
        actions={
          <Button asChild variant="primary" size="lg">
            <a href={MAILTO}>
              <Mail aria-hidden className="h-4 w-4" />
              Email us
            </a>
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl space-y-14 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section aria-labelledby="work-heading">
          <h2 id="work-heading" className="font-title text-2xl font-bold text-slate-900">
            What the work is
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {WORK.map((item) => (
              <li key={item.title} className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="principles-heading">
          <h2 id="principles-heading" className="font-title text-2xl font-bold text-slate-900">
            What we hold to
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <li key={principle.title} className="rounded-lg border border-slate-200 bg-white p-6">
                <p className="text-power-orange-solid text-xs font-bold tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-base font-bold text-slate-900">{principle.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {principle.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="team-heading">
          <h2 id="team-heading" className="font-title text-2xl font-bold text-slate-900">
            Who you would work with
          </h2>
          <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {TEAM.map((member) => (
              <li
                key={member.name}
                className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="w-44 shrink-0 font-semibold text-slate-900">{member.name}</span>
                <span className="text-sm text-slate-600">
                  <span className="font-medium text-slate-700">{member.role}.</span> {member.desc}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="contact-heading"
          className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8"
        >
          <h2 id="contact-heading" className="font-title text-2xl font-bold text-slate-900">
            Get in touch
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Tell us what you would like to work on, and send something you have built, written or
            researched. {ORGANIZATION.email} reaches all three of us.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="primary" size="lg">
              <a href={MAILTO}>
                <Mail aria-hidden className="h-4 w-4" />
                Email us
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">Read our story</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
