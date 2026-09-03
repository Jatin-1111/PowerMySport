import { StepPill } from "@/modules/booking/components/checkout/CheckoutPrimitives";
import { fadeUp } from "@/modules/booking/utils/checkoutHelpers";
import { Button } from "@/modules/shared/ui/Button";
import { motion } from "framer-motion";
import { ChevronLeft, Zap } from "lucide-react";

interface CheckoutPageHeaderProps {
  type: "coach" | "venue" | "academy";
  isZeroCommission: boolean;
  currentStep: number;
  steps: { id: number; label: string }[];
  isSubmitting: boolean;
  onPrevStep: () => void;
  onBackToBooking: () => void;
}

export function CheckoutPageHeader({
  type,
  isZeroCommission,
  currentStep,
  steps,
  isSubmitting,
  onPrevStep,
  onBackToBooking,
}: CheckoutPageHeaderProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: 0.05 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-lg sm:p-8"
    >
      <div className="bg-power-orange/20 pointer-events-none absolute -right-12 -top-10 h-48 w-48 rounded-full blur-3xl" />
      <div className="bg-turf-green/15 pointer-events-none absolute -bottom-8 left-1/3 h-32 w-32 rounded-full blur-2xl" />

      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-power-orange/20 text-power-orange inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <Zap size={11} />
              Secure Checkout
            </span>
            {isZeroCommission && (
              <span className="bg-turf-green/20 text-turf-green inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                0% Platform Fee
              </span>
            )}
          </div>
          <h1 className="font-title mt-3 text-2xl font-bold text-white sm:text-3xl">
            {type === "coach"
              ? "Book your coach session"
              : type === "academy"
                ? "Book an academy session"
                : "Reserve your venue slot"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Review details, pick a payment method, and confirm your slot.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={onPrevStep}
              disabled={isSubmitting}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronLeft size={16} />
              Back
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onBackToBooking}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            Back to booking
          </Button>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Step {currentStep} of {steps.length}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            {currentStep === 1 && "Review your booking"}
            {currentStep === 2 && "Choose payment method"}
            {currentStep === 3 && "Confirm and pay"}
          </p>
        </div>
        <StepPill steps={steps} currentStep={currentStep} />
      </div>
    </motion.div>
  );
}
