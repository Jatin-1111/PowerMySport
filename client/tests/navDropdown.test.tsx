// @vitest-environment jsdom
//
// The header dropdowns animate in: the panel drops in and its rows follow one
// by one. The likeliest way for that to go wrong is quiet: a row whose
// animation never starts stays at opacity 0, and the menu opens with a gap in
// it. So this pins the end state, normally and with "reduce motion" on: once
// the animation has run, the panel and every row are fully visible and the
// menu can be used.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Star } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NavDropdownDivider,
  NavDropdownHeading,
  NavDropdownItem,
  NavDropdownPanel,
} from "@/components/layout/NavDropdown";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

afterEach(cleanup);

const menu = (open: boolean, onNavigate = vi.fn()) => (
  <NavDropdownPanel open={open} onMouseLeave={vi.fn()}>
    <NavDropdownHeading first>Start here</NavDropdownHeading>
    <NavDropdownItem
      href="/assessment"
      icon={Star}
      label="Get Started"
      description="Know the sport"
      onNavigate={onNavigate}
    />
    <NavDropdownDivider />
    <NavDropdownItem
      href="/roadmap"
      icon={Star}
      label="Sports Pathways"
      description="The journey ahead"
      active
      onNavigate={onNavigate}
    />
  </NavDropdownPanel>
);

const opacityOf = (element: HTMLElement) => Number(getComputedStyle(element).opacity || "1");

describe.each([
  ["with motion", false],
  ["with reduced motion", true],
])("NavDropdownPanel %s", (_name, reduce) => {
  it("renders nothing while closed", () => {
    setReducedMotion(reduce);
    render(menu(false));
    expect(screen.queryByText("Get Started")).toBeNull();
  });

  it("settles with the panel and every row fully visible", async () => {
    setReducedMotion(reduce);
    render(menu(true));

    const rows = [screen.getByText("Get Started"), screen.getByText("Sports Pathways")];
    const heading = screen.getByText("Start here");
    const panel = rows[0]!.closest("div.absolute") as HTMLElement;

    await waitFor(
      () => {
        for (const element of [
          panel,
          heading,
          ...rows.map((r) => r.closest("a")!.parentElement!),
        ]) {
          expect(opacityOf(element as HTMLElement)).toBe(1);
        }
      },
      { timeout: 2000 }
    );
  });

  it("keeps the links real and reports a click", async () => {
    setReducedMotion(reduce);
    const onNavigate = vi.fn();
    render(menu(true, onNavigate));

    const link = screen.getByText("Get Started").closest("a")!;
    expect(link.getAttribute("href")).toBe("/assessment");
    link.click();
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("marks the current page's row", () => {
    setReducedMotion(reduce);
    render(menu(true));
    expect(screen.getByText("Sports Pathways").closest("a")!.className).toContain("bg-orange-50");
    expect(screen.getByText("Get Started").closest("a")!.className).not.toContain("bg-orange-50 ");
  });
});
