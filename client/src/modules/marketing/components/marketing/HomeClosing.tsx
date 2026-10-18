import { Button } from "@/modules/shared/ui/Button";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** The homepage's closing panel: one question, one orange action, one text link. */
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
    <section className="bg-paper pb-24 pt-8 sm:pb-32 lg:pb-40">
      <div className="reveal-on-scroll mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-wash rounded-3xl px-6 py-16 sm:px-14 sm:py-24 lg:px-20">
          <h2 className="font-editorial text-ink max-w-3xl text-balance text-4xl font-light leading-[1.06] sm:text-6xl">
            {title}
          </h2>
          <p className="text-ink-body mb-10 mt-6 max-w-[52ch] text-pretty text-lg leading-relaxed">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild variant="primary" size="lg" className="h-auto px-7 py-3.5 text-base">
              <Link
                href={primaryCTA.href}
                {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {isWhatsApp && <WhatsAppIcon className="h-5 w-5 shrink-0" />}
                {primaryCTA.label}
              </Link>
            </Button>
            <Link
              href={secondaryCTA.href}
              className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink focus-visible:ring-offset-wash group inline-flex items-center gap-1.5 rounded text-base font-medium underline underline-offset-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {secondaryCTA.label}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
