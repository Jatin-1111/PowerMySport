"use client";

import { toast } from "@/lib/toast";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import type {
  AcademyStep1Payload,
  AcademyStep2Payload,
  AcademyStep3Payload,
  AcademyStep4Payload,
  AcademyStep5Payload,
  AcademyStep6Payload,
  AcademyStepPayload,
  OnboardingAcademy,
} from "@/modules/onboarding/types/academy";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Location from "./Step2Location";
import Step3Legal from "./Step3Legal";
import Step4VenuesCoaches from "./Step4VenuesCoaches";
import Step5Pricing from "./Step5Pricing";
import Step6Payouts from "./Step6Payouts";

const STORAGE_KEY = "academy_onboarding_progress";

interface SavedProgress {
  academyId: string;
  currentStep: number;
}

interface SavedFormData {
  step1?: AcademyStep1Payload;
  step2?: AcademyStep2Payload;
  step3?: AcademyStep3Payload;
  step4?: AcademyStep4Payload;
  step5?: AcademyStep5Payload;
  step6?: AcademyStep6Payload;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS = ["Basics", "Location", "Legal", "Venues", "Pricing", "Payouts"];

export default function AcademyOnboardingContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const resumeId = searchParams.get("resumeId") || "";

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<OnboardingStep>(1);
  const [academyId, setAcademyId] = useState<string>(resumeId);
  const [isLoading, setIsLoading] = useState(!!resumeId);
  const [formData, setFormData] = useState<SavedFormData>({});

  // Save progress and form data to localStorage for resilience
  const saveLocalProgress = useCallback((id: string, step: number) => {
    try {
      // Only save progress tracking, form data comes from database
      const progress: SavedProgress = { academyId: id, currentStep: step };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // localStorage not available
    }
  }, []);

  const saveStepData = useCallback((step: number, data: AcademyStepPayload) => {
    setFormData((prev) => {
      const updated = { ...prev };
      if (step === 1) updated.step1 = data as AcademyStep1Payload;
      if (step === 2) updated.step2 = data as AcademyStep2Payload;
      if (step === 3) updated.step3 = data as AcademyStep3Payload;
      if (step === 4) updated.step4 = data as AcademyStep4Payload;
      if (step === 5) updated.step5 = data as AcademyStep5Payload;
      if (step === 6) updated.step6 = data as AcademyStep6Payload;
      return updated;
    });
  }, []);

