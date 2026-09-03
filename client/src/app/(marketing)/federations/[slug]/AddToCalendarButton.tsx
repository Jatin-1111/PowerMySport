"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { absoluteUrl } from "@/lib/seo";
import { toast } from "@/lib/toast";
import { calendarApi, EVENT_TYPE_COLORS } from "@/modules/booking/services/calendarApi";
import { useAuthStore } from "@/modules/auth/store/authStore";
import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { formatLocation } from "./editionUtils";

/**
 * Saves one tournament date into the player's own calendar — the same
 * UserCalendarEvent list the dashboard renders, written as a COMPETITION so it
 * picks up the trophy icon and colour there rather than looking hand-typed.
 *
 * Replaces the raw "open the federation's site" icon that used to sit on these
 * rows: the source link is still one click away on the tournament page, but the
 * action a parent actually wants from a calendar listing is to keep the date.
 */

/** Title and date together identify an already-saved event — see savedEventKey in the calendar tab. */
export function savedEventKey(title: string, date: string): string {
  return `${title.trim().toLowerCase()}|${new Date(date).toISOString().slice(0, 10)}`;
}

/** Fits UserCalendarEvent.title's 120-char cap without cutting mid-word where avoidable. */
function toEventTitle(edition: TournamentEdition): string {
  const title = edition.name.trim();
  return title.length <= 120 ? title : `${title.slice(0, 117).trimEnd()}...`;
}

/** Context a parent needs when the reminder surfaces weeks later, capped at the model's 500 chars. */
function toEventNotes(edition: TournamentEdition): string | undefined {
  const parts = [
    formatLocation(edition.venue, edition.city),
    edition.ageGroups?.length ? edition.ageGroups.join(", ") : null,
    edition.slug ? absoluteUrl(`/tournaments/${edition.slug}`) : null,
  ].filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join(" · ").slice(0, 500);
}

export function AddToCalendarButton({
  edition,
  saved = false,
  onSaved,
  variant = "icon",
}: {
  edition: TournamentEdition;
  /** Already in the player's calendar — known from the one prefetch the calendar tab does. */
  saved?: boolean;
  onSaved?: (key: string) => void;
  /** "icon" for calendar rows, "full" on light panels, "hero" on the dark tournament header. */
  variant?: "icon" | "full" | "hero";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const isSaved = saved || justSaved;

  const handleClick = async (event: React.MouseEvent) => {
    // These sit inside a row whose whole surface links to the tournament page.
    event.preventDefault();
    event.stopPropagation();

    if (saving || isSaved) return;

    // The federation calendar is public, so plenty of readers are logged out.
    // Bounce through login and bring them back rather than failing on a 401.
    if (!user) {
      // Read location directly rather than via usePathname(), which drops the
      // query string — the calendar lives at ?tab=calendar, so without the
      // search params login would return them to the Overview tab instead.
      const returnTo =
        typeof window === "undefined"
          ? pathname
          : `${window.location.pathname}${window.location.search}`;
      router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }

    setSaving(true);
    try {
      await calendarApi.createEvent({
        title: toEventTitle(edition),
        date: edition.startDate,
        type: "COMPETITION",
        color: EVENT_TYPE_COLORS.COMPETITION,
        ...(toEventNotes(edition) ? { notes: toEventNotes(edition)! } : {}),
      });
      setJustSaved(true);
      onSaved?.(savedEventKey(edition.name, edition.startDate));
      toast.success("Added to your calendar");
    } catch {
      toast.error("Couldn't add this to your calendar. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const label = isSaved ? "In your calendar" : "Add to your calendar";

  if (variant === "full" || variant === "hero") {
    const onDark = variant === "hero";
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={saving || isSaved}
        aria-label={label}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
          isSaved
            ? onDark
              ? "cursor-default border-emerald-400/25 bg-emerald-400/[0.1] text-emerald-400"
              : "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
            : onDark
              ? "border-white/[0.15] bg-white/[0.07] text-white hover:bg-white/[0.14]"
              : "hover:border-power-orange hover:text-power-orange border-slate-200 text-slate-700"
        }`}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSaved ? (
          <Check className="h-4 w-4" />
        ) : (
          <CalendarPlus className="h-4 w-4" />
        )}
        {isSaved ? "In your calendar" : "Add to calendar"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving || isSaved}
      title={label}
      aria-label={label}
      className={`relative z-10 mt-0.5 shrink-0 rounded-lg p-1 transition ${
        isSaved
          ? "cursor-default text-emerald-600"
          : "hover:text-power-orange text-slate-300 hover:bg-white"
      }`}
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSaved ? (
        <Check className="h-4 w-4" />
      ) : (
        <CalendarPlus className="h-4 w-4" />
      )}
    </button>
  );
}
