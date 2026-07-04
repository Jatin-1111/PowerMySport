import Link from "next/link";
import { Compass, Home } from "lucide-react";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/90 p-8 text-center shadow-sm backdrop-blur">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-power-orange">
          Error 404
        </p>
        <h1
          className="text-6xl font-extrabold text-slate-900"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          404
        </h1>
        <h2 className="mt-3 text-xl font-bold text-slate-900">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This page doesn&apos;t exist or may have moved. Head back to the
          community.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-power-orange px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Home className="h-4 w-4" /> Community home
          </Link>
          <Link
            href="/q"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Compass className="h-4 w-4" /> Browse Q&amp;A
          </Link>
        </div>
      </div>
    </div>
  );
}