  // On mount: check URL param, then load academy data from server
  useEffect(() => {
    const loadProgress = async () => {
      const idToUse = resumeId;

      if (idToUse) {
        try {
          const response = await academyOnboardingApi.getProgress(idToUse);
          if (response.data) {
            const { currentStep } = response.data;
            const academyData = response.data.data as unknown as OnboardingAcademy | null;
            if (currentStep) {
              const step = Math.min(Math.max(currentStep, 1), 6) as OnboardingStep;
              setCurrentStep(step);
              setMaxUnlockedStep(step);

              // Extract step data from academy document
              if (academyData) {
                const newFormData: SavedFormData = {};

                // Map all step payloads from academyData
                if (step >= 1) {
                  newFormData.step1 = {
                    ownerName: academyData.contactPersonName || "",
                    ownerEmail: academyData.contactEmail || "",
                    ownerPhone: academyData.contactPhone || "",
                    name: academyData.name,
                    legalName: academyData.legalName,
                    sports: academyData.sports,
                    ageGroups: academyData.ageGroups,
                    establishedYear: academyData.establishedYear,
                    description: academyData.description || "",
                    logoUrl: academyData.logoUrl,
                    logoKey: academyData.logoKey,
                  };
                }

                if (step >= 2) {
                  newFormData.step2 = {
                    academyId: idToUse,
                    location: academyData.location || {
                      type: "Point",
                      coordinates: [0, 0],
                    },
                    address: academyData.address || "",
                    city: academyData.city || "",
                    state: academyData.state || "",
                    pincode: academyData.pincode || "",
                    placeId: academyData.placeId,
                    contactPersonName: academyData.contactPersonName || "",
                    contactPhone: academyData.contactPhone || "",
                    contactEmail: academyData.contactEmail || "",
                    whatsappNumber: academyData.whatsappNumber || "",
                    languagesSpoken: academyData.languagesSpoken || [],
                  };
                }

                if (step >= 3) {
                  newFormData.step3 = {
                    academyId: idToUse,
                    businessType: (academyData.businessType as any) || "sole_proprietorship",
                    panNumber: academyData.panNumber || "",
                    panDocumentUrl: academyData.panDocumentUrl || "",
                    panDocumentKey: academyData.panDocumentKey || "",
                    gstNumber: academyData.gstNumber,
                    gstDocumentUrl: academyData.gstDocumentUrl,
                    gstDocumentKey: academyData.gstDocumentKey,
                    aadhaarLast4: academyData.aadhaarLast4 || "",
                  };
                }

                if (step >= 4) {
                  newFormData.step4 = {
                    academyId: idToUse,
                    allowsExternalCoaches: academyData.allowsExternalCoaches ?? true,
                    venueIds: academyData.venueIds || [],
                    coachIds: academyData.coachIds || [],
                  };
                }

                if (step >= 5) {
                  newFormData.step5 = {
                    academyId: idToUse,
                    sessionRatePerHour: academyData.sessionRatePerHour || 0,
                    batchTimings: academyData.batchTimings || [],
                    maxBatchSize: academyData.maxBatchSize || 20,
                    trialsessionOffered: academyData.trialsessionOffered ?? false,
                    trialSessionPrice: academyData.trialSessionPrice || 0,
                  };
                }

                if (step >= 6) {
                  newFormData.step6 = {
                    academyId: idToUse,
                    bankAccountName: academyData.bankAccountName || "",
                    bankAccountNumber: academyData.bankAccountNumber || "",
                    bankIfsc: academyData.bankIfsc || "",
                    upiId: academyData.upiId || "",
                    payoutFrequency: academyData.payoutFrequency || "monthly",
                    cancellationPolicy: academyData.cancellationPolicy || "",
                    refundPolicy: academyData.refundPolicy || "",
                  };
                }

                setFormData(newFormData);
              }

              saveLocalProgress(idToUse, step);
            }
          }
        } catch (error) {
          console.error("Failed to load academy from server:", error);
          toast.error("Failed to load saved progress.");
        }
      } else {
        // No resumeId in URL — check localStorage for an in-progress onboarding as fallback
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed: SavedProgress = JSON.parse(saved);
            if (parsed.academyId && parsed.currentStep > 1) {
              // Auto-restore silently and update URL
              setAcademyId(parsed.academyId);
              setCurrentStep(Math.min(Math.max(parsed.currentStep, 1), 6) as OnboardingStep);
              setMaxUnlockedStep(Math.min(Math.max(parsed.currentStep, 1), 6) as OnboardingStep);
              router.replace(`/academy/onboarding?resumeId=${parsed.academyId}`);
            }
          }
        } catch {
          // ignore
        }
      }
      setIsLoading(false);
    };

    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance step and persist to URL + localStorage
  const advanceStep = useCallback(
    (id: string, nextStep: OnboardingStep) => {
      setAcademyId(id);
      setCurrentStep(nextStep);
      setMaxUnlockedStep((prev) => Math.max(prev, nextStep) as OnboardingStep);
      saveLocalProgress(id, nextStep);
      // Keep resumeId in URL so refresh doesn't lose state
      router.replace(`/academy/onboarding?resumeId=${id}`);
    },
    [router, saveLocalProgress]
  );

