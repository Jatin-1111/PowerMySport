import { describe, expect, it } from "vitest";
import { findActiveHref } from "./activeNavHref";

const items = [
  { href: "/" },
  { href: "/dashboard" },
  { href: "/dashboard/invitations" },
  { href: "/dashboard/my-classes" },
  { href: "https://community.example.com", external: true },
];

describe("findActiveHref", () => {
  it("marks only the page itself, not the dashboard above it", () => {
    expect(findActiveHref(items, "/dashboard/invitations")).toBe("/dashboard/invitations");
    expect(findActiveHref(items, "/dashboard/my-classes")).toBe("/dashboard/my-classes");
  });

  it("keeps a parent item active on a page that has no item of its own", () => {
    expect(findActiveHref(items, "/dashboard/dependents/abc")).toBe("/dashboard");
    expect(findActiveHref(items, "/dashboard")).toBe("/dashboard");
  });

  it("matches the home item only on the home page", () => {
    expect(findActiveHref(items, "/")).toBe("/");
    expect(findActiveHref(items, "/shop")).toBeUndefined();
  });

  it("does not treat a longer name as a child path", () => {
    expect(findActiveHref(items, "/dashboard-old")).toBeUndefined();
  });

  it("never marks an external item", () => {
    expect(findActiveHref(items, "https://community.example.com")).toBeUndefined();
  });
});
