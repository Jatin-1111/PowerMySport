import { sessionKey, sessionTitle, whenLabel } from "@/modules/expert/utils/sessions";
import type { ExpertSession } from "@/modules/expert/services/expert";
import { Button } from "@/modules/shared/ui/Button";
import { formatRupees, plural } from "@/modules/shared/utils/figures";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const SHOWN = 3;

/**
 * The one thing on the page that is waiting on the expert: a parent has booked a
 * time and is waiting for it to be confirmed. A tonal band with the page's single
 * primary action; the answers themselves are given on the sessions page.
 */
export function ExpertRequestsBand({ requests }: { requests: ExpertSession[] }) {
  const count = requests.length;
  const hidden = count - SHOWN;

  return (
    <section
      aria-labelledby="requests-heading"
      className="bg-paper-deep rounded-2xl p-6 sm:p-8 xl:p-10"
    >
      <div className="grid gap-8 xl:grid-cols-12 xl:gap-14">
        <div className="xl:col-span-5">
          <h2
            id="requests-heading"
            className="font-editorial text-ink max-w-[22ch] text-balance text-3xl font-light leading-[1.1] tracking-tight sm:text-4xl"
          >
            {count === 1 ? "1 session needs" : `${count} sessions need`} your reply
          </h2>
          <p className="text-ink-body mt-4 max-w-[48ch] text-pretty">
            Accept the time, suggest another or decline, so the parent knows where they stand.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/expert/sessions">
                Review {count === 1 ? "request" : "requests"}
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="xl:col-span-7">
          <ul aria-label="Sessions waiting for your reply">
            {requests.slice(0, SHOWN).map((session, index) => (
              <li
                key={sessionKey(session, index)}
                className="border-ink/15 flex items-baseline justify-between gap-6 border-t py-3.5 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate font-medium">{sessionTitle(session)}</p>
                  <p className="text-ink-body text-sm">{whenLabel(session)}</p>
                </div>
                <p className="text-ink shrink-0 font-medium tabular-nums">
                  {formatRupees(session.amount)}
                </p>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-ink-body border-ink/15 border-t pt-3.5 text-sm">
              and {plural(hidden, "more request")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
