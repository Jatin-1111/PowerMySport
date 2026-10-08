import { ArrowRight, CalendarDays, ListChecks, ShieldCheck } from "lucide-react";
import Link from "next/link";

/**
 * What a signed-out visitor sees at /planner.
 *
 * It explains what the tool does in plain terms and asks them in. There is no
 * sample plan with made-up players, ranks or costs on purpose: an invented
 * example on a page about reliability would be the one dishonest thing on it.
 * The three points below are what the tool actually does today.
 */

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Only events your child can enter",
    body: "Every upcoming junior event is checked against AITA's published entry rules for their age group and rank. Events that are closed to them are shown with the reason, not hidden.",
  },
  {
    icon: ListChecks,
    title: "A plan that spots clashes",
    body: "Choose events and they line up in date order. Overlaps and tight gaps between events are flagged, and so is an entry deadline that is about to pass.",
  },
  {
    icon: CalendarDays,
    title: "Straight into your calendar",
    body: "Add any event to Google Calendar, or download the whole plan as a calendar file for any other app.",
  },
] as const;

export function PlannerLanding() {
  return (
    <div className="space-y-8">
      <ul className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-lg border border-slate-200 bg-white p-5">
            <Icon className="h-5 w-5 text-slate-500" aria-hidden />
            <h2 className="mt-3 text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-title text-lg font-extrabold text-slate-900">
          Sign in to plan a season
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          The planner works from your child&apos;s profile and their linked ranking, so it needs
          your account. It covers tennis for now.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link
            href="/login?redirect=/planner"
            className="bg-power-orange-solid inline-flex min-h-10 items-center rounded-md px-5 text-sm font-semibold text-white hover:bg-orange-800"
          >
            Sign in
          </Link>
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline"
          >
            Browse tournaments without an account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
