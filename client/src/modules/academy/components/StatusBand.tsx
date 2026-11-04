import { Button } from "@/modules/shared/ui/Button";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { cn } from "@/utils/cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { OwnAcademy, StatusView } from "../types";
import { StepList } from "./StepList";

/**
 * The one panel that answers "where does my academy stand, and what do I do
 * next?". It is a tonal band, not a card: the page has a single primary action
 * and this is where it lives. Shown only until the academy is live.
 */
export function StatusBand({ view, academy }: { view: StatusView; academy: OwnAcademy | null }) {
  const reason = academy?.lifecycle === "REJECTED" ? academy.rejectionReason : undefined;

  return (
    <section
      aria-labelledby="status-heading"
      className="bg-paper-deep rounded-2xl p-6 sm:p-8 lg:p-10"
    >
      <div className="grid gap-8 xl:grid-cols-12 xl:gap-14">
        <div className={cn(view.steps ? "xl:col-span-7" : "xl:col-span-12")}>
          <h2
            id="status-heading"
            className="font-editorial text-ink max-w-[26ch] text-balance text-3xl font-light leading-[1.1] tracking-tight sm:text-4xl"
          >
            {view.headline}
          </h2>
          <p className="text-ink-body mt-4 max-w-[56ch] text-pretty">{view.body}</p>

          {reason && (
            <blockquote className="border-ink/25 text-ink mt-6 max-w-[56ch] text-pretty border-l-2 pl-4">
              <p className="text-ink-body mb-1 text-sm">Reason from our team</p>
              {reason}
            </blockquote>
          )}

          {(view.primary || view.secondary) && (
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {view.primary && (
                <Button asChild size="lg">
                  <Link href={view.primary.href}>
                    {view.primary.label}
                    <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </Button>
              )}
              {view.secondary && (
                <Link href={view.secondary.href} className={`${TEXT_LINK} ring-offset-paper-deep`}>
                  {view.secondary.label}
                </Link>
              )}
            </div>
          )}
        </div>

        {view.steps && (
          <div className="xl:col-span-5">
            <StepList kind={view.steps} savedSteps={academy?.onboardingStep ?? 0} />
          </div>
        )}
      </div>
    </section>
  );
}
