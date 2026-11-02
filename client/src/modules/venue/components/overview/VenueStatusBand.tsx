import { Button } from "@/modules/shared/ui/Button";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { VenueStatusView } from "../../utils/overview";

/**
 * Shown only while a venue is not live. It says where the venue stands and, when
 * there is something the owner can do about it, offers that one action. A venue
 * in review gets no button: there is nothing to press.
 */
export function VenueStatusBand({ view }: { view: VenueStatusView }) {
  if (!view.headline) return null;

  return (
    <section
      aria-labelledby="venue-status-heading"
      className="bg-paper-deep rounded-2xl p-6 sm:p-8"
    >
      <StatusTag tone={view.tone}>{view.tag}</StatusTag>
      <h2
        id="venue-status-heading"
        className="font-editorial text-ink mt-4 max-w-[30ch] text-balance text-2xl font-light tracking-tight sm:text-3xl"
      >
        {view.headline}
      </h2>
      {view.body && <p className="text-ink-body mt-3 max-w-[60ch] text-pretty">{view.body}</p>}
      {view.action && (
        <div className="mt-6">
          <Button asChild>
            <Link href={view.action.href}>
              {view.action.label}
              <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
