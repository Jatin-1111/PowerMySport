import { ArrowRight, CalendarDays, ListChecks, ShieldCheck } from "lucide-react";
import Link from "next/link";

/**
 * What a signed-out visitor sees at /planner.
 *
 * The way in comes first, because it is the one thing this page asks of them;
 * the three points under it are the reasons to take it. There is no sample plan
 * with made-up players, ranks or costs on purpose: an invented example on a page
 * about reliability would be the one dishonest thing on it. The points are what
 * the tool actually does today.
 */

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Only events your child can enter",
    body: "Each junior event is checked against AITA's entry rules for their age group and rank. Closed events stay visible, with the reason.",
  },
  {
    icon: ListChecks,
    title: "A plan that spots clashes",
    body: "Pick events and they line up by date. Overlaps, tight gaps and deadlines about to pass are flagged.",
  },
  {
    icon: CalendarDays,
    title: "Straight into your calendar",
    body: "Add an event to Google Calendar, or download the whole plan as a calendar file.",
  },
] as const;

export function PlannerLanding() {
  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-editorial text-xl font-normal text-slate-900">
          Plan your child&apos;s tennis season
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Sign in so we can use your child&apos;s profile and linked ranking. Tennis only for now.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href="/login?redirect=/planner"
            className="bg-power-orange-solid inline-flex min-h-11 items-center rounded-md px-6 text-sm font-semibold text-white hover:bg-orange-800"
          >
            Sign in
          </Link>
          <Link
            href="/register?redirect=/planner"
            className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-900 hover:border-slate-900 hover:bg-slate-50"
          >
            Create an account
          </Link>
          <Link
            href="/tournaments"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-orange-700 hover:underline"
          >
            Browse tournaments without an account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-lg border border-slate-200 bg-white p-5">
            <Icon className="h-5 w-5 text-slate-500" aria-hidden />
            <h3 className="mt-3 text-base font-bold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
