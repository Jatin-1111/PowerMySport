import { STEP_META, WizardStep } from "@/modules/admin/utils/venueFormHelpers";
import { Check, CircleDot } from "lucide-react";

interface AddVenueStepProgressProps {
  currentStep: WizardStep;
  loading: boolean;
  onStepJump: (step: WizardStep) => void;
}

export function AddVenueStepProgress({
  currentStep,
  loading,
  onStepJump,
}: AddVenueStepProgressProps) {
  const activeStepMeta = STEP_META.find((item) => item.step === currentStep);
  const progressPercent = ((currentStep - 1) / (STEP_META.length - 1)) * 100;

  return (
    <div className="shadow-xs sticky top-4 z-20 mx-auto mb-8 max-w-4xl rounded-2xl border border-slate-200/80 bg-white/90 p-5 backdrop-blur-sm">
      <div className="relative mb-4 overflow-x-auto">
        <div className="min-w-180 relative pb-2">
          <div className="absolute left-6 right-6 top-6 h-0.5 rounded-full bg-slate-200" />
          <div
            className="bg-power-orange absolute left-6 top-6 h-0.5 rounded-full transition-all duration-500"
            style={{
              width: `max(0px, calc(${progressPercent}% - 0.5rem))`,
            }}
          />

          <div className="grid grid-cols-5 gap-2 md:gap-3">
            {STEP_META.map((item) => {
              const isCompleted = item.step < currentStep;
              const isActive = item.step === currentStep;
              const isFuture = item.step > currentStep;
              const stateLabel = isCompleted ? "Done" : isActive ? "Current" : "Upcoming";

              return (
                <div key={item.step} className="relative text-center">
                  <button
                    type="button"
                    onClick={() => onStepJump(item.step)}
                    disabled={!isCompleted || loading}
                    title={
                      isCompleted
                        ? `Go to ${item.label}`
                        : isFuture
                          ? "Complete previous steps first"
                          : item.label
                    }
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white transition-all duration-300 ${
                      isCompleted
                        ? "cursor-pointer bg-emerald-500 text-white shadow-md hover:scale-105"
                        : isActive
                          ? "from-power-orange bg-linear-to-br scale-110 to-orange-500 text-white shadow-lg"
                          : "cursor-not-allowed bg-slate-200 text-slate-600"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : isActive ? (
                      <CircleDot className="h-5 w-5" />
                    ) : (
                      `0${item.step}`.slice(-2)
                    )}
                  </button>
                  <div
                    className={`mt-3 rounded-2xl border px-3 py-3 transition-all duration-300 ${
                      isActive
                        ? "border-power-orange/25 from-power-orange/10 bg-linear-to-b to-white shadow-sm"
                        : isCompleted
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-slate-200 bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          isActive
                            ? "bg-power-orange/15 text-power-orange"
                            : isCompleted
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {stateLabel}
                      </span>
                    </div>
                    <p
                      className={`mt-2 text-[11px] font-semibold leading-tight md:text-xs ${
                        isActive ? "text-power-orange" : "text-slate-800"
                      }`}
                    >
                      {item.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="bg-power-orange h-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>{activeStepMeta?.hint || ""}</p>
        <p>{Math.round(progressPercent)}% complete</p>
      </div>
    </div>
  );
}
