"use client";

import type { NextStep } from "@/modules/player/utils/dependentPageModel";
import { Button } from "@/modules/shared/ui/Button";
import Link from "next/link";

interface DependentNextStepProps {
  step: NextStep;
  discoverHref: string;
  onEdit: () => void;
}

/**
 * The single thing worth doing next, set apart from the rest of the page. It is the only orange
 * action on the screen, and it is absent once nothing is outstanding.
 */
export function DependentNextStep({ step, discoverHref, onEdit }: DependentNextStepProps) {
  return (
    <section
      aria-labelledby="next-step"
      className="bg-wash flex flex-col gap-5 rounded-2xl px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8"
    >
      <div className="max-w-xl">
        <p className="text-ink-body text-sm font-medium">Next step</p>
        <h2
          id="next-step"
          className="font-editorial text-ink mt-1 text-balance text-2xl font-normal leading-tight tracking-tight"
        >
          {step.title}
        </h2>
        <p className="text-ink-body mt-2 text-pretty">{step.detail}</p>
      </div>
      {step.kind === "choose-sport" ? (
        <Button asChild className="min-h-11 shrink-0">
          <Link href={discoverHref}>Find a sport</Link>
        </Button>
      ) : (
        <Button onClick={onEdit} className="min-h-11 shrink-0">
          Add the missing details
        </Button>
      )}
    </section>
  );
}
