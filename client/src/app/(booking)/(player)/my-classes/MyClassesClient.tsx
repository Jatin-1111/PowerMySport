"use client";

import {
  ConnectionDetail,
  DeliveryBadge,
  formatSchedule,
  formatSessionTime,
} from "@/modules/coach/components/programs/programDisplay";
import {
  useInvalidateCoachPrograms,
  useMyEnrollments,
  useMyUpcomingSessions,
} from "@/modules/coach/hooks/useCoachPrograms";
import { coachProgramsApi } from "@/modules/coach/services/coachPrograms";
import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { CoachEnrollment, CoachOffering } from "@/types/coachPrograms";
import { CalendarDays } from "lucide-react";
import { formatPaise } from "@/modules/coach/components/programs/programDisplay";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * A student's (or parent's) view of their regular classes.
 *
 * The number that matters to a parent is CLASSES LEFT, not days elapsed — it is
 * read straight from the credit ledger, which is also exactly what they would
 * be refunded if they left today.
 */
export const MyClassesClient = () => {
  const router = useRouter();
  const { data: enrollments = [], isPending } = useMyEnrollments();
  const { data: sessions = [] } = useMyUpcomingSessions();
  const refresh = useInvalidateCoachPrograms();

  if (isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </main>
    );
  }

  if (enrollments.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <EmptyState
          icon={CalendarDays}
          title="No classes yet"
          description="Join a coaching programme to see your weekly classes here."
          actionLabel="Browse programmes"
          onAction={() => router.push("/programmes")}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My classes</h1>
      </header>

      <section className="mb-8" aria-labelledby="next-heading">
        <h2 id="next-heading" className="mb-3 font-semibold">
          Coming up
        </h2>
        {sessions.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            No classes scheduled right now.
          </Card>
        ) : (
          <ul className="space-y-2">
            {sessions.slice(0, 8).map((session) => (
              <li key={session.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">
                      {formatSessionTime(session.scheduledAt)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {session.sport}
                      {session.isMakeup ? " · makeup class" : ""}
                    </p>
                  </div>
                  <ConnectionDetail
                    delivery={session.delivery}
                    status={session.status}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="programmes-heading">
        <h2 id="programmes-heading" className="mb-3 font-semibold">
          Programmes
        </h2>
        <ul className="space-y-2">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id}>
              <EnrollmentCard enrollment={enrollment} onChanged={refresh} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};

const EnrollmentCard = ({
  enrollment,
  onChanged,
}: {
  enrollment: CoachEnrollment;
  onChanged: () => void;
}) => {
  const [renewing, setRenewing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const offering =
    typeof enrollment.offeringId === "object"
      ? (enrollment.offeringId as CoachOffering)
      : undefined;

  const classesLeft = enrollment.credits?.AVAILABLE?.count ?? 0;
  // No classes left means the period is spent. There is no auto-debit here, so
  // nothing renews unless the parent is asked — saying so plainly beats letting
  // them find out when their child has no class to go to.
  const needsRenewal = classesLeft === 0;

  const unusedClasses = enrollment.credits?.AVAILABLE?.count ?? 0;
  const refundablePaise = enrollment.credits?.AVAILABLE?.amountPaise ?? 0;

  const leave = async () => {
    // Say the number out loud before they commit. It is computed exactly from
    // the ledger, so it is a promise the system can actually keep.
    const confirmed = window.confirm(
      unusedClasses > 0
        ? `Leave this programme? ${unusedClasses} unused class${unusedClasses === 1 ? "" : "es"} — ${formatPaise(refundablePaise)} — will be refunded.`
        : "Leave this programme? You have no unused classes, so there is nothing to refund.",
    );
    if (!confirmed) return;

    setLeaving(true);
    try {
      const response = await coachProgramsApi.leave(enrollment.id);
      const refund = response.data?.refund;

      if (refund?.status === "REFUNDED") {
        toast.success(
          `You have left. ${formatPaise(refund.amountPaise)} is on its way back.`,
        );
      } else if (refund?.status === "FAILED") {
        // Honest: the claim is safe, it just has not settled yet.
        toast.success(
          "You have left. Your refund could not be sent just now — we will keep trying.",
        );
      } else {
        toast.success("You have left this programme.");
      }
      onChanged();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not leave this programme";
      toast.error(message);
    } finally {
      setLeaving(false);
    }
  };

  const renew = async () => {
    setRenewing(true);
    try {
      const response = await coachProgramsApi.renew(enrollment.id);
      const redirectUrl = response.data?.redirectUrl;
      if (!redirectUrl) {
        toast.error("Could not start the renewal. Please try again.");
        return;
      }
      window.location.href = redirectUrl;
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not renew this programme";
      toast.error(message);
    } finally {
      setRenewing(false);
    }
  };

  return (
    <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{offering?.title ?? "Coaching programme"}</p>
          {offering ? (
            <DeliveryBadge
              kind={offering.deliveryKind}
              {...(offering.onlinePlatform
                ? { platform: offering.onlinePlatform }
                : {})}
            />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {enrollment.studentName}
          {offering
            ? ` · ${formatSchedule(offering.schedule, offering.timezone)}`
            : ""}
        </p>
        {needsRenewal ? (
          <p className="mt-1 text-sm font-medium text-power-orange">
            Out of classes — renew to keep {enrollment.studentName}&apos;s place
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="text-right">
          <p className="text-lg font-semibold">{classesLeft}</p>
          <p className="text-xs text-muted-foreground">
            class{classesLeft === 1 ? "" : "es"} left
          </p>
        </div>
        <div className="flex gap-2">
          {needsRenewal ? (
            <Button size="sm" loading={renewing} onClick={renew}>
              Renew
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            loading={leaving}
            onClick={leave}
          >
            Leave
          </Button>
        </div>
      </div>
    </Card>
  );
};
