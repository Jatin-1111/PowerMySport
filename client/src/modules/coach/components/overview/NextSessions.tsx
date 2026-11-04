import { NextSessions as SharedNextSessions } from "@/modules/shared/components/bookings/NextSessions";
import { bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import type { Booking } from "@/types";

/** The coach's next confirmed sessions, each titled with the player's name. */
export function NextSessions({
  sessions,
  now,
  failed,
}: {
  sessions: Booking[];
  now: Date;
  failed: boolean;
}) {
  return (
    <SharedNextSessions
      sessions={sessions}
      now={now}
      failed={failed}
      titleOf={bookingPlayerName}
      href="/coach/schedule"
      linkLabel="Open schedule"
      emptyText="Nothing is booked yet. Confirmed sessions appear here, soonest first. Opening more of your week in the schedule makes it easier for clients to book."
    />
  );
}
