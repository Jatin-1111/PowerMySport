import type { ChildHistoryView, ChildTimelineRow } from "@powermysport/shared-types";
import { describe, expect, it } from "vitest";

import {
  choiceFrom,
  eligiblePhotos,
  offeredSections,
  photoEntries,
  readyVideos,
  whatsappShareUrl,
} from "./shareChoices";

const row = (section: ChildTimelineRow["section"]): ChildTimelineRow => ({
  id: section,
  origin: "stored",
  kind: "award",
  section,
  title: section,
  occurredOn: "2026-01-01T00:00:00.000Z",
  datePrecision: "month",
  source: "parent",
  editable: true,
  canAddResult: false,
});

const history = (over: Partial<ChildHistoryView> = {}) =>
  ({ timeline: [], academics: null, videos: [], ...over }) as Pick<
    ChildHistoryView,
    "timeline" | "academics" | "videos"
  >;

describe("which sections can be ticked", () => {
  it("offers only sections with something in them, in the order a reader meets them", () => {
    const offered = offeredSections(
      history({
        timeline: [row("awards"), row("results"), row("results"), row("academics")],
        academics: { board: "CBSE" },
        videos: [{ id: "v", status: "ready", createdAt: "2026-01-01T00:00:00.000Z" }],
      })
    );
    expect(offered).toEqual([
      { section: "results", count: 2 },
      { section: "awards", count: 1 },
      { section: "academics", count: 2 },
      { section: "videos", count: 1 },
    ]);
  });

  it("offers academics for saved school details even with no results or scores", () => {
    expect(offeredSections(history({ academics: { graduationYear: 2029 } }))).toEqual([
      { section: "academics", count: 1 },
    ]);
  });

  it("offers nothing for a child with nothing recorded", () => {
    expect(offeredSections(history())).toEqual([]);
  });

  it("does not count a clip that is not finished", () => {
    const videos = [
      { id: "a", status: "ready" as const, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", status: "uploading" as const, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(readyVideos({ videos })).toHaveLength(1);
    expect(offeredSections(history({ videos }))).toEqual([{ section: "videos", count: 1 }]);
  });
});

describe("what is sent for the ticks", () => {
  it("keeps the sections in reading order and leaves out what was not ticked", () => {
    expect(choiceFrom(["academics", "results"], [])).toEqual({
      sections: ["results", "academics"],
    });
  });

  it("sends the clips only when the videos section is ticked and at least one clip is", () => {
    expect(choiceFrom(["results", "videos"], ["v1", "v2"])).toEqual({
      sections: ["results", "videos"],
      videoIds: ["v1", "v2"],
    });
    expect(choiceFrom(["results", "videos"], [])).toEqual({ sections: ["results"] });
    expect(choiceFrom(["results"], ["v1"])).toEqual({ sections: ["results"] });
  });

  it("sends nothing when nothing is ticked", () => {
    expect(choiceFrom([], ["v1"])).toEqual({ sections: [] });
  });
});

describe("certificate photos", () => {
  const withPhoto = (id: string, section: ChildTimelineRow["section"]): ChildTimelineRow => ({
    ...row(section),
    id,
    hasPhoto: true,
  });

  it("offers the section only for entries that have a finished photo", () => {
    const offered = offeredSections(
      history({ timeline: [withPhoto("a", "awards"), row("results")] })
    );
    expect(offered).toEqual([
      { section: "results", count: 1 },
      { section: "awards", count: 1 },
      { section: "certificates", count: 1 },
    ]);
    expect(photoEntries(history({ timeline: [row("awards")] }))).toEqual([]);
  });

  it("does not offer a photo that a derived row carries, because only stored entries can", () => {
    const derived: ChildTimelineRow = { ...withPhoto("r", "ranking"), editable: false };
    expect(photoEntries(history({ timeline: [derived] }))).toEqual([]);
  });

  it("offers a photo only when its entry's own section is ticked", () => {
    const photos = [withPhoto("a", "awards"), withPhoto("b", "results")];
    expect(eligiblePhotos(photos, ["awards"]).map((p) => p.id)).toEqual(["a"]);
    expect(eligiblePhotos(photos, [])).toEqual([]);
  });

  it("sends the photos only when certificates is ticked and at least one is chosen", () => {
    const a = withPhoto("a", "awards");
    expect(choiceFrom(["awards", "certificates"], [], [a])).toEqual({
      sections: ["awards", "certificates"],
      photoEventIds: ["a"],
    });
    // Certificates ticked with no photo chosen is a section with nothing in it.
    expect(choiceFrom(["awards", "certificates"], [], [])).toEqual({ sections: ["awards"] });
    // A photo chosen but certificates not ticked is never sent.
    expect(choiceFrom(["awards"], [], [a])).toEqual({ sections: ["awards"] });
  });

  it("drops a photo whose entry's section was unticked after the photo was chosen", () => {
    const a = withPhoto("a", "awards");
    const b = withPhoto("b", "results");
    expect(choiceFrom(["results", "certificates"], [], [a, b])).toEqual({
      sections: ["results", "certificates"],
      photoEventIds: ["b"],
    });
    expect(choiceFrom(["coaching", "certificates"], [], [a, b])).toEqual({
      sections: ["coaching"],
    });
  });
});

describe("the WhatsApp message", () => {
  it("names the child and carries the link, safely encoded", () => {
    const url = whatsappShareUrl("Anaya", "https://powermysport.com/share/abc_DEF-123");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]!);
    expect(text).toBe("Anaya's sporting profile: https://powermysport.com/share/abc_DEF-123");
  });

  it("cannot be bent by a name with characters that mean something in a URL", () => {
    const url = whatsappShareUrl("A&b=c#d", "https://powermysport.com/share/x");
    expect(url.split("?text=")[1]).not.toMatch(/[&#= ]/);
  });
});
