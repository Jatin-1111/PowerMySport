// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlipBoard } from "../src/modules/tournaments/components/FlipBoard";
import type { TournamentEdition } from "../src/modules/pathway/services/pathway";

const edition = (overrides: Partial<TournamentEdition>): TournamentEdition => ({
  sportSlug: "tennis",
  name: "AITA CS7 (Amritsar)",
  slug: "aita-cs7-amritsar-2026-10-05",
  editionYear: 2026,
  startDate: "2026-10-05T00:00:00.000Z",
  ageGroups: ["Under-16"],
  sourceUrl: "https://example.test",
  status: "announced",
  lastCheckedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

/** The wide board's rows as text (the narrow one is rendered too, hidden by CSS). */
const wideRows = (container: HTMLElement) => {
  const boards = container.querySelectorAll(".\\@container");
  return [...boards[1].querySelectorAll("li")].map((li) => li.textContent ?? "");
};

beforeEach(() => setReducedMotion(true));
afterEach(() => vi.useRealTimers());

describe("FlipBoard", () => {
  it("renders nothing when there is nothing upcoming", () => {
    const { container } = render(<FlipBoard editions={[]} title="Next up in tennis" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lays a row out as date, event and age", () => {
    const { container } = render(<FlipBoard editions={[edition({})]} title="Next up" />);
    expect(wideRows(container)[0]).toBe("05 OCT AITA CS7 AMRITSAR      U16   ");
  });

  it("drops whole words before the city when a name is too long", () => {
    const { container } = render(
      <FlipBoard
        editions={[
          edition({
            name: "National Tennis Championship (Delhi)",
            ageGroups: ["Under-16", "Men", "Women"],
          }),
        ]}
        title="Next up"
      />
    );
    expect(wideRows(container)[0]).toBe("05 OCT NATIONAL TENNIS DELHI  U16 +2");
  });

  it("links each row to its tournament with a spoken label", () => {
    render(<FlipBoard editions={[edition({})]} title="Next up" />);
    const links = screen.getAllByRole("link", { name: "AITA CS7 (Amritsar), 5 October, Under-16" });
    expect(links[0]).toHaveAttribute("href", "/tournaments/aita-cs7-amritsar-2026-10-05");
  });

  it("does not flip under reduced motion", () => {
    vi.useFakeTimers();
    const { container } = render(<FlipBoard editions={[edition({})]} title="Next up" />);
    const before = wideRows(container)[0];
    act(() => vi.advanceTimersByTime(200));
    expect(wideRows(container)[0]).toBe(before);
  });

  it("flips once and settles on the real text", () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(<FlipBoard editions={[edition({})]} title="Next up" />);
    const settled = wideRows(container)[0];

    act(() => vi.advanceTimersByTime(90));
    expect(wideRows(container)[0]).not.toBe(settled);

    act(() => vi.advanceTimersByTime(5000));
    expect(wideRows(container)[0]).toBe(settled);
  });
});
