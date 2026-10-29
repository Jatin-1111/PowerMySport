// @vitest-environment jsdom
import type { ChildHistoryView, ChildTimelineRow } from "@powermysport/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  addEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  saveAcademics: vi.fn(),
  listShares: vi.fn(),
}));

vi.mock("@/modules/my-child/services/childHistory", () => ({ childHistoryApi: api }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAuthStore } from "@/modules/auth/store/authStore";
import { MyChildSection } from "./MyChildSection";

const row = (over: Partial<ChildTimelineRow>): ChildTimelineRow => ({
  id: "e1",
  origin: "stored",
  kind: "tournament_result",
  section: "results",
  title: "Pune Open",
  occurredOn: "2026-03-01T00:00:00.000Z",
  datePrecision: "month",
  source: "parent",
  editable: true,
  canAddResult: false,
  ...over,
});

const view = (over: Partial<ChildHistoryView> = {}): ChildHistoryView => ({
  child: { id: "c1", name: "Anaya", sport: "Tennis", level: "competitive", sinceYear: 2021 },
  stats: { yearsInSport: 5, tournaments: 1, awards: 0 },
  academics: null,
  timeline: [row({ resultLabel: "Quarter final" })],
  videos: [],
  videoConsent: false,
  usage: { events: 1, limit: 300 },
  ...over,
});

const renderSection = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MyChildSection childId="c1" />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  useAuthStore.setState({ hydrated: true, token: "t" });
  for (const fn of Object.values(api)) fn.mockReset();
  api.get.mockResolvedValue(view());
  api.addEntry.mockResolvedValue(row({}));
  api.updateEntry.mockResolvedValue(row({}));
  api.deleteEntry.mockResolvedValue(undefined);
  api.saveAcademics.mockResolvedValue(undefined);
  api.listShares.mockResolvedValue([]);
});

afterEach(cleanup);

const loaded = async () => {
  renderSection();
  await screen.findByRole("heading", { name: "My Child" });
  await screen.findByText("Pune Open");
};

