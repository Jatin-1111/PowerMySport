// Expert-session times are always displayed in the EXPERT's timezone so that
// the client and the expert see the exact same clock time for a booking,
// regardless of each viewer's own browser timezone.

export const EXPERT_TZ_FALLBACK = "Asia/Kolkata";

/** Format an ISO instant in the expert's timezone, e.g. "4 Jul 2026, 3:00 pm". */
export function formatSessionTime(iso?: string | null, tz?: string): string {
  if (!iso) return "";
  const zone = tz || EXPERT_TZ_FALLBACK;
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(iso).toLocaleString("en-IN");
  }
}

/** Short label for the timezone a time is shown in, e.g. "Asia/Kolkata". */
export function tzLabel(tz?: string): string {
  return tz || EXPERT_TZ_FALLBACK;
}

/** ISO instant + timezone → "4 Jul 2026, 3:00 pm (Asia/Kolkata)". */
export function formatSessionTimeWithZone(
  iso?: string | null,
  tz?: string,
): string {
  const t = formatSessionTime(iso, tz);
  return t ? `${t} (${tzLabel(tz)})` : t;
}
