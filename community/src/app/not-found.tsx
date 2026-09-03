import { buildMetadata } from "@/lib/seo";
import { Compass, Home } from "lucide-react";
import Link from "next/link";

/**
 * Built through `buildMetadata` rather than hand-rolled. The previous literal
 * set only `title` and `robots`, so the 404 inherited the root layout's
 * Open Graph block *and* its canonical — every missing URL announced itself to
 * crawlers and social scrapers as the community homepage.
 */
export const metadata = buildMetadata({
  title: "Page not found",
  description: "This PowerMySport community page doesn't exist or may have moved.",
  path: "/404",
  noindex: true,
});

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/90 p-8 text-center shadow-sm backdrop-blur">
        <p className="text-power-orange mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
          Error 404
        </p>
        <h1 className="font-title text-6xl font-extrabold text-slate-900">404</h1>
        <h2 className="mt-3 text-xl font-bold text-slate-900">Page not found</h2>
        <p className="mt-2 text-sm text-slate-600">
          This page doesn&apos;t exist or may have moved. Head back to the community.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="bg-power-orange inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Home className="h-4 w-4" /> Community home
          </Link>
          <Link
            href="/questions"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Compass className="h-4 w-4" /> Browse Q&amp;A
          </Link>
        </div>
      </div>
    </div>
  );
}
