"use client";

import Link from "next/link";
import { Calendar, Clock, FileText, MapPin } from "lucide-react";
import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import {
  CAL_TZ,
  formatLocation,
  formatShortEndDate,
  isMultiDayEdition,
  levelColor,
} from "./editionUtils";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { editionShortLabel } from "./seriesGroups";

/**
 * One tournament edition.
 *
 * The `inSeries` variant is for rows nested under a series accordion on a
 * date-scoped panel, where three things on the full row are pure repetition:
 * the date (the panel header already names it, so it appeared nine times over),
 * the organiser + series code (the group heading already says "Championship
 * Series", so every row read "AITA CS7 (…)"), and the location (which is the
 * only differing part, so it becomes the row's title instead of a second line).
 */
export function EditionRow({
  edition: e,
  showDate = false,
  inSeries = false,
  highlightAgeGroup,
  savedInCalendar = false,
  onSavedToCalendar,
}: {
  edition: TournamentEdition;
  showDate?: boolean;
  inSeries?: boolean;
  /** Renders this age group in the accent colour — the one the parent asked for. */
  highlightAgeGroup?: string | undefined;
  savedInCalendar?: boolean;
  onSavedToCalendar?: (key: string) => void;
}) {
  const lc = e.level ? levelColor(e.level) : null;
  const location = formatLocation(e.venue, e.city);
  const multiDay = isMultiDayEdition(e);

  const title = inSeries ? editionShortLabel(e.name) : e.name;
  // Only show the location line when it adds something the title doesn't.
  const showLocation = !!location && location.toLowerCase() !== title.toLowerCase();

  const hasMeta =
    showDate || showLocation || multiDay || !!e.registrationDeadlineDate || !!e.ageGroups?.length;

  return (
    // `group` + `relative` carry the stretched link below: the title's ::after
    // covers the whole row, so anywhere on it opens the tournament while the
    // markup stays a single real <a> — middle-click, "open in new tab" and
    // crawlers all keep working, which an onClick handler would break.
    <div className="group relative -mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-2 transition first:pt-0 last:pb-0 hover:bg-white">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Editions approved before the detail page existed carry no slug, so
              they stay plain text rather than linking to a 404. */}
          {e.slug ? (
            <Link
              href={`/tournaments/${e.slug}`}
              className="group-hover:text-power-orange text-sm font-semibold leading-snug text-slate-800 transition after:absolute after:inset-0 after:content-['']"
            >
              {title}
            </Link>
          ) : (
            <span className="text-sm font-semibold leading-snug text-slate-800">{title}</span>
          )}
          {e.documents?.some((d) => d.kind === "factSheet") && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
              <FileText className="h-2.5 w-2.5" />
              Fact sheet
            </span>
          )}
          {lc && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${lc.pill}`}
            >
              <span className={`h-1 w-1 rounded-full ${lc.dot}`} />
              {e.level}
            </span>
          )}
          {e.ageGroups?.map((ag) => (
            <span
              key={ag}
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                highlightAgeGroup && ag === highlightAgeGroup
                  ? "text-power-orange bg-orange-100"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {ag}
            </span>
          ))}
        </div>
        {hasMeta && (showDate || showLocation || multiDay || e.registrationDeadlineDate) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            {showDate && (
              <span className="flex items-center gap-1 font-semibold text-slate-500">
                <Calendar className="h-3 w-3 shrink-0" />
                {new Date(e.startDate).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: CAL_TZ,
                })}
                {multiDay && ` – ${formatShortEndDate(e.endDate!, e.startDate)}`}
              </span>
            )}
            {showLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {location}
              </span>
            )}
            {!showDate && multiDay && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                until {formatShortEndDate(e.endDate!, e.startDate)}
              </span>
            )}
            {e.registrationDeadlineDate && (
              <span className="flex items-center gap-1 font-semibold text-amber-600">
                <Clock className="h-3 w-3 shrink-0" />
                Reg. by{" "}
                {new Date(e.registrationDeadlineDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  timeZone: CAL_TZ,
                })}
              </span>
            )}
          </div>
        )}
      </div>
      {/* Replaces the old "view official source" icon. That link still exists,
          on the tournament page this row now opens — but from a calendar the
          useful action is keeping the date, not leaving for the federation. */}
      <AddToCalendarButton
        edition={e}
        saved={savedInCalendar}
        {...(onSavedToCalendar ? { onSaved: onSavedToCalendar } : {})}
      />
    </div>
  );
}