describe("the My Child section", () => {
  it("shows the heading line, the tiles with real numbers, and the timeline", async () => {
    await loaded();
    expect(screen.getByText("Tennis · Competitive · since 2021")).toBeTruthy();
    expect(screen.getByText("Years in sport")).toBeTruthy();
    expect(screen.getByText("Tournaments")).toBeTruthy();
    expect(screen.queryByText("Awards")).toBeNull();
    expect(screen.getByText("Mar 2026")).toBeTruthy();
    expect(screen.getByText(/Quarter final/)).toBeTruthy();
  });

  it("says where each row came from", async () => {
    api.get.mockResolvedValue(
      view({
        timeline: [
          row({ id: "a", title: "From the family" }),
          row({
            id: "b",
            title: "With a link",
            source: "parent_with_link",
            resultUrl: "https://example.org/draw",
          }),
          row({
            id: "c",
            origin: "ranking",
            kind: "ranking",
            section: "ranking",
            title: "Ranked 150 in U14 Girls",
            source: "federation",
            editable: false,
          }),
        ],
      })
    );
    renderSection();
    await screen.findByText("Ranked 150 in U14 Girls");
    expect(screen.getByText("Parent record")).toBeTruthy();
    expect(screen.getByText("Parent record, link provided")).toBeTruthy();
    expect(screen.getByText("From the AITA ranking list")).toBeTruthy();
  });

  it("opens a result link in a new tab without passing the page on", async () => {
    api.get.mockResolvedValue(
      view({
        timeline: [row({ resultUrl: "https://example.org/draw", source: "parent_with_link" })],
      })
    );
    await loaded();
    const link = screen.getByRole("link", { name: /result page/i });
    expect(link.getAttribute("href")).toBe("https://example.org/draw");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("shows an empty state and no tiles for a child with nothing recorded", async () => {
    api.get.mockResolvedValue(
      view({
        timeline: [],
        stats: { yearsInSport: null, tournaments: 0, awards: 0 },
        usage: { events: 0, limit: 300 },
      })
    );
    renderSection();
    await screen.findByText("No results yet");
    expect(screen.queryByText("Years in sport")).toBeNull();
    expect(screen.queryByText("Tournaments")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows a loading state, then an error with a way to retry", async () => {
    api.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(view());
    renderSection();
    expect(screen.getByLabelText("Loading the journey")).toBeTruthy();
    await screen.findByText("The journey could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Pune Open");
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("filters the timeline by section", async () => {
    api.get.mockResolvedValue(
      view({
        timeline: [
          row({ id: "a", title: "Pune Open" }),
          row({ id: "b", kind: "award", section: "awards", title: "Club champion" }),
        ],
      })
    );
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: /^Awards/ }));
    expect(screen.queryByText("Pune Open")).toBeNull();
    expect(screen.getByText("Club champion")).toBeTruthy();
  });

  // Found walking the page at 375px: six sections in the filter row counted towards the page's
  // width and pushed a phone out to 635px. jsdom has no layout, so this pins the two classes that
  // stop the row contributing its width; the measured result is in the S8 notes.
  it("keeps the filter row from widening the page on a phone", async () => {
    api.get.mockResolvedValue(
      view({
        timeline: [
          row({ id: "a", title: "Pune Open" }),
          row({ id: "b", kind: "award", section: "awards", title: "Club champion" }),
        ],
      })
    );
    await loaded();
    const filter = screen.getByRole("group", { name: "Show" });
    expect(filter.className).toContain("w-0");
    expect(filter.className).toContain("min-w-full");
    expect(filter.className).toContain("overflow-x-auto");
  });
});

describe("adding and changing entries", () => {
  it("adds an entry from the form, sending a month as its first day", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Mumbai Cup" } });
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: "2026-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(api.addEntry).toHaveBeenCalledTimes(1));
    expect(api.addEntry).toHaveBeenCalledWith("c1", {
      kind: "tournament_result",
      title: "Mumbai Cup",
      date: "2026-05-01",
      datePrecision: "month",
    });
  });

  it("refuses a missing title or date and keeps what was typed", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Add entry" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/title/i);

    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Mumbai Cup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add entry" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/date/i);
    expect((within(dialog).getByLabelText("Title") as HTMLInputElement).value).toBe("Mumbai Cup");
    expect(api.addEntry).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with the input when the server refuses", async () => {
    api.addEntry.mockRejectedValue(new Error("refused"));
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Mumbai Cup" } });
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: "2026-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(api.addEntry).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((within(dialog).getByLabelText("Title") as HTMLInputElement).value).toBe("Mumbai Cup");
  });

  it("offers Add result on a tournament marked played, and ties the result to it", async () => {
    api.get.mockResolvedValue(
      view({
        timeline: [
          row({
            id: "planner:pune-open-2026",
            origin: "planner",
            title: "Pune Open",
            occurredOn: "2026-03-10T00:00:00.000Z",
            datePrecision: "day",
            editionSlug: "pune-open-2026",
            editable: false,
            canAddResult: true,
          }),
        ],
      })
    );
    await loaded();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add result" }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText("Title") as HTMLInputElement).value).toBe("Pune Open");
    expect((within(dialog).getByLabelText("Date") as HTMLInputElement).value).toBe("2026-03-10");

    fireEvent.change(within(dialog).getByLabelText(/^Result/), {
      target: { value: "Semi final" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(api.addEntry).toHaveBeenCalledTimes(1));
    expect(api.addEntry).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        kind: "tournament_result",
        editionSlug: "pune-open-2026",
        resultLabel: "Semi final",
        date: "2026-03-10",
        datePrecision: "day",
      })
    );
  });

  it("clears a field by sending null when it is emptied on edit", async () => {
    api.get.mockResolvedValue(
      view({ timeline: [row({ resultLabel: "Quarter final", detail: "Lost to the top seed" })] })
    );
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Edit Pune Open" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/^Notes/), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.updateEntry).toHaveBeenCalledTimes(1));
    expect(api.updateEntry).toHaveBeenCalledWith(
      "c1",
      "e1",
      expect.objectContaining({
        detail: null,
        resultLabel: "Quarter final",
        datePrecision: "month",
      })
    );
  });

  it("removes an entry only after a confirmation", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Remove Pune Open" }));
    expect(api.deleteEntry).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith("c1", "e1"));
  });

  it("re-reads the page after a write, so the tiles follow", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Mumbai Cup" } });
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: "2026-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});

describe("academics", () => {
  it("invites the parent to add details when there are none", async () => {
    await loaded();
    expect(screen.getByText(/a university coach looks for these/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add details" })).toBeTruthy();
  });

  it("shows what is saved, and saves a change with cleared fields as null", async () => {
    api.get.mockResolvedValue(
      view({
        academics: { board: "CBSE", graduationYear: 2029, school: "City School" },
      })
    );
    await loaded();
    expect(screen.getByText("Class of 2029")).toBeTruthy();
    expect(screen.getByText("City School")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^School/), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(api.saveAcademics).toHaveBeenCalledTimes(1));
    expect(api.saveAcademics).toHaveBeenCalledWith("c1", {
      board: "CBSE",
      graduationYear: 2029,
      school: null,
      intendedField: null,
    });
  });

  it("adds a school result from the academics card, limited to school kinds", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Add result or score" }));
    const dialog = await screen.findByRole("dialog");
    const kind = within(dialog).getByLabelText("What is it") as HTMLSelectElement;
    const offered = Array.from(kind.options).map((option) => option.textContent);
    expect(offered).toEqual(["School result", "Test score"]);
  });
});
