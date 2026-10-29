import type { ChildHistoryView, ChildTimelineRow } from "@powermysport/shared-types";
import { describe, expect, it } from "vitest";

import { choiceFrom, offeredSections, readyVideos, whatsappShareUrl } from "./shareChoices";

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
