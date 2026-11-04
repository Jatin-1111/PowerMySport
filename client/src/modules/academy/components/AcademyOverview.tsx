"use client";

import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { Button } from "@/modules/shared/ui/Button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useAcademyOverview } from "../hooks/useAcademyOverview";
import { describeAcademyStatus } from "../utils/academyStatus";
import { AtAGlance } from "./AtAGlance";
import { FigureGridSkeleton } from "@/modules/shared/ui/FigureGrid";
import { FigureStrip } from "./FigureStrip";
import { OverviewSkeleton } from "./OverviewSkeleton";
import { RecentBookings } from "./RecentBookings";
import { StatusBand } from "./StatusBand";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { StatusTag } from "@/modules/shared/ui/StatusTag";

/**
 * The academy owner's landing page. It answers three questions in order: where
 * does my academy stand, what do I do next, and (once it is live) how is it
 * doing. Each state has its own message and one action; the figures appear only
 * when there is something real to show.
 */
export function AcademyOverview() {
  const { academy, earnings, analytics, wantsFigures } = useAcademyOverview();
  const unreadNotifications = useUnreadNotificationCount();

  if (academy.isPending) return <OverviewSkeleton />;

  if (academy.isError) {
    return (
      <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
        <h1 className="font-editorial text-ink text-3xl font-light tracking-tight">
          We could not load your dashboard
        </h1>
        <p className="text-ink-body mt-3 text-pretty">
          Check your connection and try again. Your academy details are safe.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => academy.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const data = academy.data;
  const view = describeAcademyStatus(data);
  const meta = [data?.city, data?.sports.join(", ")].filter(Boolean).join(", ");

  return (
    <div className="space-y-10 sm:space-y-14">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-ink-body text-sm">Academy console</p>
          <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
            {data?.name || "Your academy"}
          </h1>
          {meta && <p className="text-ink-body mt-3">{meta}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {data && <StatusTag tone={view.tone}>{view.tag}</StatusTag>}
          {view.tone === "live" && view.primary && (
            <Link href={view.primary.href} className={`${TEXT_LINK} ring-offset-paper`}>
              {view.primary.label}
              <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      {view.tone !== "live" && <StatusBand view={view} academy={data} />}

      {wantsFigures && data && (
        <>
          {earnings.isPending ? (
            <FigureGridSkeleton />
          ) : earnings.isError ? (
            <div role="alert" className="bg-paper-deep max-w-xl rounded-xl p-5">
              <p className="text-ink font-medium">We could not load your earnings</p>
              <p className="text-ink-body mt-1 text-sm">
                Your academy status above is up to date. Try again in a moment.
              </p>
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={() => earnings.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              <FigureStrip
                earnings={earnings.data}
                analytics={analytics.data}
                analyticsFailed={analytics.isError}
              />
              <div className="grid gap-12 xl:grid-cols-12 xl:gap-16">
                <div className="xl:col-span-7">
                  <RecentBookings bookings={earnings.data.recentBookings} />
                </div>
                <div className="xl:col-span-5">
                  <AtAGlance
                    academy={data}
                    analytics={analytics.data}
                    unreadNotifications={unreadNotifications}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
