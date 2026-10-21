import Link from "next/link";
import { PenLine } from "lucide-react";

interface BlogHeroProps {
  totalBlogs: number;
}

export default function BlogHero({ totalBlogs }: BlogHeroProps) {
  return (
    <section className="bg-paper-deep rounded-2xl px-5 py-10 sm:px-10 sm:py-16">
      <p className="text-ink-body text-sm font-medium">PowerMySport Experiences</p>
      <h1 className="font-editorial text-ink mt-3 text-balance text-4xl font-light leading-[1.08] sm:text-5xl lg:text-6xl">
        Share your <span className="text-ink-muted italic">experience</span>
      </h1>
      <p className="text-ink-body mt-4 max-w-[56ch] text-pretty text-base leading-relaxed sm:text-lg">
        Help another parent make a better decision. Tournaments, academies, gear, travel, costs: two
        lines is enough.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href="/experiences/new"
          className="btn-motion bg-power-orange-solid inline-flex min-h-12 items-center gap-2 rounded-md px-7 py-3.5 text-base font-semibold text-white hover:bg-indigo-700"
        >
          <PenLine size={17} aria-hidden="true" />
          Share your experience
        </Link>
        <p className="text-ink-muted text-sm">
          {totalBlogs} {totalBlogs === 1 ? "experience" : "experiences"} shared so far
        </p>
      </div>
    </section>
  );
}
