"use client";

import { CheckCircle2 } from "lucide-react";
import { Fragment } from "react";
import { STEPS } from "../../constants";

export function StepIndicator({ current, steps }: { current: number; steps: typeof STEPS }) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Progress
          </span>
        </div>
      </div>
      <div className="flex w-full items-start">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const done = current > step.id;
          const active = current === step.id;
          return (
            <Fragment key={step.id}>
              <div className="flex w-14 shrink-0 flex-col items-center sm:w-20">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 sm:h-10 sm:w-10 ${
                    done
                      ? "bg-turf-green border-emerald-500 text-white shadow-md shadow-emerald-200"
                      : active
                        ? "border-power-orange bg-power-orange shadow-power-orange/30 text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`mt-1.5 hidden text-center text-[10px] font-semibold sm:block ${
                    active ? "text-power-orange" : done ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="mx-1 mt-[18px] flex-1 sm:mx-2 sm:mt-[20px]">
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
