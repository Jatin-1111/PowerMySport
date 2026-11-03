"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { AvailabilityStep } from "./AvailabilityStep";
import { ExpertiseStep } from "./ExpertiseStep";
import { IdentityStep } from "./IdentityStep";
import { PayoutStep } from "./PayoutStep";
import { SessionStep } from "./SessionStep";
import { StepIndicator } from "./StepIndicator";
import { STEPS } from "./steps";
import { SubmittedScreen } from "./SubmittedScreen";
import { useExpertOnboarding } from "./useExpertOnboarding";

/**
 * The expert onboarding wizard: five steps, one form, one primary action. A
 * single form wraps every step so Enter advances the wizard (or submits on the
 * last step) like a native form. The step lives in the URL (see steps.ts), and
 * the rules live in useExpertOnboarding; this only lays them out.
 */
export function ExpertOnboarding() {
  const o = useExpertOnboarding();
  const { step } = o;

  const stepAnnouncerRef = useRef<HTMLParagraphElement>(null);
  const prevStepRef = useRef(step);

  // On step change, scroll back to the top and move focus to the
  // "Step X of Y" announcer so keyboard/screen-reader users land at the
  // start of the new step instead of on whatever button they last pressed.
  useEffect(() => {
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    window.scrollTo({ top: 0, behavior: "smooth" });
    stepAnnouncerRef.current?.focus({ preventScroll: true });
  }, [step]);

  if (o.loading) {
    return (
      <div className="max-w-2xl space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading your profile</span>
        <Skeleton aria-hidden="true" className="h-4 w-32" />
        <Skeleton aria-hidden="true" className="h-11 w-72 max-w-full" />
        <Skeleton aria-hidden="true" className="h-64 w-full" />
      </div>
    );
  }

  if (o.submitted)
    return <SubmittedScreen email={o.user?.email} onHome={() => o.router.push("/")} />;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-ink-body text-sm">Expert onboarding</p>
        <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
          Set up your expert profile
        </h1>
        <p
          ref={stepAnnouncerRef}
          tabIndex={-1}
          className="text-ink-body mt-3 text-pretty outline-none"
        >
          Step {step} of {STEPS.length}: complete your profile to submit for review
        </p>
      </header>

      {o.rejectionReason && (
        <section
          role="alert"
          aria-labelledby="rejected-heading"
          className="bg-paper-deep rounded-2xl p-6 sm:p-8"
        >
          <h2
            id="rejected-heading"
            className="font-editorial text-ink text-balance text-2xl font-light tracking-tight"
          >
            Your profile needs changes
          </h2>
          <p className="text-ink-body mt-3 max-w-[60ch] text-pretty">{o.rejectionReason}</p>
          <p className="text-ink-body mt-3 max-w-[60ch] text-pretty text-sm">
            Update what is asked for below, then submit again on the last step.
          </p>
        </section>
      )}

      <StepIndicator step={step} onGoTo={o.goToStep} />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length) {
            o.goNext();
          } else {
            o.handleSubmit();
          }
        }}
      >
        {step === 1 && <IdentityStep o={o} />}
        {step === 2 && <ExpertiseStep o={o} />}
        {step === 3 && <SessionStep o={o} />}
        {step === 4 && <AvailabilityStep o={o} />}
        {step === 5 && <PayoutStep o={o} />}

        <div className="bg-paper border-hairline sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t py-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={o.goBack}
              className={`${TEXT_LINK} ring-offset-paper min-h-11`}
            >
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              Back
            </button>
          ) : (
            <span />
          )}

          {step < STEPS.length ? (
            <Button type="submit" className="min-h-11">
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={o.submitting} className="min-h-11">
              {o.submitting ? "Submitting" : "Submit for review"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
