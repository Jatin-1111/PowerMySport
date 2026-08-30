"use client";

import { toast } from "@/lib/toast";
import {
  DeliveryBadge,
  SeatsLabel,
  formatSchedule,
} from "@/modules/coach/components/programs/programDisplay";
import { coachProgramsApi } from "@/modules/coach/services/coachPrograms";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Input } from "@/modules/shared/ui/Input";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { CoachOffering } from "@/types/coachPrograms";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * One programme, and the form to join it.
 *
 * The price is deliberately NOT collected here. The server derives the fee and
 * the billing period from the programme's package, because anything the client
 * sends about money is attacker-controlled.
 */
export const ProgrammeDetailClient = () => {
  const params = useParams<{ offeringId: string }>();
  const router = useRouter();
  const offeringId = params?.offeringId;

  const [offering, setOffering] = useState<CoachOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [address, setAddress] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!offeringId) return;
    let cancelled = false;

    const load = async () => {
      try {
        // The browse endpoint is the public read surface; find this programme
        // within it rather than adding a second, near-identical endpoint.
        const response = await coachProgramsApi.browse();
        const match = (response.data?.offerings ?? []).find(
          (item) => item.id === offeringId,
        );
        if (!cancelled) setOffering(match ?? null);
      } catch {
        if (!cancelled) toast.error("Could not load this programme");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [offeringId]);

  const joinTheQueue = async () => {
    if (!offering) return;
    if (!studentName.trim()) {
      toast.error("Who is this class for?");
      return;
    }

    setJoining(true);
    try {
      await coachProgramsApi.joinWaitlist(offering.id, studentName.trim());
      toast.success("You're on the waiting list — we'll email you.");
      router.push("/my-classes");
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not join the waiting list";
      toast.error(message);
    } finally {
      setJoining(false);
    }
  };

  const join = async () => {
    if (!offering) return;
    if (!studentName.trim()) {
      toast.error("Who is this class for?");
      return;
    }
    if (offering.deliveryKind === "STUDENT_LOCATION" && !address.trim()) {
      toast.error("This coach travels to you, so we need an address");
      return;
    }

    setJoining(true);
    try {
      const response = await coachProgramsApi.enroll(offering.id, {
        studentName: studentName.trim(),
        ...(address.trim()
          ? { deliveryAddress: { addressSnapshot: address.trim() } }
          : {}),
      });

      const redirectUrl = response.data?.redirectUrl;
      if (!redirectUrl) {
        toast.error("Could not start payment. Please try again.");
        return;
      }

      // The seat is held, not taken. Off to the gateway — the enrolment goes
      // live when the payment reconciles, and the seat is released if it does
      // not. `window.location` rather than the router: this leaves the app.
      window.location.href = redirectUrl;
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not join this programme";
      toast.error(message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </main>
    );
  }

  if (!offering) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold">Programme not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been paused or filled up.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/programmes")}>
          Back to programmes
        </Button>
      </main>
    );
  }

  const coach =
    typeof offering.coachId === "object" ? offering.coachId : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{offering.title}</h1>
          <DeliveryBadge
            kind={offering.deliveryKind}
            {...(offering.onlinePlatform
              ? { platform: offering.onlinePlatform }
              : {})}
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {offering.sport}
          {coach?.userId?.name ? ` · ${coach.userId.name}` : ""}
        </p>
      </header>

      <Card className="mb-6 space-y-3 p-4">
        {offering.description ? (
          <p className="text-sm">{offering.description}</p>
        ) : null}
        <p className="text-sm">
          <span className="font-medium">When: </span>
          {formatSchedule(offering.schedule, offering.timezone)}
        </p>
        <SeatsLabel offering={offering} />
      </Card>

      {offering.isFull ? (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">This programme is full</h2>
          <p className="text-sm text-muted-foreground">
            Join the waiting list and we&apos;ll email you the moment a place
            opens. Places go to whoever books first, so be quick when it does.
          </p>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Who is it for?</span>
            <Input
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="Student's name"
            />
          </label>

          <Button fullWidth loading={joining} onClick={joinTheQueue}>
            Join the waiting list
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Join this programme</h2>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Who is it for?</span>
            <Input
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="Student's name"
            />
          </label>

          {offering.deliveryKind === "STUDENT_LOCATION" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Where should the coach come?
              </span>
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Full address"
              />
            </label>
          ) : null}

          <p className="text-xs text-muted-foreground">
            You&apos;ll be taken to payment next. Classes you don&apos;t use are
            refundable if you leave.
          </p>

          <Button fullWidth loading={joining} onClick={join}>
            Continue to payment
          </Button>
        </Card>
      )}
    </main>
  );
};
