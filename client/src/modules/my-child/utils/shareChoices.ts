import type {
  ChildHistoryView,
  ChildShareSection,
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
];

export interface OfferedSection {
  section: ChildShareSection;
  count: number;
}

export const readyVideos = (history: Pick<ChildHistoryView, "videos">): ChildVideoView[] =>
  history.videos.filter((video) => video.status === "ready");

export const offeredSections = (
  history: Pick<ChildHistoryView, "timeline" | "academics" | "videos">
): OfferedSection[] => {
  const counts = new Map<ChildShareSection, number>();
  for (const row of history.timeline) counts.set(row.section, (counts.get(row.section) ?? 0) + 1);
  if (history.academics) counts.set("academics", (counts.get("academics") ?? 0) + 1);
  const clips = readyVideos(history).length;
  if (clips > 0) counts.set("videos", clips);

  return OFFERED_ORDER.filter((section) => (counts.get(section) ?? 0) > 0).map((section) => ({
    section,
    count: counts.get(section) ?? 0,
  }));
};

/**
 * What goes to the server for the ticks the parent made. Videos are in only when at least one
 * clip is ticked, because a videos section with nothing to play is a section with no content.
 */
export const choiceFrom = (
  ticked: ChildShareSection[],
  tickedVideoIds: string[]
): { sections: ChildShareSection[]; videoIds?: string[] } => {
  const withVideos = ticked.includes("videos") && tickedVideoIds.length > 0;
  const sections = OFFERED_ORDER.filter(
    (section) => ticked.includes(section) && (section !== "videos" || withVideos)
  );
  return withVideos ? { sections, videoIds: tickedVideoIds } : { sections };
};

/** The message a parent sends with the link. Plain, with the name so the coach knows what it is. */
export const whatsappShareUrl = (childName: string, link: string): string =>
  `https://wa.me/?text=${encodeURIComponent(`${childName}'s sporting profile: ${link}`)}`;
