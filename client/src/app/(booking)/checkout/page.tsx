"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import { Suspense } from "react";

import { CheckoutConfirmStep } from "@/modules/booking/components/checkout/CheckoutConfirmStep";
import { CheckoutNotices } from "@/modules/booking/components/checkout/CheckoutNotices";
import { CheckoutPageHeader } from "@/modules/booking/components/checkout/CheckoutPageHeader";
import { CheckoutPaymentStep } from "@/modules/booking/components/checkout/CheckoutPaymentStep";
import { CheckoutReviewStep } from "@/modules/booking/components/checkout/CheckoutReviewStep";
import { CheckoutSidebar } from "@/modules/booking/components/checkout/CheckoutSidebar";
import { useCheckoutFlow } from "@/modules/booking/hooks/useCheckoutFlow";
import { fadeIn, fadeUp, stepVariants } from "@/modules/booking/utils/checkoutHelpers";
import { Button } from "@/modules/shared/ui/Button";
import { formatCurrency } from "@/utils/format";

function CheckoutPageContent() {
  const shouldReduceMotion = useReducedMotion();
  const flow = useCheckoutFlow();

  if (flow.loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="border-t-power-orange h-9 w-9 animate-spin rounded-full border-2 border-slate-200" />
          <p className="text-sm text-slate-500">Loading your booking...</p>
        </div>
      </div>
    );
  }

  if (!flow.isDetailsReady) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200/70 bg-white/95 p-8 text-center">
        <p className="text-sm capitalize text-slate-500">{flow.entityLabel} not found.</p>
        <Button variant="outline" onClick={() => flow.router.push("/booking")}>
          Browse options
        </Button>
      </div>
    );
  }

  const participantName = flow.selectedDependent
    ? flow.selectedDependent.name
    : flow.user?.name || "Me";

  const ctaButtons = (
    <div className="flex shrink-0 gap-2 lg:mt-4 lg:w-full lg:flex-col lg:space-y-2.5">
      {flow.currentStep > 1 && (
        <Button
          variant="outline"
          className="hidden w-full lg:flex"
          onClick={flow.handlePrevStep}
          disabled={flow.isSubmitting}
        >
          <ChevronLeft size={16} />
          Back
        </Button>
      )}
      <Button
        variant="primary"
        className="w-[180px] gap-2 lg:w-full"
        disabled={
          !flow.hasRequiredDetails ||
          !flow.hasValidDuration ||
          flow.isSubmitting ||
          flow.isQuoteLoading ||
          flow.total <= 0
        }
        loading={flow.currentStep === 3 ? flow.isSubmitting : false}
        onClick={flow.currentStep === 3 ? flow.handleCheckout : flow.handleNextStep}
      >
        {flow.currentStep === 1 && (
          <>
            <span>Continue</span>
            <ArrowRight size={15} />
          </>
        )}
        {flow.currentStep === 2 && (
          <>
            <span>Confirm</span>
            <ArrowRight size={15} />
          </>
        )}
        {flow.currentStep === 3 && (
          <>
            <span>
              Pay <span className="hidden lg:inline">{formatCurrency(flow.total)}</span>
            </span>
            <ArrowRight size={15} />
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-5 pb-28 lg:pb-0">
      {/* Back link */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Button
          variant="ghost"
          onClick={() => flow.router.push(flow.backHref)}
          className="text-slate-600"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to {flow.entityLabel}
        </Button>
      </motion.div>

      <CheckoutPageHeader
        type={flow.type}
        isZeroCommission={flow.isZeroCommission}
        currentStep={flow.currentStep}
        steps={flow.steps}
        isSubmitting={flow.isSubmitting}
        onPrevStep={flow.handlePrevStep}
        onBackToBooking={() => flow.router.push(flow.backHref)}
      />

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
        {/* Left — step content */}
        <div className="min-w-0">
          <AnimatePresence mode="wait" custom={flow.stepDir}>
            <motion.div
              key={flow.currentStep}
              custom={shouldReduceMotion ? 0 : flow.stepDir}
              variants={shouldReduceMotion ? fadeIn : stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              {flow.currentStep === 1 && (
                <CheckoutReviewStep
                  entityLabel={flow.entityLabel}
                  coach={flow.coach}
                  venue={flow.venue}
                  academy={flow.academy}
                  type={flow.type}
                  availableSports={flow.availableSports}
                  sport={flow.sport}
                  setSport={flow.setSport}
                  date={flow.date}
                  setDate={flow.setDate}
                  startTime={flow.startTime}
                  setStartTime={flow.setStartTime}
                  endTime={flow.endTime}
                  setEndTime={flow.setEndTime}
                  durationHours={flow.durationHours}
                  user={flow.user}
                  selectedDependentId={flow.selectedDependentId}
                  setSelectedDependentId={flow.setSelectedDependentId}
                />
              )}

              {flow.currentStep === 2 && (
                <CheckoutPaymentStep
                  type={flow.type}
                  isGroupBooking={flow.isGroupBooking}
                  setIsGroupBooking={flow.setIsGroupBooking}
                  selectedFriendIds={flow.selectedFriendIds}
                  setSelectedFriendIds={flow.setSelectedFriendIds}
                  paymentType={flow.paymentType}
                  setPaymentType={flow.setPaymentType}
                  total={flow.total}
                  paymentMethod={flow.paymentMethod}
                  setPaymentMethod={flow.setPaymentMethod}
                  dynamicPaymentOptions={flow.dynamicPaymentOptions}
                />
              )}

              {flow.currentStep === 3 && (
                <CheckoutConfirmStep
                  type={flow.type}
                  coach={flow.coach}
                  venue={flow.venue}
                  academy={flow.academy}
                  entityName={flow.entityName}
                  sport={flow.sport}
                  date={flow.date}
                  startTime={flow.startTime}
                  endTime={flow.endTime}
                  durationHours={flow.durationHours}
                  participantName={participantName}
                  paymentMethod={flow.paymentMethod}
                  dynamicPaymentOptions={flow.dynamicPaymentOptions}
                />
              )}

              <CheckoutNotices
                hasRequiredDetails={flow.hasRequiredDetails}
                hasValidDuration={flow.hasValidDuration}
                showWaitlistPrompt={flow.showWaitlistPrompt}
                alternateSlots={flow.alternateSlots}
                isJoiningWaitlist={flow.isJoiningWaitlist}
                onJoinWaitlist={flow.handleJoinWaitlist}
                onDismissWaitlist={() => flow.setShowWaitlistPrompt(false)}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right — sticky sidebar */}
        <CheckoutSidebar
          isZeroCommission={flow.isZeroCommission}
          promoCode={flow.promoCode}
          setPromoCode={flow.setPromoCode}
          onApplyPromo={flow.handleApplyPromo}
          isApplyingPromo={flow.isApplyingPromo}
          promoMessage={flow.promoMessage}
          promoSuccess={flow.promoSuccess}
          type={flow.type}
          pricePerHour={flow.pricePerHour}
          subtotal={flow.subtotal}
          durationHours={flow.durationHours}
          serviceFee={flow.serviceFee}
          taxes={flow.taxes}
          discount={flow.discount}
          total={flow.total}
          entityLabel={flow.entityLabel}
          sport={flow.sport}
          communityUrl={flow.communityUrl}
          showCommunityInsights={Boolean(flow.user?.role === "Player")}
          ctaButtons={ctaButtons}
        />
      </div>

      {/* Mobile Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-500">Total due</p>
            <p className="mt-0.5 text-lg font-bold leading-none text-slate-900">
              {formatCurrency(flow.total)}
            </p>
          </div>
          {ctaButtons}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="border-t-power-orange h-9 w-9 animate-spin rounded-full border-2 border-slate-200" />
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
