import { Button } from "@/modules/shared/ui/Button";
import { fadeIn, fadeUp } from "@/modules/booking/utils/checkoutHelpers";
import { AnimatePresence, motion } from "framer-motion";

interface CheckoutNoticesProps {
  hasRequiredDetails: boolean;
  hasValidDuration: boolean;
  showWaitlistPrompt: boolean;
  alternateSlots: string[];
  isJoiningWaitlist: boolean;
  onJoinWaitlist: () => void;
  onDismissWaitlist: () => void;
}

export function CheckoutNotices({
  hasRequiredDetails,
  hasValidDuration,
  showWaitlistPrompt,
  alternateSlots,
  isJoiningWaitlist,
  onJoinWaitlist,
  onDismissWaitlist,
}: CheckoutNoticesProps) {
  return (
    <AnimatePresence>
      {!hasRequiredDetails && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold">
            !
          </span>
          Missing booking details. Go back and select a date, time, and sport.
        </motion.div>
      )}
      {hasRequiredDetails && !hasValidDuration && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold">
            !
          </span>
          End time must be after start time.
        </motion.div>
      )}
      {showWaitlistPrompt && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="rounded-xl border border-indigo-200/60 bg-indigo-50/80 p-4"
        >
          <p className="text-sm font-semibold text-blue-800">This slot was just taken.</p>
          {alternateSlots.length > 0 ? (
            <p className="mt-1 text-xs text-indigo-600">
              Nearby alternates: {alternateSlots.join(", ")}
            </p>
          ) : (
            <p className="mt-1 text-xs text-indigo-600">No nearby alternate slots right now.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onJoinWaitlist}
              disabled={isJoiningWaitlist}
            >
              {isJoiningWaitlist ? "Joining..." : "Join waitlist"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismissWaitlist}>
              Dismiss
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
