import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * An edge-to-edge photograph with one line and one button over it: the page's
 * campaign moment (borrowed from Nike's campaign tiles in the design reference).
 *
 * It is deliberately the one place the cream rhythm breaks for imagery, so it
 * appears once per page. A warm-ink fade from the bottom keeps the cream text
 * readable whatever the photo does, and the heading sits on the quiet lower
 * third of the frame.
 */
export function PhotoBand({
  title,
  description,
  cta,
  image,
}: {
  title: string;
  description?: string;
  cta: { label: string; href: string };
  image: { src: string; alt: string; position?: string };
}) {
  return (
    <section className="bg-ink text-paper relative isolate flex min-h-[78dvh] items-end overflow-hidden">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="100vw"
        className={`-z-20 object-cover ${image.position ?? "object-center"}`}
      />
      {/* Warm-ink fade: strongest under the text, light over the faces. */}
      <div
        aria-hidden
        className="from-ink/90 via-ink/40 to-ink/10 absolute inset-0 -z-10 bg-gradient-to-t"
      />

      <div className="reveal-on-scroll mx-auto w-full max-w-7xl px-4 pb-16 pt-40 sm:px-6 sm:pb-24 lg:px-8">
        <h2 className="font-editorial max-w-2xl text-balance text-5xl font-light leading-[1.04] sm:text-6xl lg:text-[4.5rem]">
          {title}
        </h2>
        {description && (
          <p className="mt-6 max-w-[48ch] text-pretty text-lg leading-relaxed sm:text-xl">
            {description}
          </p>
        )}
        <Link
          href={cta.href}
          className="bg-power-orange-solid focus-visible:ring-paper focus-visible:ring-offset-ink group mt-10 inline-flex items-center gap-2 rounded-md px-7 py-3.5 text-base font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          {cta.label}
          <ArrowRight
            aria-hidden
            strokeWidth={1.75}
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </div>
    </section>
  );
}
