import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * The homepage's closing panel, and the page's one full-colour moment.
 *
 * Brand orange is otherwise kept for the main button, so a whole panel of it
 * lands hard after a long run of cream. Cream text on `power-orange-solid` is
 * 5:1; the button is ink so it reads against the orange instead of vanishing
 * into it.
 */
export function HomeClosing({
  title,
  description,
  primaryCTA,
  secondaryCTA,
}: {
  title: string;
  description: string;
  primaryCTA: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
}) {
  const isWhatsApp = primaryCTA.href.includes("wa.me");

  return (
    <section className="bg-paper pb-24 pt-8 sm:pb-32 lg:pb-40">
      <div className="reveal-on-scroll mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-power-orange-solid text-paper rounded-3xl px-6 py-16 sm:px-14 sm:py-24 lg:px-20 lg:py-28">
          <h2 className="font-editorial max-w-4xl text-balance text-5xl font-light leading-[1.02] sm:text-7xl lg:text-[5.5rem]">
            {title}
          </h2>
          <p className="mb-12 mt-8 max-w-[50ch] text-pretty text-lg leading-relaxed sm:text-xl">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <Link
              href={primaryCTA.href}
              {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="bg-ink hover:bg-ink-hover focus-visible:ring-paper focus-visible:ring-offset-power-orange-solid inline-flex items-center justify-center gap-2 rounded-md px-7 py-3.5 text-base font-semibold text-white transition-[background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              {isWhatsApp && <WhatsAppIcon className="h-5 w-5 shrink-0" />}
              {primaryCTA.label}
            </Link>
            {secondaryCTA && (
              <Link
                href={secondaryCTA.href}
                className="decoration-paper/50 hover:decoration-paper focus-visible:ring-paper focus-visible:ring-offset-power-orange-solid group inline-flex items-center gap-1.5 rounded text-base font-medium underline underline-offset-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {secondaryCTA.label}
                <ArrowRight
                  aria-hidden
                  strokeWidth={1.5}
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
