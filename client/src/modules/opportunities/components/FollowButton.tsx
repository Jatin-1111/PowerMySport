"use client";

import { Bell, BellOff } from "lucide-react";
import Link from "next/link";

import { useOpportunityFollow } from "../hooks/useOpportunityFollow";

/**
 * "Tell me when the dates move" on an entry's page.
 *
 * Says what following does, in the button's own words, because "Follow" alone
 * does not tell a parent that an email is the result. A signed-out visitor gets
 * a link to sign in that brings them back here, rather than a button that fails.
 */
export function FollowButton({ slug }: { slug: string }) {
  const { signedIn, hydrated, ready, following, toggle } = useOpportunityFollow(slug);

  // Reserve the space so the card does not jump when the session is read.
  if (!hydrated || !ready) return <div aria-hidden className="mt-4 min-h-11" />;

  if (!signedIn) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        <Link
          href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
          className="font-semibold text-slate-900 underline"
        >
          Sign in
        </Link>{" "}
        to get an email when this window opens or is about to close.
      </p>
    );
  }

  const Icon = following ? BellOff : Bell;
  return (
    <button
      type="button"
      onClick={() => toggle.mutate(!following)}
      disabled={toggle.isPending}
      aria-pressed={following}
      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
    >
      <Icon aria-hidden className="h-4 w-4" />
      {following ? "Stop alerts for this entry" : "Tell me when the dates move"}
    </button>
  );
}
