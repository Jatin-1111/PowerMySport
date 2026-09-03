"use client";

import { toast } from "@/lib/toast";
import {
  ConnectionDetail,
  DeliveryBadge,
  SeatsLabel,
  StatusBadge,
  formatPaise,
  formatSchedule,
  formatSessionTime,
} from "@/modules/coach/components/programs/programDisplay";
import { coachProgramsApi } from "@/modules/coach/services/coachPrograms";
import { CreateProgrammeForm } from "@/modules/coach/components/programs/CreateProgrammeForm";
import {
  useCoachSessionEarnings,
  useInvalidateCoachPrograms,
  useMakeupsOwed,
  useMyCoachSessions,
  useMyOfferings,
} from "@/modules/coach/hooks/useCoachPrograms";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { CoachEarningsSummary, CoachSessionOccurrence } from "@/types/coachPrograms";
import { CalendarPlus, Link2, Plus, Users } from "lucide-react";
import { useState } from "react";

/**
 * A coach's console for recurring programmes.
 *
 * The three things a coach actually does here: publish a programme, run each
 * session (mark it delivered or call it off), and chase the makeups they owe.
 * Everything else is reporting.
 */
export const CoachProgrammesClient = () => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: offerings = [], isPending } = useMyOfferings();
  const { data: sessions = [] } = useMyCoachSessions();
  const { data: makeupsOwed = [] } = useMakeupsOwed();
  const { data: earnings = {} } = useCoachSessionEarnings();
  const refresh = useInvalidateCoachPrograms();

  const run = async (id: string, action: () => Promise<string>) => {
    setBusyId(id);
    try {
      const message = await action();
      toast.success(message);
      await refresh();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong";
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const completeSession = (session: CoachSessionOccurrence) =>
    run(session.id, async () => {
      const response = await coachProgramsApi.completeSession(session.id);
      const unfunded = response.data?.seatsUnfunded ?? 0;
      const earnedPaise = response.data?.earnedPaise ?? 0;
      // Surfaced rather than swallowed: an unfunded seat means a student's
      // subscription has run out and the coach earned nothing for them.
      return unfunded > 0
        ? `Session recorded · ${formatPaise(earnedPaise)} earned · ${unfunded} student(s) had no classes left`
        : `Session recorded · ${formatPaise(earnedPaise)} earned`;
    });

  const cancelSession = (session: CoachSessionOccurrence) =>
    run(session.id, async () => {
      await coachProgramsApi.cancelSession(session.id);
      return "Cancelled — your students keep their class and are owed a makeup";
    });

  const setLink = (session: CoachSessionOccurrence) => {
    const link = window.prompt("Paste the class link");
    if (!link) return;
    void run(session.id, async () => {
      await coachProgramsApi.setSessionLink(session.id, link);
      return "Class link saved";
    });
  };

  const scheduleMakeup = (session: CoachSessionOccurrence) => {
    const when = window.prompt("When is the makeup class? (YYYY-MM-DD HH:mm, your local time)");
    if (!when) return;
    const parsed = new Date(when.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) {
      toast.error("Could not read that date");
      return;
    }
    void run(session.id, async () => {
      await coachProgramsApi.scheduleMakeup(session.id, parsed.toISOString());
      return "Makeup class scheduled";
    });
  };

  if (isPending) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </main>
    );
  }

  const upcoming = sessions.filter((s) => s.status === "SCHEDULED");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My programmes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Regular classes you run every week — one-to-one or as a batch, in person or online.
        </p>
      </header>

      <EarningsStrip earnings={earnings} />

      {makeupsOwed.length > 0 ? (
        <section className="mb-8" aria-labelledby="makeups-heading">
          <h2 id="makeups-heading" className="mb-2 font-semibold">
            Makeups you owe ({makeupsOwed.length})
          </h2>
          <p className="text-muted-foreground mb-3 text-sm">
            You cancelled these, so your students were not charged. Schedule a replacement and their
            class is used then.
          </p>
          <ul className="space-y-2">
            {makeupsOwed.map((session) => (
              <li key={session.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">
                      {session.sport} · {formatSessionTime(session.scheduledAt)}
                    </p>
                    {session.cancelReason ? (
                      <p className="text-muted-foreground text-sm">{session.cancelReason}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    loading={busyId === session.id}
                    onClick={() => scheduleMakeup(session)}
                  >
                    Schedule makeup
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-8" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="mb-3 font-semibold">
          Upcoming classes
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="No classes scheduled"
            description="Publish a programme and its classes appear here automatically."
          />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((session) => (
              <li key={session.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{formatSessionTime(session.scheduledAt)}</p>
                      <StatusBadge status={session.status} />
                      {session.isMakeup ? (
                        <span className="text-muted-foreground text-xs">makeup</span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {session.sport} · {session.roster.length} student
                      {session.roster.length === 1 ? "" : "s"}
                    </p>
                    <ConnectionDetail delivery={session.delivery} status={session.status} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {session.delivery?.kind === "ONLINE" ? (
                      <Button size="sm" variant="ghost" onClick={() => setLink(session)}>
                        <Link2 className="mr-1 h-4 w-4" aria-hidden="true" />
                        {session.delivery.meetingLink ? "Change link" : "Add link"}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === session.id}
                      onClick={() => cancelSession(session)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      loading={busyId === session.id}
                      onClick={() => completeSession(session)}
                    >
                      Mark done
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="programmes-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="programmes-heading" className="font-semibold">
            Programmes
          </h2>
          {!creating ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              New programme
            </Button>
          ) : null}
        </div>

        {creating ? (
          <div className="mb-4">
            <CreateProgrammeForm
              onCancel={() => setCreating(false)}
              onCreated={async () => {
                setCreating(false);
                await refresh();
              }}
            />
          </div>
        ) : null}
        {offerings.length === 0 ? (
          !creating ? (
            <EmptyState
              icon={Users}
              title="No programmes yet"
              description="A programme is a weekly class with its own schedule, price and roster. Create one to start taking regular students."
              actionLabel="Create a programme"
              onAction={() => setCreating(true)}
            />
          ) : null
        ) : (
          <ul className="space-y-2">
            {offerings.map((offering) => (
              <li key={offering.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{offering.title}</p>
                      <DeliveryBadge
                        kind={offering.deliveryKind}
                        {...(offering.onlinePlatform ? { platform: offering.onlinePlatform } : {})}
                      />
                      <span className="text-muted-foreground text-xs tracking-wide uppercase">
                        {offering.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {formatSchedule(offering.schedule, offering.timezone)}
                    </p>
                    <SeatsLabel offering={offering} />
                  </div>

                  <div className="flex gap-2">
                    {offering.status === "ACTIVE" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyId === offering.id}
                        onClick={() =>
                          run(offering.id, async () => {
                            await coachProgramsApi.pause(offering.id);
                            return "Programme paused";
                          })
                        }
                      >
                        Pause
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        loading={busyId === offering.id}
                        onClick={() =>
                          run(offering.id, async () => {
                            const response = await coachProgramsApi.activate(offering.id);
                            return `Published — ${response.data?.sessionsCreated ?? 0} classes scheduled`;
                          })
                        }
                      >
                        Publish
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

/**
 * What the coach is owed. PENDING is money earned but inside the 24-hour hold;
 * RELEASED is payable now. Showing them separately stops "why haven't I been
 * paid" before it is asked.
 */
const EarningsStrip = ({ earnings }: { earnings: CoachEarningsSummary }) => {
  const buckets: Array<[keyof CoachEarningsSummary, string]> = [
    ["PENDING", "Clearing"],
    ["RELEASED", "Ready to pay"],
    ["PAID", "Paid out"],
  ];

  const totalGross = buckets.reduce((sum, [key]) => sum + (earnings[key]?.grossPaise ?? 0), 0);
  const totalCommission = buckets.reduce(
    (sum, [key]) =>
      sum + (earnings[key]?.commissionPaise ?? 0) + (earnings[key]?.commissionGstPaise ?? 0),
    0
  );

  return (
    <div className="mb-8 space-y-3">
      <dl className="grid grid-cols-3 gap-3">
        {buckets.map(([key, label]) => (
          <Card key={key} className="p-3">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
            <dd className="mt-1 text-lg font-semibold">
              {formatPaise(earnings[key]?.amountPaise ?? 0)}
            </dd>
            <dd className="text-muted-foreground text-xs">
              {earnings[key]?.sessions ?? 0} class
              {(earnings[key]?.sessions ?? 0) === 1 ? "" : "es"}
            </dd>
          </Card>
        ))}
      </dl>

      {totalGross > 0 ? (
        // Never show a coach a smaller number than they billed without saying
        // where the difference went.
        <Card className="p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Classes billed</span>
            <span>{formatPaise(totalGross)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Platform commission + GST</span>
            <span>− {formatPaise(totalCommission)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t pt-1 font-medium">
            <span>Your earnings</span>
            <span>{formatPaise(totalGross - totalCommission)}</span>
          </div>
        </Card>
      ) : null}
    </div>
  );
};
