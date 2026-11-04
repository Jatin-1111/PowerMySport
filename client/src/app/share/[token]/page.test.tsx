// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ fetchSharedProfile: vi.fn() }));
vi.mock("@/modules/my-child/services/sharedProfile", () => service);
vi.mock("@/modules/my-child/components/PublicSharedProfile", () => ({
  PublicSharedProfile: ({ view, token }: { view: { child: { name: string } }; token: string }) => (
    <p>
      profile for {view.child.name} with {token}
    </p>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import SharedProfilePage, { dynamic, metadata } from "./page";

const TOKEN = "t".repeat(43);
const render_ = async (token = TOKEN) =>
  render(await SharedProfilePage({ params: Promise.resolve({ token }) }));

beforeEach(() => service.fetchSharedProfile.mockReset());
afterEach(cleanup);

describe("the public share page", () => {
  it("is never cached, never indexed, and does not pass its address on", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("does not put the child's name in the page title, which browsers keep in history", () => {
    expect(String(metadata.title)).toBe("Sporting profile");
    expect(JSON.stringify(metadata)).not.toMatch(/Anaya/);
  });

  it("does not look the profile up in its metadata, which would count the link as opened twice", () => {
    expect(
      typeof (SharedProfilePage as unknown as { generateMetadata?: unknown }).generateMetadata
    ).toBe("undefined");
  });

  it("asks the server for the profile named by the link, once", async () => {
    service.fetchSharedProfile.mockResolvedValue({
      kind: "ok",
      view: { child: { name: "Anaya" } },
    });
    await render_();
    expect(service.fetchSharedProfile).toHaveBeenCalledTimes(1);
    expect(service.fetchSharedProfile).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText(`profile for Anaya with ${TOKEN}`)).toBeTruthy();
  });

  it("is a plain not-found for a link that was never issued", async () => {
    service.fetchSharedProfile.mockResolvedValue({ kind: "missing" });
    await expect(render_()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("tells the holder of a link that is over to ask the family for a new one", async () => {
    service.fetchSharedProfile.mockResolvedValue({ kind: "gone" });
    await render_();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "This link is no longer active"
    );
    expect(screen.getByText("Ask the family for a new one.")).toBeTruthy();
    expect(screen.queryByText(/profile for/)).toBeNull();
  });

  it("says to try again when the page could not be loaded", async () => {
    service.fetchSharedProfile.mockResolvedValue({ kind: "unavailable" });
    await render_();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "This page could not be loaded"
    );
    expect(screen.getByText("Try again in a minute.")).toBeTruthy();
  });
});
