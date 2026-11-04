"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText, PenLine } from "lucide-react";
import { Card } from "@/modules/shared/ui/Card";
import { getCommunityAppUrl } from "@/lib/community/url";
import {
  experiencesApi,
  type ExperienceSubjectKind,
  type ExperienceSubjectSummary,
} from "@/modules/community/services/experiences";

const SIGNAL_LABELS: Record<string, string> = {
  organisation: "Organisation",
  facilities: "Facilities",
  officiating: "Officiating",
  valueForMoney: "Value for money",
  travelAndStay: "Travel & stay",
  cleanliness: "Cleanliness",
  staff: "Staff",
  coachingQuality: "Coaching quality",
  communication: "Communication",
  punctuality: "Punctuality",
};

interface ParentExperiencesBandProps {
  kind: ExperienceSubjectKind;
  refId: string;
  /** Used for the composer deep-link's subject snapshot and the empty state. */
  name: string;
  slug?: string | null;
}

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * "Parent experiences" — sits below this page's existing star-rating band
 * (client/models/Review.ts), which stays exactly as it is; this is the
 * narrative complement to that number, not a replacement for it. Same
 * component across tournament, venue, academy, coach, and expert pages.
 */
export default function ParentExperiencesBand({
  kind,
  refId,
  name,
  slug,
}: ParentExperiencesBandProps) {
  const [summary, setSummary] = useState<ExperienceSubjectSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // No setIsLoading(true) here: the initial state is already true, and
    // kind/refId are set once per mount for this component, so there is no
    // second fetch mid-lifetime that would need to re-show the loading state.
    experiencesApi
      .getSubjectSummary(kind, refId)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, refId]);

  const shareUrl = getCommunityAppUrl({
    path: "experiences/new",
    searchParams: {
      subjectKind: kind,
      subjectRefId: refId,
      subjectName: name,
      subjectSlug: slug || undefined,
    },
  });

  const signalEntries = Object.entries(summary?.signals || {}).filter(
    ([, tally]) => tally && tally.good + tally.okay + tally.poor > 0
  );

  return (
    <Card className="rounded-3xl border border-slate-200/70 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-power-orange flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
            <MessageSquareText size={17} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Parent experiences</h3>
            {!isLoading && summary && summary.count > 0 ? (
              <p className="text-xs text-slate-500">
                {summary.count} {summary.count === 1 ? "parent has" : "parents have"} shared their
                experience
              </p>
            ) : null}
          </div>
        </div>
        <Link
          href={shareUrl}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <PenLine size={13} />
          Share an experience
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 h-16 animate-pulse rounded-2xl bg-slate-100" />
      ) : !summary || summary.count === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Be the first parent to share an experience about {name}.
        </p>
      ) : (
        <>
          {signalEntries.length > 0 ? (
            <div className="mt-4 space-y-1.5">
              {signalEntries.map(([key, tally]) => {
                const total = tally!.good + tally!.okay + tally!.poor;
                return (
                  <p key={key} className="text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{tally!.good}</span> of {total}{" "}
                    said <span className="font-medium">{SIGNAL_LABELS[key] || key}</span> was good
                  </p>
                );
              })}
            </div>
          ) : null}

          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {summary.recent.map((experience) => (
              <div key={experience.id}>
                <p className="text-sm text-slate-700">
                  {experience.excerpt || "Read the full experience on the community."}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {experience.authorName ? `${experience.authorName} · ` : ""}
                  {formatDate(experience.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
