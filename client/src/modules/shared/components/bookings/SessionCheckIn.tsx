import { Button } from "@/modules/shared/ui/Button";
import { bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import type { Booking } from "@/types";
import type { CheckInMessage } from "@/modules/shared/hooks/useSessionCheckIn";
import { whenLabel } from "@/modules/shared/utils/bookingTime";

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
  title = "Start a session",
  description = "Enter the 8-character code your client shows you when they arrive.",
  submitLabel = "Start session",
  startedTitleOf = bookingPlayerName,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  loading: boolean;
  message: CheckInMessage | null;
  startedBooking: Booking | null;
  onSubmit: () => void;
  /** Wording for who is being checked in; the defaults suit a coach. */
  title?: string;
  description?: string;
  submitLabel?: string;
  /** The first words of the line that confirms which booking started. */
  startedTitleOf?: (booking: Booking) => string;
}) {
  return (
    <section
      aria-labelledby="check-in-heading"
      className="border-hairline grid gap-x-12 gap-y-4 border-y py-8 xl:grid-cols-12"
    >
      <div className="xl:col-span-5">
        <h2 id="check-in-heading" className="text-ink text-base font-semibold">
          {title}
        </h2>
        <p className="text-ink-body mt-1 max-w-[44ch] text-pretty text-sm">{description}</p>
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
            {loading ? "Checking" : submitLabel}
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
              {startedTitleOf(startedBooking)},{" "}
              <span className="capitalize">{startedBooking.sport}</span>,{" "}
              {whenLabel(startedBooking, new Date())}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
