import { RequestsBand as SharedRequestsBand } from "@/modules/shared/components/bookings/RequestsBand";
import { bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import type { Booking } from "@/types";

/** The coach's pending requests: each is titled with the player's name. */
export function RequestsBand({ requests, now }: { requests: Booking[]; now: Date }) {
  return (
    <SharedRequestsBand
      requests={requests}
      now={now}
      href="/coach/my-bookings"
      titleOf={bookingPlayerName}
    />
  );
}
