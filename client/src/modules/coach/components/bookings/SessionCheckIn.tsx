import { Button } from "@/modules/shared/ui/Button";
import { bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import type { Booking } from "@/types";
import type { CheckInMessage } from "../../hooks/useSessionCheckIn";
import { whenLabel } from "../../utils/overview";

/**
 * Starts a session from the client's 8-character code. One field and one
 * action, with the result written out under it: what happened, and for which
 * booking.
 */
export function SessionCheckIn({
  code,
  onCodeChange,
  loading,
  message,
  startedBooking,
  onSubmit,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  loading: boolean;
  message: CheckInMessage | null;
  startedBooking: Booking | null;
  onSubmit: () => void;
}) {
  return (
    <section
      aria-labelledby="check-in-heading"
      className="border-hairline grid gap-x-12 gap-y-4 border-y py-8 xl:grid-cols-12"
    >
      <div className="xl:col-span-5">
        <h2 id="check-in-heading" className="text-ink text-base font-semibold">
          Start a session
        </h2>
        <p className="text-ink-body mt-1 max-w-[44ch] text-pretty text-sm">
          Enter the 8-character code your client shows you when they arrive.
        </p>
      </div>

      <form
        className="xl:col-span-7"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="check-in-code" className="sr-only">
          Check-in code
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id="check-in-code"
            type="text"
            inputMode="text"
            value={code}
            maxLength={8}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder="ABCD1234"
            autoComplete="one-time-code"
            aria-describedby="check-in-result"
            className="border-ink/25 text-ink placeholder:text-ink-ash focus:border-ink focus-visible:ring-ink min-h-11 w-full max-w-[16rem] rounded-md border bg-white px-3 font-mono uppercase tracking-[0.3em] focus:outline-none focus-visible:ring-2"
          />
          <Button type="submit" variant="secondary" className="min-h-11" disabled={loading}>
            {loading ? "Checking" : "Start session"}
          </Button>
        </div>

        <div id="check-in-result" aria-live="polite" className="mt-3 text-sm">
          {message && (
            <p
              role={message.tone === "error" ? "alert" : undefined}
              className={message.tone === "error" ? "text-red-800" : "text-green-800"}
            >
              {message.text}
            </p>
          )}
          {startedBooking && (
            <p className="text-ink-body mt-1">
              {bookingPlayerName(startedBooking)},{" "}
              <span className="capitalize">{startedBooking.sport}</span>,{" "}
              {whenLabel(startedBooking, new Date())}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
