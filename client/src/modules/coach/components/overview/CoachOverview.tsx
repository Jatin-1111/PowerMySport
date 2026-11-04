"use client";

import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { FigureGridSkeleton } from "@/modules/shared/ui/FigureGrid";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { formatRupees } from "@/modules/shared/utils/figures";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCoachOverview } from "../../hooks/useCoachOverview";
import { selectRequests, selectUpcoming, verificationView } from "../../utils/overview";
import { CoachFigures } from "./CoachFigures";
import { NextSessions } from "./NextSessions";
import { OverviewSkeleton } from "./OverviewSkeleton";
import { PracticeFacts } from "./PracticeFacts";
import { RequestsBand } from "./RequestsBand";

/**
 * The coach's landing page. It answers, in order: is anything waiting on me,
 * what is coming up, and how is the practice doing. The requests band appears
 * only while there is a request to answer; everything else is real data or an
 * honest empty line.
 */
export function CoachOverview() {
  const { profile, earnings, analytics, bookings } = useCoachOverview();
  const userName = useAuthStore((state) => state.user?.name);
  const unreadNotifications = useUnreadNotificationCount();

  if (profile.isPending) return <OverviewSkeleton />;

  if (profile.isError) {
    return (
      <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
        <h1 className="font-editorial text-ink text-3xl font-light tracking-tight">
          We could not load your dashboard
        </h1>
        <p className="text-ink-body mt-3 text-pretty">
          Check your connection and try again. Your profile and bookings are safe.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => profile.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const coach = profile.data;
  const now = new Date();
  const status = verificationView(coach);
  const requests = bookings.data ? selectRequests(bookings.data) : [];
  const upcoming = bookings.data ? selectUpcoming(bookings.data, now) : [];
  const publicId = coach.id || coach._id;

  return (
    <div className="space-y-10 sm:space-y-14">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-ink-body text-sm">Coach console</p>
          <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
            {userName || "Your practice"}
          </h1>
          <p className="text-ink-body mt-3">
            {[coach.sports.join(", "), `${formatRupees(coach.hourlyRate)} an hour`]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusTag tone={status.tone}>{status.tag}</StatusTag>
          {status.tone === "live" && publicId && (
            <Link href={`/coaches/${publicId}`} className={`${TEXT_LINK} ring-offset-paper`}>
              View public profile
              <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      {requests.length > 0 && <RequestsBand requests={requests} now={now} />}

      {status.tone === "pending" && (
        <section aria-labelledby="review-heading" className="bg-paper-deep rounded-2xl p-6 sm:p-8">
          <h2
            id="review-heading"
            className="font-editorial text-ink text-balance text-2xl font-light tracking-tight sm:text-3xl"
          >
            Your profile is in review
          </h2>
          <p className="text-ink-body mt-3 max-w-[56ch] text-pretty">
            We are checking the details and documents you sent. You can keep setting up your
            schedule and rates while you wait.
          </p>
        </section>
      )}

      {earnings.isPending ? (
        <FigureGridSkeleton />
      ) : earnings.isError ? (
        <div role="alert" className="bg-paper-deep max-w-xl rounded-xl p-5">
          <p className="text-ink font-medium">We could not load your earnings</p>
          <p className="text-ink-body mt-1 text-sm">The rest of this page is up to date.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => earnings.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <CoachFigures
          earnings={earnings.data}
          analytics={analytics.data}
          analyticsFailed={analytics.isError}
          coach={coach}
        />
      )}

      <div className="grid gap-12 xl:grid-cols-12 xl:gap-16">
        <div className="xl:col-span-7">
          <NextSessions sessions={upcoming} now={now} failed={bookings.isError} />
        </div>
        <div className="xl:col-span-5">
          <PracticeFacts coach={coach} unreadNotifications={unreadNotifications} />
        </div>
      </div>
    </div>
  );
}
