import {
  CHILD_SHARE_NOTICE,
  type ChildHistoryView,
  type ChildShareSection,
  type ChildSharePublicRow,
  type ChildSharePublicView,
} from "@powermysport/shared-types";

/**
 * A child's profile as a person holding a share link sees it: the one place that decides which
 * stored facts leave the server for a stranger.
 *
 * It starts from the parent's own view of the child and keeps only what is listed here, for the
 * sections the parent ticked. Nothing is passed through whole: every field is named. A test fails
 * when a field appears in the output that is not in these lists, and another plants private
 * values in the data (date of birth, phone, quiz answers, registration number, storage key) and
 * fails if any of them is found anywhere in the output.
 *
 * This is the public view only. The parent's view (`serializeChildForParent`) and what an expert
 * sees are separate on purpose and are never built from this.
 */

/** Every field a shared row may carry, and every field the response may carry at each level. */
export const SHARE_ROW_FIELDS = [
  "kind",
  "section",
  "title",
  "detail",
  "resultLabel",
  "occurredOn",
  "datePrecision",
  "endedOn",
  "resultUrl",
  "source",
] as const;

export const SHARE_VIEW_FIELDS = [
  "child",
  "stats",
  "academics",
  "timeline",
  "videos",
  "sections",
  "sharedAt",
  "expiresAt",
  "notice",
] as const;

export const SHARE_CHILD_FIELDS = [
  "name",
  "sport",
  "level",
  "sinceYear",
  "state",
  "classYear",
] as const;

export const SHARE_ACADEMIC_FIELDS = ["board", "school", "intendedField"] as const;
export const SHARE_VIDEO_FIELDS = ["id", "title", "durationSeconds", "sizeBytes"] as const;
export const SHARE_STAT_FIELDS = ["yearsInSport", "tournaments", "awards"] as const;

export interface ShareSelection {
  sections: ChildShareSection[];
  /** The clips the parent ticked. A clip not listed here is never shown by this link. */
  videoIds: string[];
  sharedAt: Date;
  expiresAt: Date;
}

const toRow = (row: ChildHistoryView["timeline"][number]): ChildSharePublicRow => ({
  kind: row.kind,
  section: row.section,
  title: row.title,
  ...(row.detail ? { detail: row.detail } : {}),
  ...(row.resultLabel ? { resultLabel: row.resultLabel } : {}),
  occurredOn: row.occurredOn,
  datePrecision: row.datePrecision,
  ...(row.endedOn ? { endedOn: row.endedOn } : {}),
  ...(row.resultUrl ? { resultUrl: row.resultUrl } : {}),
  source: row.source,
});

export const serializeChildForShare = (
  view: ChildHistoryView,
  selection: ShareSelection,
  /** The child's state, kept separate because the parent's page view does not carry it. */
  state: string | null
): ChildSharePublicView => {
  const shared = new Set(selection.sections);
  const withAcademics = shared.has("academics");
  const academics = withAcademics ? view.academics : null;

  const videoIds = new Set(selection.videoIds);
  const videos = shared.has("videos")
    ? view.videos
        .filter((video) => video.status === "ready" && videoIds.has(video.id))
        .map((video) => ({
          id: video.id,
          ...(video.title ? { title: video.title } : {}),
          ...(video.durationSeconds !== undefined
            ? { durationSeconds: video.durationSeconds }
            : {}),
          ...(video.sizeBytes ? { sizeBytes: video.sizeBytes } : {}),
        }))
    : [];

  return {
    child: {
      name: view.child.name,
      sport: view.child.sport,
      level: view.child.level,
      sinceYear: view.child.sinceYear,
      state,
      classYear: withAcademics ? (view.academics?.graduationYear ?? null) : null,
    },
    // A figure is shown only with the section it counts: tournaments with Results, awards with
    // Awards. Otherwise unticking a section would still tell the reader how much was in it.
    stats: {
      yearsInSport: view.stats.yearsInSport,
      ...(shared.has("results") ? { tournaments: view.stats.tournaments } : {}),
      ...(shared.has("awards") ? { awards: view.stats.awards } : {}),
    },
    academics: academics
      ? {
          ...(academics.board ? { board: academics.board } : {}),
          ...(academics.school ? { school: academics.school } : {}),
          ...(academics.intendedField ? { intendedField: academics.intendedField } : {}),
        }
      : null,
    timeline: view.timeline.filter((row) => shared.has(row.section)).map(toRow),
    videos,
    sections: selection.sections,
    sharedAt: selection.sharedAt.toISOString(),
    expiresAt: selection.expiresAt.toISOString(),
    notice: CHILD_SHARE_NOTICE,
  };
};
