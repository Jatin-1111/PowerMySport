// @vitest-environment jsdom
import type { ChildSharePublicView } from "@powermysport/shared-types";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharedProfile } from "./SharedProfile";

const NOTICE =
  "Entries are provided by the family unless marked as from a federation source. PowerMySport does not verify them.";

const view = (over: Partial<ChildSharePublicView> = {}): ChildSharePublicView => ({
  child: {
    name: "Anaya",
    sport: "Tennis",
    level: "competitive",
    sinceYear: 2021,
    state: "Maharashtra",
    classYear: 2029,
  },
  stats: { yearsInSport: 5, tournaments: 3, awards: 1 },
  academics: { board: "CBSE", school: "City School", intendedField: "Engineering" },
  timeline: [
    {
      kind: "tournament_result",
      section: "results",
      title: "Pune Open",
      resultLabel: "Quarter final",
      occurredOn: "2026-03-01T00:00:00.000Z",
      datePrecision: "month",
      resultUrl: "https://example.org/draw",
      source: "parent_with_link",
    },
    {
      kind: "ranking",
      section: "ranking",
      title: "Ranked 150 in U14 Girls",
      occurredOn: "2026-10-20T00:00:00.000Z",
      datePrecision: "day",
      source: "federation",
    },
    {
      kind: "test_score",
      section: "academics",
      title: "SAT",
      resultLabel: "1380",
      occurredOn: "2026-05-01T00:00:00.000Z",
      datePrecision: "month",
      source: "parent",
    },
    {
      kind: "coaching_period",
      section: "coaching",
      title: "Ace Academy",
      occurredOn: "2022-01-01T00:00:00.000Z",
      endedOn: "2024-01-01T00:00:00.000Z",
      datePrecision: "year",
      source: "parent",
    },
  ],
  videos: [{ id: "v1", title: "Final set", durationSeconds: 65, sizeBytes: 42 * 1024 * 1024 }],
  sections: ["results", "ranking", "coaching", "academics", "videos"],
  sharedAt: "2026-11-03T00:00:00.000Z",
  expiresAt: "2026-12-03T00:00:00.000Z",
  notice: NOTICE,
  ...over,
});

afterEach(cleanup);

describe("the header", () => {
  it("names the child, where they play and from, and their class year", () => {
    render(<SharedProfile view={view()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Anaya" })).toBeTruthy();
    expect(
      screen.getByText("Tennis · Competitive · since 2021 · Maharashtra · Class of 2029")
    ).toBeTruthy();
  });

  it("says who shared it and when it ends, and carries the not-verified line", () => {
    render(<SharedProfile view={view()} />);
    expect(
      screen.getByText(/Shared by the family on 3 Nov 2026\. This link expires on 3 Dec 2026\./)
    ).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it("uses a second-level heading in a preview, where the dialog already has the first", () => {
    render(<SharedProfile view={view()} preview />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Anaya" })).toBeTruthy();
  });

  it("shows only what it was sent: no class year, state or tiles that are not in the response", () => {
    render(
      <SharedProfile
        view={view({
          child: {
            name: "Anaya",
            sport: null,
            level: null,
            sinceYear: null,
            state: null,
            classYear: null,
          },
          stats: { yearsInSport: null },
          academics: null,
          timeline: [],
          videos: [],
        })}
      />
    );
    expect(screen.queryByText(/Class of/)).toBeNull();
    expect(screen.queryByText("Years in sport")).toBeNull();
    expect(screen.queryByText("Tournaments")).toBeNull();
    expect(screen.getByText(/Nothing has been added to the sections shared here yet/)).toBeTruthy();
  });
});

describe("the sections", () => {
  it("draws each section that has rows, in reading order, and none that do not", () => {
    render(<SharedProfile view={view()} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Results", "Rankings", "Coaching", "Academics", "Videos"]);
    expect(screen.queryByRole("heading", { name: "Awards" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Fitness" })).toBeNull();
  });

  it("shows the board, school and field under Academics, with the scores", () => {
    render(<SharedProfile view={view()} />);
    const academics = screen.getByRole("region", { name: "Academics" });
    expect(within(academics).getByText("CBSE")).toBeTruthy();
    expect(within(academics).getByText("City School")).toBeTruthy();
    expect(within(academics).getByText("Engineering")).toBeTruthy();
    expect(within(academics).getByText(/SAT/)).toBeTruthy();
  });

  it("says where every row came from, naming the ranking list", () => {
    render(<SharedProfile view={view()} />);
    expect(screen.getByText("Parent record, link provided")).toBeTruthy();
    expect(screen.getByText("From the AITA ranking list")).toBeTruthy();
    expect(screen.getAllByText("Parent record").length).toBe(2);
  });

  it("shows a coaching spell as a range and a date to the precision it was given", () => {
    render(<SharedProfile view={view()} />);
    expect(screen.getByText("Mar 2026")).toBeTruthy();
    expect(screen.getByText(/2022/)).toBeTruthy();
    expect(screen.getByText(/2024/)).toBeTruthy();
  });

  it("opens a result link in a new tab without passing the page on", () => {
    render(<SharedProfile view={view()} />);
    const link = screen.getByRole("link", { name: /result page/i });
    expect(link.getAttribute("href")).toBe("https://example.org/draw");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("shows the tiles for the numbers it has", () => {
    render(<SharedProfile view={view()} />);
    expect(screen.getByText("Years in sport")).toBeTruthy();
    expect(screen.getByText("Tournaments")).toBeTruthy();
    expect(screen.getByText("Awards")).toBeTruthy();
  });
});

describe("the videos", () => {
  it("lists a clip with its length and size but loads nothing until Play is pressed", () => {
    const play = vi.fn();
    render(<SharedProfile view={view()} play={play} />);
    expect(screen.getByText("Final set")).toBeTruthy();
    expect(screen.getByText("1:05 · 42 MB")).toBeTruthy();
    expect(document.querySelector("video")).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("asks for a link when Play is pressed, then shows the player and a way to open the clip", async () => {
    const play = vi.fn().mockResolvedValue({ url: "https://storage.example/p?sig=1" });
    render(<SharedProfile view={view()} play={play} />);
    fireEvent.click(screen.getByRole("button", { name: "Play Final set" }));

    await waitFor(() => expect(document.querySelector("video")).toBeTruthy());
    expect(play).toHaveBeenCalledWith("v1");
    expect(document.querySelector("video")!.getAttribute("src")).toBe(
      "https://storage.example/p?sig=1"
    );
    const open = screen.getByRole("link", { name: /open or save the clip/i });
    expect(open.getAttribute("href")).toBe("https://storage.example/p?sig=1");
    expect(open.getAttribute("rel")).toContain("noopener");
  });

  it("says so, and lets the reader try again, when the clip cannot be loaded", async () => {
    const play = vi
      .fn()
      .mockRejectedValueOnce(new Error("410"))
      .mockResolvedValue({ url: "https://s/p" });
    render(<SharedProfile view={view()} play={play} />);
    fireEvent.click(screen.getByRole("button", { name: "Play Final set" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be played/);
    fireEvent.click(screen.getByRole("button", { name: "Play Final set" }));
    await waitFor(() => expect(document.querySelector("video")).toBeTruthy());
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("plays nothing in a preview, and says the clip plays on the link", () => {
    render(<SharedProfile view={view()} preview />);
    expect(screen.queryByRole("button", { name: /Play/ })).toBeNull();
    expect(screen.getByText("Plays on the link")).toBeTruthy();
  });
});
