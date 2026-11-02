"use client";

import { toast } from "@/lib/toast";
import {
  academyOnboardingApi,
  needsEmailVerification,
} from "@/modules/onboarding/services/academy";
import type {
  AcademyCoachesPayload,
  AcademyPayoutsPayload,
  AcademyPricingPayload,
  AcademyStep1Payload,
  AcademyStep2Payload,
  AcademyStep3Payload,
  AcademyVenuesPayload,
  OnboardingAcademy,
} from "@/modules/onboarding/types/academy";
import {
  ACADEMY_STEPS,
  LAST_ACADEMY_STEP,
  academyProgressPercent,
  resumeStepFor,
  type AcademyStepNumber,
} from "@/modules/onboarding/utils/academySteps";
import {
  formDataFromAcademy,
  payoutDetailsWereSaved,
  type AcademyFormData,
} from "@/modules/onboarding/utils/academyResume";
import { CheckCircle2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import EmailVerificationModal from "../onboarding/EmailVerificationModal";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Location from "./Step2Location";
import Step3Legal from "./Step3Legal";
import Step4Venues from "./Step4Venues";
import Step5Coaches from "./Step5Coaches";
import Step6Pricing from "./Step6Pricing";
import Step7Payouts from "./Step7Payouts";

// Only the academy id is remembered here. Where the owner is up to comes from
// the server, so the numbering of an older form can never be read back.
const STORAGE_KEY = "academy_onboarding_current";

const pageUrl = (id: string) => `/academy/onboarding?resumeId=${id}`;

export default function AcademyOnboardingContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId") || "";

  const [currentStep, setCurrentStep] = useState<AcademyStepNumber>(1);
  // The highest step the server has saved. The owner may open any step up to the next one.
  const [savedStep, setSavedStep] = useState(0);
  const [academyId, setAcademyId] = useState(resumeId);
  const [booting, setBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [formData, setFormData] = useState<AcademyFormData>({});
  const [payoutSaved, setPayoutSaved] = useState(false);
  const [resumed, setResumed] = useState(false);

  const unlockedStep = Math.min(savedStep + 1, LAST_ACADEMY_STEP) as AcademyStepNumber;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const idToLoad = resumeId || readStoredId();
      if (!idToLoad) {
        setBooting(false);
        return;
      }
      try {
        const response = await academyOnboardingApi.getProgress(idToLoad);
        if (cancelled || !response.data) return;
        const serverStep = response.data.currentStep;
        const academy = response.data.data as unknown as OnboardingAcademy & { lifecycle?: string };
        // Already sent for review: there is nothing left to fill in.
        if (academy.lifecycle === "SUBMITTED") {
          forget();
          router.replace(`/academy/onboarding/success/${idToLoad}`);
          return;
        }
        setResumed(true);
        setAcademyId(idToLoad);
        setSavedStep(serverStep || 0);
        setCurrentStep(resumeStepFor(serverStep));
        setFormData(formDataFromAcademy(academy, idToLoad, serverStep || 0));
        setPayoutSaved(payoutDetailsWereSaved(academy));
        remember(idToLoad);
        if (!resumeId) router.replace(pageUrl(idToLoad));
      } catch {
        if (!cancelled) {
          forget();
          // Without the sign-up's own token (another device) or a signed-in owner, the server
          // refuses. An id that was only remembered, not asked for, just starts a new sign-up.
          if (resumeId) setLoadFailed(true);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once, for the id the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const afterSave = (id: string, step: number, next: AcademyStepNumber) => {
    setAcademyId(id);
    setSavedStep((prev) => Math.max(prev, step));
    setCurrentStep(next);
    remember(id);
    router.replace(pageUrl(id));
  };

  const handleStep1Submit = async (data: AcademyStep1Payload): Promise<{ academyId: string }> => {
    setIsLoading(true);
    try {
      // The server has no "update step 1" call: when a sign-up already exists, the
      // basics stay as saved and the owner carries on.
      if (academyId) {
        setFormData((prev) => ({ ...prev, step1: data }));
        afterSave(academyId, 1, 2);
        return { academyId };
      }
      const response = await academyOnboardingApi.startOnboarding(data);
      const newId = response.data?.academyId || response.data?.id || response.data?._id || "";
      if (!newId) throw new Error("Academy ID not returned from server");
      setFormData((prev) => ({ ...prev, step1: data }));
      afterSave(newId, 1, 2);
      toast.success("Academy created. Continuing to step 2");
      return { academyId: newId };
    } finally {
      setIsLoading(false);
    }
  };

  const completeSubmission = async () => {
    await academyOnboardingApi.submitForApproval(academyId);
    forget();
    toast.success("Academy submitted for approval");
    router.push(`/academy/onboarding/success/${academyId}`);
  };

  const handleEmailVerified = async () => {
    setShowEmailVerification(false);
    setIsLoading(true);
    try {
      await completeSubmission();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit academy");
    } finally {
      setIsLoading(false);
    }
  };

  const saveStep = async (
    step: AcademyStepNumber,
    data:
      | AcademyStep2Payload
      | AcademyStep3Payload
      | AcademyVenuesPayload
      | AcademyCoachesPayload
      | AcademyPricingPayload
      | AcademyPayoutsPayload
  ) => {
    // A second click while a save is running must not send it twice.
    if (isLoading) return;
    setIsLoading(true);
    try {
      await academyOnboardingApi.saveStep(academyId, step, data);
      setFormData((prev) => ({ ...prev, [`step${step}`]: data }) as AcademyFormData);

      if (step === LAST_ACADEMY_STEP) {
        setSavedStep(LAST_ACADEMY_STEP);
        setPayoutSaved(true);
        try {
          await completeSubmission();
        } catch (error) {
          // The contact email must be confirmed first: ask for the code, then finish.
          if (needsEmailVerification(error)) {
            setShowEmailVerification(true);
            return;
          }
          throw error;
        }
      } else {
        afterSave(academyId, step, (step + 1) as AcademyStepNumber);
        toast.success(`Step ${step} saved`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= unlockedStep) setCurrentStep(step as AcademyStepNumber);
  };

  if (booting) return <LoadingScreen />;

  if (loadFailed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="mb-2 text-xl font-bold text-slate-900">We could not open this sign-up</h1>
          <p className="mb-4 text-sm text-slate-600">
            A sign-up can only be continued on the device where it was started, or by the owner
            signed in to their account. You can start a new one instead.
          </p>
          <a
            href="/academy/onboarding"
            className="bg-power-orange-solid inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
          >
            Start a new sign-up
          </a>
        </div>
      </div>
    );
  }

  const percent = academyProgressPercent(savedStep);
  const back = (step: number) => () => goToStep(step);

  return (
    <div className="py-2">
      <div className="mx-auto max-w-4xl">
        <p className="mx-auto mb-6 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-700">
          Early access, bookings aren&apos;t open yet. Submit your details now and our team will
          review and activate your academy once bookings launch.
        </p>

        <div className="mb-8">
          <div className="mb-2 flex justify-between">
            <h3 className="text-sm font-medium text-slate-700">
              Step {currentStep} of {LAST_ACADEMY_STEP}
            </h3>
            <span className="text-sm text-slate-600">{percent}% saved</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="bg-power-orange h-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <ol className="mb-8 flex justify-between gap-1">
          {ACADEMY_STEPS.map(({ number, title }) => {
            const open = number <= unlockedStep;
            const done = number <= savedStep && number !== currentStep;
            return (
              <li key={number} className="flex-1">
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => goToStep(number)}
                  aria-label={`Step ${number}: ${title}`}
                  aria-current={number === currentStep ? "step" : undefined}
                  className={`flex w-full flex-col items-center ${open ? "cursor-pointer" : "cursor-not-allowed"}`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all ${
                      number === currentStep
                        ? "bg-power-orange-solid scale-110 text-white shadow-lg"
                        : done
                          ? "bg-turf-green text-white"
                          : open
                            ? "bg-slate-300 text-slate-700"
                            : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {done ? "✓" : number}
                  </span>
                  <span
                    className={`mt-1 hidden text-center text-xs sm:block ${number === currentStep ? "text-power-orange font-medium" : "text-slate-500"}`}
                  >
                    {title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {resumed && savedStep >= 1 && currentStep > 1 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Continuing from step {currentStep}.{" "}
              {savedStep === 1 ? "Step 1 is saved." : `Steps 1 to ${savedStep} are saved.`}
            </span>
          </div>
        )}

        <div className="mb-8">
          {currentStep === 1 && (
            <Step1BasicInfo
              onSubmit={handleStep1Submit}
              loading={isLoading}
              previousData={formData.step1}
            />
          )}
          {currentStep === 2 && (
            <Step2Location
              academyId={academyId}
              onSubmit={(data) => saveStep(2, data)}
              loading={isLoading}
              onBack={back(1)}
              previousData={formData.step2}
            />
          )}
          {currentStep === 3 && (
            <Step3Legal
              academyId={academyId}
              onSubmit={(data) => saveStep(3, data)}
              loading={isLoading}
              onBack={back(2)}
              previousData={formData.step3}
            />
          )}
          {currentStep === 4 && (
            <Step4Venues
              academyId={academyId}
              onSubmit={(data) => saveStep(4, data)}
              loading={isLoading}
              onBack={back(3)}
              previousData={formData.step4}
            />
          )}
          {currentStep === 5 && (
            <Step5Coaches
              onSubmit={(data) => saveStep(5, data)}
              loading={isLoading}
              onBack={back(4)}
              previousData={formData.step5}
            />
          )}
          {currentStep === 6 && (
            <Step6Pricing
              onSubmit={(data) => saveStep(6, data)}
              loading={isLoading}
              onBack={back(5)}
              previousData={formData.step6}
            />
          )}
          {currentStep === 7 && (
            <Step7Payouts
              onSubmit={(data) => saveStep(7, data)}
              loading={isLoading}
              onBack={back(6)}
              previousData={formData.step7}
              payoutDetailsSaved={payoutSaved}
            />
          )}
        </div>

        {showEmailVerification && academyId && (
          <EmailVerificationModal
            email={formData.step1?.ownerEmail || "your contact email"}
            sendOnOpen
            verifyCode={(code) => academyOnboardingApi.verifyEmailCode(academyId, code)}
            resendCode={() => academyOnboardingApi.sendEmailCode(academyId)}
            onVerified={handleEmailVerified}
            onClose={() => setShowEmailVerification(false)}
          />
        )}

        <div className="text-center text-sm text-slate-600">
          <p>Each step is saved when you continue. You can close and resume later.</p>
          <p className="mt-1">
            Questions?{" "}
            <a href="mailto:support@powermysport.com" className="text-power-orange hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="bg-power-orange/20 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full">
          <div className="border-power-orange border-3 h-8 w-8 animate-spin rounded-full border-t-transparent" />
        </div>
        <p className="text-slate-600">Loading your progress...</p>
      </div>
    </div>
  );
}

function readStoredId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function remember(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable: the id stays in the address
  }
}

function forget() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