  const handleStep1Submit = async (data: AcademyStep1Payload): Promise<{ academyId: string }> => {
    try {
      setIsLoading(true);
      const existingAcademyId = academyId || resumeId;

      // If onboarding already exists, update step 1 instead of creating a new academy.
      if (existingAcademyId) {
        // Step save endpoint only supports steps 2-6. For step 1 on resume,
        // keep values in local state and continue to unlocked steps.
        saveStepData(1, data);
        advanceStep(existingAcademyId, 2);
        toast.success("Continuing to Step 2");
        return { academyId: existingAcademyId };
      }

      const response = await academyOnboardingApi.startOnboarding(data);
      const newAcademyId =
        response.data?.academyId || response.data?.id || response.data?._id || "";
      if (!newAcademyId) {
        throw new Error("Academy ID not returned from server");
      }
      // Save Step 1 data
      saveStepData(1, data);
      advanceStep(newAcademyId, 2);
      toast.success("Academy created. Continuing to Step 2");
      return { academyId: newAcademyId };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create academy");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepSubmit = async (
    stepNumber: OnboardingStep,
    data:
      | AcademyStep2Payload
      | AcademyStep3Payload
      | AcademyStep4Payload
      | AcademyStep5Payload
      | AcademyStep6Payload
  ) => {
    try {
      setIsLoading(true);
      await academyOnboardingApi.saveStep(academyId, stepNumber, data);

      // Save step data to server (form data syncs from DB on resume)
      saveStepData(stepNumber, data);

      if (stepNumber === 6) {
        // Last step — submit for approval
        await academyOnboardingApi.submitForApproval(academyId);
        // Clear saved progress
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        toast.success("Academy submitted for approval");
        router.push(`/academy/onboarding/success/${academyId}`);
      } else {
        const nextStep = (stepNumber + 1) as OnboardingStep;
        advanceStep(academyId, nextStep);
        toast.success(`Step ${stepNumber} saved`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to save step ${stepNumber}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const goToStep = (step: number) => {
    // Users can move only within unlocked steps; skipping locked steps is not allowed.
    if (step >= 1 && step <= maxUnlockedStep) {
      setCurrentStep(step as OnboardingStep);
      // Persist highest unlocked progress so back-navigation doesn't re-lock completed steps.
      try {
        const idToSave = academyId || resumeId || "";
        if (idToSave) {
          saveLocalProgress(idToSave, maxUnlockedStep);
          router.replace(`/academy/onboarding?resumeId=${idToSave}`);
        }
      } catch {
        // ignore
      }
    }
  };

  const canGoPrev = currentStep > 1;
  const canGoNext = currentStep < maxUnlockedStep;

  const goPrev = () => {
    if (canGoPrev) {
      goToStep(currentStep - 1);
    }
  };

  const goNext = () => {
    if (canGoNext) {
      goToStep(currentStep + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="bg-power-orange/20 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full">
            <div className="border-power-orange h-8 w-8 animate-spin rounded-full border-3 border-t-transparent" />
          </div>
          <p className="text-slate-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <p className="mx-auto mb-6 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-700">
          Early access — bookings aren&apos;t open yet. Submit your details now and our team will
          review and activate your academy once bookings launch.
        </p>
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between">
            <h3 className="text-sm font-medium text-slate-700">Step {currentStep} of 6</h3>
            <span className="text-sm text-slate-600">
              {Math.round((currentStep / 6) * 100)}% complete
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="from-power-orange to-power-orange/80 h-full bg-linear-to-r transition-all duration-500"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="mb-8 flex justify-between">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div
              key={step}
              className={`flex flex-col items-center ${step <= maxUnlockedStep ? "cursor-pointer" : "cursor-not-allowed"}`}
              onClick={() => goToStep(step)}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all ${
                  step === currentStep
                    ? "bg-power-orange scale-110 text-white shadow-lg"
                    : step <= maxUnlockedStep
                      ? "bg-turf-green text-white"
                      : "bg-slate-200 text-slate-400"
                }`}
              >
                {step < maxUnlockedStep ? "✓" : step}
              </div>
              <span
                className={`mt-1 text-xs ${step === currentStep ? "text-power-orange font-medium" : "text-slate-500"}`}
              >
                {STEP_LABELS[step - 1]}
              </span>
            </div>
          ))}
        </div>

        {/* Step navigation controls */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous Step
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="border-power-orange/30 text-power-orange bg-power-orange/10 hover:bg-power-orange/15 rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Step
          </button>
        </div>

        {/* Resume banner */}
        {resumeId && currentStep > 1 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            <span>✅</span>
            <span>Resuming your onboarding from Step {currentStep}. Previous steps are saved.</span>
          </div>
        )}

        {/* Step Content */}
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
              onSubmit={(data) => handleStepSubmit(2, data)}
              loading={isLoading}
              onBack={() => goToStep(1)}
              previousData={formData.step2}
            />
          )}

          {currentStep === 3 && (
            <Step3Legal
              academyId={academyId}
              onSubmit={(data) => handleStepSubmit(3, data)}
              loading={isLoading}
              onBack={() => goToStep(2)}
              previousData={formData.step3}
            />
          )}

          {currentStep === 4 && (
            <Step4VenuesCoaches
              academyId={academyId}
              onSubmit={(data) => handleStepSubmit(4, data)}
              loading={isLoading}
              onBack={() => goToStep(3)}
              previousData={formData.step4}
            />
          )}

          {currentStep === 5 && (
            <Step5Pricing
              academyId={academyId}
              onSubmit={(data) => handleStepSubmit(5, data)}
              loading={isLoading}
              onBack={() => goToStep(4)}
              previousData={formData.step5}
            />
          )}

          {currentStep === 6 && (
            <Step6Payouts
              academyId={academyId}
              onSubmit={(data) => handleStepSubmit(6, data)}
              loading={isLoading}
              onBack={() => goToStep(5)}
              previousData={formData.step6}
            />
          )}
        </div>

        {/* Help Text */}
        <div className="text-center text-sm text-slate-600">
          <p>Your progress is automatically saved. You can close and resume later.</p>
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
