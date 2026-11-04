"use client";

import { useExpertConsole } from "@/modules/expert/hooks/useExpertConsole";
import {
  countByFilter,
  filterSessions,
  selectRequests,
  type SessionFilter,
} from "@/modules/expert/utils/sessions";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { UnderlineFilter } from "@/modules/shared/ui/UnderlineFilter";
import { plural } from "@/modules/shared/utils/figures";
import { useMemo, useState } from "react";
import { SessionRow } from "./SessionRow";

const EMPTY: Record<SessionFilter, string> = {
  upcoming: "No upcoming sessions. Sessions you accept appear here, soonest first.",
  completed: "No completed sessions yet.",
  cancelled: "No cancelled sessions.",
  all: "Nothing here yet.",
};

/**
 * Every session the expert has: requests waiting on them first, set on a tonal
 * band with their answers inline, then the rest filtered by where they stand.
 */
export function ExpertSessions() {
  const { sessions, updateSession } = useExpertConsole();
  const [filter, setFilter] = useState<SessionFilter>("upcoming");

  const all = useMemo(() => sessions.data ?? [], [sessions.data]);
  const requests = useMemo(() => selectRequests(all), [all]);
  const counts = useMemo(() => countByFilter(all), [all]);
  const shown = useMemo(() => filterSessions(all, filter), [all, filter]);

  const header = (
    <header>
      <p className="text-ink-body text-sm">Expert console</p>
      <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
        Sessions
      </h1>
      {sessions.isSuccess && all.length > 0 && (
        <p className="text-ink-body mt-3">
          {plural(all.length, "session")}, {counts.upcoming} upcoming
          {requests.length > 0 && `, ${requests.length} waiting for your reply`}.
        </p>
      )}
    </header>
  );

  if (sessions.isPending) {
    return (
      <div className="space-y-10" role="status" aria-busy="true">
        <span className="sr-only">Loading your sessions</span>
        <div aria-hidden="true">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-11 w-56" />
        </div>
        <div aria-hidden="true" className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (sessions.isError) {
    return (
      <div className="space-y-10">
        {header}
        <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
          <h2 className="font-editorial text-ink text-2xl font-light tracking-tight">
            We could not load your sessions
          </h2>
          <p className="text-ink-body mt-2 text-pretty">
            Check your connection and try again. Your sessions are safe.
          </p>
          <Button className="mt-5" variant="secondary" onClick={() => sessions.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="space-y-10">
        {header}
        <div className="border-hairline max-w-xl border-t pt-6">
          <p className="text-ink-body text-pretty">
            No sessions yet. When a parent books you, the request appears here for you to accept,
            reschedule or decline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      {header}

      {requests.length > 0 && (
        <section
          aria-labelledby="requests-heading"
          className="bg-paper-deep rounded-2xl p-6 sm:p-8"
        >
          <h2
            id="requests-heading"
            className="font-editorial text-ink text-balance text-2xl font-light tracking-tight sm:text-3xl"
          >
            {requests.length === 1
              ? "1 session needs your reply"
              : `${requests.length} sessions need your reply`}
          </h2>
          <p className="text-ink-body mt-2 max-w-[56ch] text-pretty">
            Accept the time, suggest another or decline, so the parent knows where they stand.
          </p>
          <ul className="mt-6" aria-label="Sessions waiting for your reply">
            {requests.map((session) => (
              <SessionRow
                key={session.id || session._id}
                session={session}
                onChange={updateSession}
                onBand
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="sr-only">
          Sessions
        </h2>
        <UnderlineFilter
          label="Filter sessions"
          value={filter}
          onChange={setFilter}
          items={[
            { label: "Upcoming", value: "upcoming", count: counts.upcoming },
            { label: "Completed", value: "completed", count: counts.completed },
            { label: "Cancelled", value: "cancelled", count: counts.cancelled },
            { label: "All", value: "all", count: counts.all },
          ]}
        />

        {shown.length === 0 ? (
          <p className="text-ink-body border-hairline max-w-[56ch] text-pretty border-b py-6">
            {EMPTY[filter]}
          </p>
        ) : (
          <ul className="border-hairline border-b pt-6">
            {shown.map((session) => (
              <SessionRow
                key={session.id || session._id}
                session={session}
                onChange={updateSession}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
