import type {
  ChildHistoryView,
  ChildShareSection,
  ChildTimelineRow,
  ChildVideoView,
} from "@powermysport/shared-types";

/**
 * What a parent can tick when they make a link: only the sections that have something in them.
 *
 * A tick for an empty section would be a promise of nothing, and would invite the question of why
 * there is nothing. The server drops a section with no content anyway; this keeps the screen from
 * offering it.
 */

/** The order a reader will meet them, which is also the order they are offered. */
export const OFFERED_ORDER: ChildShareSection[] = [
  "results",
  "ranking",
  "awards",
  "coaching",
  "fitness",
  "academics",
  "videos",
  "certificates",
];

export interface OfferedSection {
  section: ChildShareSection;
  count: number;
}

export const readyVideos = (history: Pick<ChildHistoryView, "videos">): ChildVideoView[] =>
  history.videos.filter((video) => video.status === "ready");

/** The entries that carry a finished certificate photo, which are the ones that can be chosen. */
export const photoEntries = (history: Pick<ChildHistoryView, "timeline">): ChildTimelineRow[] =>
  history.timeline.filter((row) => row.editable && row.hasPhoto === true);

export const offeredSections = (
  history: Pick<ChildHistoryView, "timeline" | "academics" | "videos">
): OfferedSection[] => {
  const counts = new Map<ChildShareSection, number>();
  for (const row of history.timeline) counts.set(row.section, (counts.get(row.section) ?? 0) + 1);
  if (history.academics) counts.set("academics", (counts.get("academics") ?? 0) + 1);
  const clips = readyVideos(history).length;
  if (clips > 0) counts.set("videos", clips);
  const photos = photoEntries(history).length;
  if (photos > 0) counts.set("certificates", photos);

  return OFFERED_ORDER.filter((section) => (counts.get(section) ?? 0) > 0).map((section) => ({
    section,
    count: counts.get(section) ?? 0,
  }));
};

/**
 * The photos that can go with the ticks made so far: an entry's photo is offered only when the
 * section its entry belongs to is ticked, because a photo with no entry around it would hang there
 * with nothing to explain it. The server enforces the same rule.
 */
export const eligiblePhotos = (
  photos: ChildTimelineRow[],
  ticked: ChildShareSection[]
): ChildTimelineRow[] => photos.filter((row) => ticked.includes(row.section));

/**
 * What goes to the server for the ticks the parent made. Videos are in only when at least one
 * clip is ticked, and certificates only when at least one eligible photo is ticked, because a
 * section with nothing to show is a section with no content.
 */
export const choiceFrom = (
  ticked: ChildShareSection[],
  tickedVideoIds: string[],
  tickedPhotos: Array<Pick<ChildTimelineRow, "id" | "section">> = []
): { sections: ChildShareSection[]; videoIds?: string[]; photoEventIds?: string[] } => {
  const withVideos = ticked.includes("videos") && tickedVideoIds.length > 0;
  const photoEventIds = ticked.includes("certificates")
    ? tickedPhotos.filter((photo) => ticked.includes(photo.section)).map((photo) => photo.id)
    : [];
  const withPhotos = photoEventIds.length > 0;

  const sections = OFFERED_ORDER.filter(
    (section) =>
      ticked.includes(section) &&
      (section !== "videos" || withVideos) &&
      (section !== "certificates" || withPhotos)
  );
  return {
    sections,
    ...(withVideos ? { videoIds: tickedVideoIds } : {}),
    ...(withPhotos ? { photoEventIds } : {}),
  };
};

/** The message a parent sends with the link. Plain, with the name so the coach knows what it is. */
export const whatsappShareUrl = (childName: string, link: string): string =>
  `https://wa.me/?text=${encodeURIComponent(`${childName}'s sporting profile: ${link}`)}`;
