// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Bell, Home } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

import { DashboardShell } from "./DashboardShell";

const items = [
  { href: "/", label: "Home", icon: Home, section: "Overview" },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: Bell,
    badge: 3,
    section: "Community",
  },
];

const renderShell = () =>
  render(
    <DashboardShell
      dashboardLabel="Parent Dashboard"
      userName="Aarav Sharma"
      navItems={items}
      onLogout={vi.fn()}
    >
      <p>page body</p>
    </DashboardShell>
  );

/** The desktop sidebar is the `aside`; the mobile drawer is closed and not rendered. */
const sidebar = () => screen.getByRole("complementary");

describe("the dashboard sidebar", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("starts expanded, with its group headings and a collapse control", () => {
    renderShell();
    expect(within(sidebar()).getByText("Community")).toBeTruthy();
    const toggle = within(sidebar()).getByRole("button", { name: "Collapse sidebar" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("folds to a rail that keeps every destination reachable by name", () => {
    renderShell();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Collapse sidebar" }));

    // Group headings are gone, the links are not, and the pending count is still announced.
    expect(within(sidebar()).queryByText("Community")).toBeNull();
    expect(within(sidebar()).getByRole("link", { name: "Home" })).toBeTruthy();
    expect(within(sidebar()).getByRole("link", { name: "Notifications, 3 pending" })).toBeTruthy();

    const toggle = within(sidebar()).getByRole("button", { name: "Expand sidebar" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("remembers the choice and expands again", () => {
    const first = renderShell();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Collapse sidebar" }));
    first.unmount();

    renderShell();
    expect(within(sidebar()).getByRole("button", { name: "Expand sidebar" })).toBeTruthy();

    fireEvent.click(within(sidebar()).getByRole("button", { name: "Expand sidebar" }));
    expect(within(sidebar()).getByText("Community")).toBeTruthy();
  });
});
