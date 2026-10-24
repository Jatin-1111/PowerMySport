import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <p className="text-sm font-semibold tabular-nums text-slate-500">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-sm text-slate-600">
          The link may be old, or the page may have moved. Pick up from the dashboard.
        </p>
        <Link
          href="/admin"
          className="bg-deep-slate mt-8 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
