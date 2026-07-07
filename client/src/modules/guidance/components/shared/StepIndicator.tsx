"use client";

import { CheckCircle2 } from "lucide-react";
import { Fragment } from "react";
import { STEPS } from "../../constants";

export function StepIndicator({
  current,
  steps,
}: {
  current: number;
  steps: typeof STEPS;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Progress
          </span>
        </div>
      </div>
      <div className="flex items-start w-full">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const done = current > step.id;
          const active = current === step.id;
          return (
            <Fragment key={step.id}>
              <div className="flex flex-col items-center shrink-0 w-14 sm:w-20">
                <div
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    done
                      ? "border-emerald-500 bg-turf-green text-white shadow-emerald-200 shadow-md"
                      : active
                        ? "border-power-orange bg-power-orange text-white shadow-power-orange/30 shadow-md"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`mt-1.5 text-[10px] font-semibold hidden sm:block text-center ${
                    active
                      ? "text-power-orange"
                      : done
                        ? "text-emerald-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 mt-[18px] sm:mt-[20px] mx-1 sm:mx-2">
                  <div
                    className={`h-0.5 w-full rounded transition-all duration-500 ${
                      current > step.id ? "bg-turf-green" : "bg-slate-100"
                    }`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
