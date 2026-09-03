import { Compass, Home } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-white via-orange-50/40 to-white px-6 py-20 text-center">
      {/* soft brand glows */}
      <div className="bg-power-orange/10 pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-turf-green/10 pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl" />

      <p className="text-power-orange relative mb-2 text-sm font-semibold uppercase tracking-[0.2em]">
        Error 404
      </p>
      <h1 className="font-title text-deep-slate relative text-7xl font-extrabold leading-none sm:text-8xl">
        404
      </h1>
      <h2 className="font-title relative mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
        This page has left the field
      </h2>
      <p className="relative mt-3 max-w-md text-base text-slate-600">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved. Let&apos;s get
        you back in the game.
      </p>

      <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="bg-power-orange inline-flex items-center justify-center gap-2 rounded-lg px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-600"
        >
          <Home className="h-5 w-5" /> Back to home
        </Link>
        <Link
          href="/booking"
          className="border-power-orange text-power-orange hover:bg-power-orange inline-flex items-center justify-center gap-2 rounded-lg border-2 px-8 py-3 text-base font-semibold transition-colors hover:text-white"
        >
          <Compass className="h-5 w-5" /> Explore venues &amp; coaches
        </Link>
      </div>
    </main>
  );
}
