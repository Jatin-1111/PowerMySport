import Link from "next/link";
import { Home } from "lucide-react";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center text-white shadow-lg sm:p-10">
        <div className="bg-power-orange/20 pointer-events-none absolute -top-12 -right-16 h-40 w-40 rounded-full blur-3xl" />
        <p className="text-power-orange relative text-xs font-semibold tracking-[0.2em] uppercase">
          Error 404
        </p>
        <h1 className="relative mt-3 text-6xl font-bold">404</h1>
        <h2 className="relative mt-2 text-xl font-semibold">Page not found</h2>
        <p className="relative mt-2 text-sm text-slate-300">
          The admin page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="relative mt-6 flex justify-center">
          <Link
            href="/admin"
            className="bg-power-orange inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Home className="h-4 w-4" /> Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
