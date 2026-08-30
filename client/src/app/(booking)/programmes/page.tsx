"use client";

import { useBrowseProgrammes } from "@/modules/coach/hooks/useCoachPrograms";
import {
  DeliveryBadge,
  SeatsLabel,
  formatSchedule,
} from "@/modules/coach/components/programs/programDisplay";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { CoachOffering } from "@/types/coachPrograms";
import { CalendarRange, Globe } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/**
 * Browse recurring coaching programmes.
 *
 * This page exists because coach discovery is a geospatial search: it ranks
 * coaches by distance from the visitor, filtered to those with a base location.
 * A coach who only teaches online has no base location and no service radius,
 * so they are structurally invisible there — no filter change could surface
 * them. This is the non-geographic lane.
 */

const SPORTS = ["Chess", "Tennis", "Badminton", "Football", "Cricket"];

/**
 * `useSearchParams` needs a Suspense boundary in this Next version, and the
 * deep link from coach discovery (`/programmes?online=true`) depends on it —
 * that link is how an online-only coach is reachable at all.
 */
export default function ProgrammesPage() {
  return (
    <Suspense fallback={null}>
      <ProgrammesBrowser />
    </Suspense>
  );
}

function ProgrammesBrowser() {
  const searchParams = useSearchParams();
  const [onlineOnly, setOnlineOnly] = useState(
    searchParams.get("online") === "true",
  );
  const [sport, setSport] = useState<string>(searchParams.get("sport") ?? "");

  const { data: offerings = [], isPending } = useBrowseProgrammes({
    sport,
    online: onlineOnly,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Coaching programmes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regular classes with the same coach every week — one-to-one or in a
          small batch, in person or online.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant={onlineOnly ? "primary" : "outline"}
          size="sm"
          onClick={() => setOnlineOnly((value) => !value)}
          aria-pressed={onlineOnly}
        >
          <Globe className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Online only
        </Button>

        <Button
          variant={sport === "" ? "primary" : "outline"}
          size="sm"
          onClick={() => setSport("")}
        >
          All sports
        </Button>
        {SPORTS.map((option) => (
          <Button
            key={option}
            variant={sport === option ? "primary" : "outline"}
            size="sm"
            onClick={() => setSport(option)}
          >
            {option}
          </Button>
        ))}
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : offerings.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No programmes yet"
          description={
            onlineOnly
              ? "No online programmes match this filter. Try clearing it."
              : "No coaching programmes are open right now. Check back soon."
          }
          {...(onlineOnly
            ? {
                actionLabel: "Clear the online filter",
                onAction: () => setOnlineOnly(false),
              }
            : {})}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {offerings.map((offering) => (
            <li key={offering.id}>
              <ProgrammeCard offering={offering} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const ProgrammeCard = ({ offering }: { offering: CoachOffering }) => {
  const coach =
    typeof offering.coachId === "object" ? offering.coachId : undefined;
  const coachName = coach?.userId?.name;

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{offering.title}</h2>
          <p className="text-sm text-muted-foreground">
            {offering.sport}
            {coachName ? ` · ${coachName}` : ""}
          </p>
        </div>
        <DeliveryBadge
          kind={offering.deliveryKind}
          {...(offering.onlinePlatform
            ? { platform: offering.onlinePlatform }
            : {})}
        />
      </div>

      {offering.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {offering.description}
        </p>
      ) : null}

      <p className="text-sm">
        {formatSchedule(offering.schedule, offering.timezone)}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <SeatsLabel offering={offering} />
        <Button
          asChild
          size="sm"
          disabled={offering.isFull}
          variant={offering.isFull ? "outline" : "primary"}
        >
          <Link href={`/programmes/${offering.id}`}>
            {offering.isFull ? "Full" : "View"}
          </Link>
        </Button>
      </div>
    </Card>
  );
};
