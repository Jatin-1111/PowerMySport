import { ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="bg-paper flex min-h-screen flex-col justify-center px-6 py-20">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-ink-muted text-sm tabular-nums">Error 404</p>
        <h1 className="font-editorial text-ink mt-3 text-balance text-5xl font-light leading-tight tracking-tight sm:text-7xl">
          This page has <span className="italic">left the field</span>
        </h1>
        <p className="text-ink-body mt-6 max-w-xl text-pretty text-lg leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved. Head back to
          the home page, or look for a venue, coach or academy.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/"
            className="bg-power-orange-solid focus-visible:ring-ink inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-medium text-white transition-colors hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Back to home
          </Link>
          <Link
            href="/booking"
            className="text-ink focus-visible:ring-ink inline-flex items-center gap-1.5 rounded-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
          >
            Explore venues and coaches
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
