import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchPathwayGuide, redirect, notFound } = vi.hoisted(() => ({
  fetchPathwayGuide: vi.fn(),
  // Next's own redirect and notFound work by throwing; do the same, so the page stops there.
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/modules/pathway/services/fetchGuide", () => ({ fetchPathwayGuide }));

import SportPathwayPage from "./page";

const render = (sport: string) =>
  SportPathwayPage({
    params: Promise.resolve({ sport }),
    searchParams: Promise.resolve({ stage: "start" }),
  });

beforeEach(() => {
  fetchPathwayGuide.mockReset().mockResolvedValue(null);
  redirect.mockClear();
  notFound.mockClear();
});

// The dashboard, quiz results and guidance link to every sport in the registry, but only some
// have a published pathway. Following a link to one without used to show a not-found screen.
describe("/roadmap/[sport] for a sport with no published pathway", () => {
  it("sends a listed sport to the roadmap picker", async () => {
    await expect(render("cricket")).rejects.toThrow("NEXT_REDIRECT:/roadmap");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("also redirects a listed sport whose pathway has no stages yet", async () => {
    fetchPathwayGuide.mockResolvedValue({ sportSlug: "badminton", stages: [] });

    await expect(render("badminton")).rejects.toThrow("NEXT_REDIRECT:/roadmap");
  });

  it("redirects every sport the registry lists, not just one", async () => {
    for (const slug of ["football", "table-tennis", "swimming", "volleyball", "hockey"]) {
      await expect(render(slug)).rejects.toThrow("NEXT_REDIRECT:/roadmap");
    }
  });

  it("still gives a slug that is not a sport at all a 404", async () => {
    await expect(render("kabaddi-xyz")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("/roadmap/[sport] for a published pathway", () => {
  it("renders the page and does not redirect", async () => {
    fetchPathwayGuide.mockResolvedValue({
      sportSlug: "tennis",
      sportName: "Tennis",
      intro: { description: "x" },
      sportIntro: ["A first paragraph."],
      stages: [{ slug: "discover-tennis" }],
      updatedAt: undefined,
    });

    await expect(render("tennis")).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });
});
