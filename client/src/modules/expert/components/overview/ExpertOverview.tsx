"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { useExpertConsole } from "@/modules/expert/hooks/useExpertConsole";
import {
  describeExpertStatus,
  modeLabel,
  openDays,
  selectRequests,
  selectUpcoming,
  sessionFigures,
  sessionTitle,
  whenLabel,
} from "@/modules/expert/utils/sessions";
import { Button } from "@/modules/shared/ui/Button";
import { FIGURE_GRID, FigureGridSkeleton } from "@/modules/shared/ui/FigureGrid";
import { StatTile } from "@/modules/shared/ui/StatTile";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { formatRupees, plural } from "@/modules/shared/utils/figures";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ExpertRequestsBand } from "./ExpertRequestsBand";
import { ListingFacts } from "./ListingFacts";
import { OverviewSkeleton } from "./OverviewSkeleton";

/**
 * The expert's landing page. It answers, in order: is anything waiting on me,
 * what is coming up, and how is it going. The requests band appears only while
 * there is a time to confirm, and the status band only while the profile is not
 * live; everything else is real data or an honest empty line.
 */
export function ExpertOverview() {
  const { profile, sessions } = useExpertConsole();
  const userName = useAuthStore((state) => state.user?.name);

  if (profile.isPending) return <OverviewSkeleton />;

  if (profile.isError) {
    return (
      <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
        <h1 className="font-editorial text-ink text-3xl font-light tracking-tight">
          We could not load your dashboard
        </h1>
        <p className="text-ink-body mt-3 text-pretty">
          Check your connection and try again. Your profile and sessions are safe.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => profile.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const expert = profile.data;
  const now = new Date();
  const status = describeExpertStatus(expert);
  const list = sessions.data ?? [];
  const requests = selectRequests(list);
  const upcoming = selectUpcoming(list, now, 5);
  const figures = sessionFigures(list);
  const publicId = expert.id || expert._id;

  return (
    <div className="space-y-10 sm:space-y-14">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-ink-body text-sm">Expert console</p>
          <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
            {userName || expert.name || "Your sessions"}
          </h1>
          <p className="text-ink-body mt-3">
            {[expert.sports.join(", "), `${formatRupees(expert.sessionFee)} a session`]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusTag tone={status.tone}>{status.tag}</StatusTag>
          {status.tone === "live" && publicId && (
            <Link href={`/experts/${publicId}`} className={`${TEXT_LINK} ring-offset-paper`}>
              View public profile
              <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      {requests.length > 0 && <ExpertRequestsBand requests={requests} />}

      {status.headline && (
        <section aria-labelledby="status-heading" className="bg-paper-deep rounded-2xl p-6 sm:p-8">
          <h2
            id="status-heading"
            className="font-editorial text-ink text-balance text-2xl font-light tracking-tight sm:text-3xl"
          >
            {status.headline}
          </h2>
          {status.body && (
            <p className="text-ink-body mt-3 max-w-[60ch] text-pretty">{status.body}</p>
          )}
          {status.tone !== "pending" && (
            <div className="mt-6">
              <Button asChild>
                <Link href="/expert/onboarding">
                  {status.tone === "alert" ? "Update and resubmit" : "Continue setup"}
                  <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </Button>
            </div>
          )}
        </section>
      )}

      {sessions.isPending ? (
        <FigureGridSkeleton />
      ) : sessions.isError ? (
        <div role="alert" className="bg-paper-deep max-w-xl rounded-xl p-5">
          <p className="text-ink font-medium">We could not load your sessions</p>
          <p className="text-ink-body mt-1 text-sm">The rest of this page is up to date.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => sessions.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className={FIGURE_GRID}>
          <StatTile
            emphasis
            label="Session fees"
            value={formatRupees(figures.collected)}
            sub={`from ${plural(figures.completedCount, "completed session")}`}
          />
          <StatTile
            label="Still to come"
            value={formatRupees(figures.stillToCome)}
            sub={plural(figures.comingCount, "paid session")}
          />
          <StatTile label="Sessions" value={list.length} sub={`${upcoming.length} upcoming`} />
          {expert.reviewCount > 0 ? (
            <StatTile
              label="Rating"
              value={expert.rating.toFixed(1)}
              sub={plural(expert.reviewCount, "review")}
            />
          ) : (
            <StatTile
              label="Rating"
              value={<span className="text-2xl">No reviews yet</span>}
              sub="Parents can review after a completed session"
            />
          )}
        </div>
      )}

      <div className="grid gap-12 xl:grid-cols-12 xl:gap-16">
        <section aria-labelledby="next-heading" className="xl:col-span-7">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="next-heading" className="text-ink text-base font-semibold">
              Next sessions
            </h2>
            <Link href="/expert/sessions" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
              All sessions
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>

          {sessions.isError ? (
            <p role="alert" className="text-ink-body border-hairline mt-4 border-t pt-5">
              We could not load your sessions. Refresh to try again.
            </p>
          ) : upcoming.length === 0 ? (
            <p className="text-ink-body border-hairline mt-4 max-w-[56ch] text-pretty border-t pt-5">
              Nothing is confirmed yet. Sessions you accept appear here, soonest first. Opening more
              of your week in your availability makes it easier for parents to book.
            </p>
          ) : (
            <ul className="border-hairline mt-4 border-t">
              {upcoming.map((session) => (
                <li
                  key={session.id || session._id}
                  className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5"
                >
                  <p className="text-ink font-medium tabular-nums">{whenLabel(session)}</p>
                  <p className="text-ink-body min-w-0 truncate text-right text-sm">
                    {[sessionTitle(session), modeLabel(session.mode)].filter(Boolean).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="xl:col-span-5">
          <ListingFacts expert={expert} days={openDays(expert)} />
        </div>
      </div>
    </div>
  );
}
