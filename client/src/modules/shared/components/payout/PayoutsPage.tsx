import type { ReactNode } from "react";

export interface PayoutFact {
  term: string;
  detail: string;
}

/**
 * The frame every payouts page shares: a heading, the payout manager on the
 * left and a short "good to know" list on the right. The facts are plain
 * statements about how payouts work, not marketing tiles, and none of them
 * promises a speed we do not control.
 */
export function PayoutsPage({
  consoleLabel,
  intro,
  facts,
  children,
}: {
  /** The console this page sits in, e.g. "Venue console". */
  consoleLabel: string;
  intro: string;
  facts: PayoutFact[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-10 sm:space-y-12">
      <header>
        <p className="text-ink-body text-sm">{consoleLabel}</p>
        <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
          Payouts
        </h1>
        <p className="text-ink-body mt-3 max-w-[56ch] text-pretty">{intro}</p>
      </header>

      <div className="grid gap-12 xl:grid-cols-12 xl:gap-16">
        <div className="min-w-0 xl:col-span-7">{children}</div>

        <section aria-labelledby="payout-facts-heading" className="xl:col-span-5">
          <h2 id="payout-facts-heading" className="text-ink text-base font-semibold">
            Good to know
          </h2>
          <dl className="border-hairline mt-4 border-t">
            {facts.map((fact) => (
              <div key={fact.term} className="border-hairline border-b py-4">
                <dt className="text-ink font-medium">{fact.term}</dt>
                <dd className="text-ink-body mt-1 text-pretty text-sm">{fact.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
