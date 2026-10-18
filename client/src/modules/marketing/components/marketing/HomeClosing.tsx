import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { Bezel } from "./Bezel";
import { PillButton } from "./PillButton";

/** The homepage's closing panel: one question, one primary action, one alternative. */
export function HomeClosing({
  title,
  description,
  primaryCTA,
  secondaryCTA,
}: {
  title: string;
  description: string;
  primaryCTA: { label: string; href: string };
  secondaryCTA: { label: string; href: string };
}) {
  const isWhatsApp = primaryCTA.href.includes("wa.me");

  return (
    <section className="bg-white py-24 sm:py-32 lg:py-40">
      <div className="reveal-on-scroll mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Bezel innerClassName="relative overflow-hidden bg-slate-50 px-6 py-16 text-center sm:px-16 sm:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(233,115,22,0.12),transparent)]"
          />
          <div className="relative">
            <h2 className="font-title mx-auto mb-6 max-w-2xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-6xl">
              {title}
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {description}
            </p>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <PillButton
                href={primaryCTA.href}
                variant={isWhatsApp ? "whatsapp" : "primary"}
                leading={
                  isWhatsApp ? <WhatsAppIcon className="h-[18px] w-[18px] shrink-0" /> : null
                }
              >
                {primaryCTA.label}
              </PillButton>
              <PillButton href={secondaryCTA.href} variant="light">
                {secondaryCTA.label}
              </PillButton>
            </div>
          </div>
        </Bezel>
      </div>
    </section>
  );
}
