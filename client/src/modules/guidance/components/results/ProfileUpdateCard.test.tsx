// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateChild } = vi.hoisted(() => ({ updateChild: vi.fn() }));

vi.mock("@/modules/player/hooks/useSaveChild", () => ({ useSaveChild: () => ({ updateChild }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "@/lib/toast";
import type { ProfileSuggestion } from "@/modules/guidance/utils/profileSuggestions";
import { ProfileUpdateCard } from "./ProfileUpdateCard";

const suggestions: ProfileSuggestion[] = [
  {
    field: "weeklyHoursCategory",
    label: "Training time",
    current: "4 to 7 hours a week",
    next: "8 to 12 hours a week",
    value: "8-12",
  },
  {
    field: "budgetRange",
    label: "Budget",
    current: null,
    next: "₹3,000 to ₹7,000",
    value: "3k-7k",
  },
];

const mount = (list = suggestions) =>
  render(<ProfileUpdateCard childId="c1" childName="Riya" suggestions={list} />);

beforeEach(() => {
  updateChild.mockReset().mockResolvedValue({ child: {}, refreshed: Promise.resolve(null) });
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("ProfileUpdateCard", () => {
  it("shows what would change and writes nothing until the parent chooses", () => {
    mount();

    expect(screen.getByText(/Update Riya's profile with these answers/)).toBeTruthy();
    expect(screen.getByText("8 to 12 hours a week")).toBeTruthy();
    expect(updateChild).not.toHaveBeenCalled();
  });

  it("saves only the suggested fields when the parent accepts", async () => {
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Update profile" }));

    await waitFor(() => expect(screen.getByText(/now matches these answers/)).toBeTruthy());
    expect(updateChild).toHaveBeenCalledTimes(1);
    expect(updateChild).toHaveBeenCalledWith("c1", {
      weeklyHoursCategory: "8-12",
      budgetRange: "3k-7k",
    });
  });

  it("saves nothing when the parent says not now", () => {
    const { container } = mount();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(updateChild).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
  });

  it("says so, and lets the parent try again, when the save fails", async () => {
    updateChild.mockRejectedValueOnce(new Error("boom"));
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Update profile" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Update profile" })).toBeTruthy();
  });

  it("renders nothing when there is nothing to suggest", () => {
    const { container } = mount([]);

    expect(container.textContent).toBe("");
  });
});
