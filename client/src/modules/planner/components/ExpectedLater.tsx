import type { ExpectedEvent } from "@/modules/planner/services/planner";
import { formatLongDate } from "@/modules/planner/utils/eventFormat";
import { MapPin } from "lucide-react";

/**
 * What last year suggests is coming in the months the calendar has not reached.
 *
 * AITA publishes about ten weeks ahead, so the planner can only show eleven weeks. The
 * junior circuit repeats, so an event that ran about a year ago and is not on the calendar
 * yet is worth knowing about when planning travel and exams. It is shown as EXPECTED:
 * a month and never a day, with what it is based on, and with nothing to add to a plan,
 * because it is not on the calendar, has no dates and no entry, and may not run at all.
 */

export function ExpectedLater({ events }: { events: ExpectedEvent[] }) {
  const months = [...new Set(events.map((event) => event.month))].sort();

  return (
    <div>
      <p className="text-sm leading-relaxed text-slate-700">
        These are not on the calendar. They ran at about this time last year, so they may come
        again. Nothing is confirmed: no dates, no entry, and an event can be moved or not held.
      </p>
      {months.map((month) => {
        const inMonth = events.filter((event) => event.month === month);
        return (
          <section key={month} aria-labelledby={`expected-${month}`} className="mt-5">
            <h3
              id={`expected-${month}`}
              className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-500"
            >
              Expected around {inMonth[0]!.expectedMonth}
            </h3>
            <ul className="space-y-2">
              {inMonth.map((event) => (
                <li
                  key={`${event.name}-${event.lastYearStart}`}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                >
                  <p className="font-semibold text-slate-900">{event.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                    {(event.city || event.state) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {[event.city, event.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {event.ladder && <span>{event.ladder}</span>}
                    <span>Last year it began {formatLongDate(event.lastYearStart)}.</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
