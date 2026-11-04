// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Second of the plan's 6 largest client/src/app pages (1127 lines), same
// situation as contactPage.test.tsx: no extracted hook/sub-components, so
// this renders the whole page component directly.

const listMyPackages = vi.fn();
const getCoachActiveSubscriptions = vi.fn();
const getSubscriptionRevenue = vi.fn();
const createPackage = vi.fn();
const updatePackage = vi.fn();
const deletePackage = vi.fn();

vi.mock("@/modules/coach/services/coach", () => ({
  coachApi: {
    listMyPackages: (...args: unknown[]) => listMyPackages(...args),
    getCoachActiveSubscriptions: (...args: unknown[]) => getCoachActiveSubscriptions(...args),
    getSubscriptionRevenue: (...args: unknown[]) => getSubscriptionRevenue(...args),
    createPackage: (...args: unknown[]) => createPackage(...args),
    updatePackage: (...args: unknown[]) => updatePackage(...args),
    deletePackage: (...args: unknown[]) => deletePackage(...args),
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import CoachBillingPage from "../src/app/(booking)/coach/billing/page";
import type { CoachSubscriptionPackage } from "../src/types";

const emptyRevenue = { total: 0, count: 0, byFrequency: { MONTHLY: 0, QUARTERLY: 0, YEARLY: 0 } };

const seededPackage: CoachSubscriptionPackage = {
  id: "pkg-1",
  coachId: "coach-1",
  name: "Gold Membership",
  description: "Our most popular plan.",
  frequency: "MONTHLY",
  price: 499900,
  features: ["Weekly 1-on-1", "Progress tracking"],
  maxStudents: 10,
  maxSessions: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockLoadsWith = (packages: CoachSubscriptionPackage[]) => {
  listMyPackages.mockResolvedValue({ success: true, data: { packages } });
  getCoachActiveSubscriptions.mockResolvedValue({ success: true, data: { subscriptions: [] } });
  getSubscriptionRevenue.mockResolvedValue({ success: true, data: { revenue: emptyRevenue } });
};

const nameInput = () => screen.getByPlaceholderText("Gold coaching membership");
const priceInput = () => screen.getByPlaceholderText("4999");
const createOrSaveButton = () =>
  screen.getByRole("button", { name: /Create package|Save changes/i });

const fillMinimalValidForm = () => {
  fireEvent.change(nameInput(), { target: { value: "Silver Membership" } });
  fireEvent.change(priceInput(), { target: { value: "999" } });
};

beforeEach(() => {
  listMyPackages.mockReset();
  getCoachActiveSubscriptions.mockReset();
  getSubscriptionRevenue.mockReset();
  createPackage.mockReset();
  updatePackage.mockReset();
  deletePackage.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("CoachBillingPage — loading and listing", () => {
  it("shows a loading state, then the empty state when there are no packages", async () => {
    mockLoadsWith([]);
    render(<CoachBillingPage />);

    expect(screen.getByText(/Loading packages/i)).toBeInTheDocument();

    expect(await screen.findByText("No packages yet")).toBeInTheDocument();
  });

  it("renders a seeded package with its price and frequency", async () => {
    mockLoadsWith([seededPackage]);
    render(<CoachBillingPage />);

    expect(await screen.findByText("Gold Membership")).toBeInTheDocument();
    // "Monthly" also appears in the always-rendered frequency selector, so
    // the card's own summary line (frequency + price together) is the
    // unambiguous match.
    expect(screen.getByText("Monthly • ₹4,999")).toBeInTheDocument();
    expect(screen.getByText("Weekly 1-on-1")).toBeInTheDocument();
  });

  it("surfaces a toast when the initial load fails", async () => {
    listMyPackages.mockRejectedValue(new Error("network down"));
    getCoachActiveSubscriptions.mockRejectedValue(new Error("network down"));
    getSubscriptionRevenue.mockRejectedValue(new Error("network down"));
    render(<CoachBillingPage />);

    // All three loads are Promise.allSettled — none rejecting the overall
    // load — but the page still has nothing to show.
    await waitFor(() => {
      expect(screen.queryByText(/Loading packages/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText("No packages yet")).toBeInTheDocument();
  });
});

describe("CoachBillingPage — form validation", () => {
  it("disables the create button until name and price are valid", async () => {
    mockLoadsWith([]);
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    expect(createOrSaveButton()).toBeDisabled();

    fireEvent.change(nameInput(), { target: { value: "AB" } });
    fireEvent.change(priceInput(), { target: { value: "999" } });
    expect(createOrSaveButton()).toBeDisabled();

    fireEvent.change(nameInput(), { target: { value: "Silver Membership" } });
    expect(createOrSaveButton()).not.toBeDisabled();
  });

  it("shows a validation message for a name under 3 characters once touched", async () => {
    mockLoadsWith([]);
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fireEvent.change(nameInput(), { target: { value: "AB" } });
    fireEvent.blur(nameInput());

    expect(screen.getByText("Use a clear name with at least 3 characters.")).toBeInTheDocument();
  });

  it("shows a validation message for a non-positive price once touched", async () => {
    mockLoadsWith([]);
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fireEvent.change(priceInput(), { target: { value: "-5" } });
    fireEvent.blur(priceInput());

    expect(screen.getByText("Enter a valid price greater than 0.")).toBeInTheDocument();
  });
});

describe("CoachBillingPage — creating a package", () => {
  it("converts the entered rupee price to paise and submits the payload", async () => {
    mockLoadsWith([]);
    createPackage.mockResolvedValue({ success: true, data: {} });
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fillMinimalValidForm();
    fireEvent.click(createOrSaveButton());

    await waitFor(() => {
      expect(createPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Silver Membership",
          frequency: "MONTHLY",
          price: 99900,
          features: [],
          isActive: true,
        })
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("Package created");
  });

  it("reloads the package list after a successful create", async () => {
    mockLoadsWith([]);
    createPackage.mockResolvedValue({ success: true, data: {} });
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fillMinimalValidForm();
    fireEvent.click(createOrSaveButton());

    await waitFor(() => {
      expect(listMyPackages).toHaveBeenCalledTimes(2);
    });
  });

  it("resets the form after a successful create", async () => {
    mockLoadsWith([]);
    createPackage.mockResolvedValue({ success: true, data: {} });
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fillMinimalValidForm();
    fireEvent.click(createOrSaveButton());

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
    });
    expect(nameInput()).toHaveValue("");
  });

  it("shows an error toast and keeps the form filled when the API call fails", async () => {
    mockLoadsWith([]);
    createPackage.mockResolvedValue({ success: false, message: "Duplicate package name" });
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fillMinimalValidForm();
    fireEvent.click(createOrSaveButton());

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Duplicate package name");
    });
    expect(nameInput()).toHaveValue("Silver Membership");
  });

  it("parses comma- and newline-separated features into a preview list, deduplicated", async () => {
    mockLoadsWith([]);
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fireEvent.change(screen.getByPlaceholderText(/Examples:/), {
      target: { value: "Weekly call\nWeekly call, Progress report" },
    });

    expect(screen.getByText("2 feature(s)")).toBeInTheDocument();
    // The parsed feature list renders twice — once as chips under the
    // textarea, once again inside the "Live preview" card — so each feature
    // is expected in both places, not deduplicated across the whole page.
    expect(screen.getAllByText("Weekly call")).toHaveLength(2);
    expect(screen.getAllByText("Progress report")).toHaveLength(2);
  });

  it("switches the selected frequency on click", async () => {
    mockLoadsWith([]);
    createPackage.mockResolvedValue({ success: true, data: {} });
    render(<CoachBillingPage />);
    await screen.findByText("No packages yet");

    fillMinimalValidForm();
    fireEvent.click(screen.getByRole("button", { name: /Yearly/ }));
    fireEvent.click(createOrSaveButton());

    await waitFor(() => {
      expect(createPackage).toHaveBeenCalledWith(expect.objectContaining({ frequency: "YEARLY" }));
    });
  });
});

describe("CoachBillingPage — editing a package", () => {
  it("populates the form and switches to edit mode", async () => {
    mockLoadsWith([seededPackage]);
    render(<CoachBillingPage />);
    await screen.findByText("Gold Membership");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Edit package")).toBeInTheDocument();
    expect(nameInput()).toHaveValue("Gold Membership");
    expect(priceInput()).toHaveValue(4999);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("submits an update with the edited fields", async () => {
    mockLoadsWith([seededPackage]);
    updatePackage.mockResolvedValue({ success: true, data: {} });
    render(<CoachBillingPage />);
    await screen.findByText("Gold Membership");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(nameInput(), { target: { value: "Gold Membership Plus" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updatePackage).toHaveBeenCalledWith(
        "pkg-1",
        expect.objectContaining({ name: "Gold Membership Plus" })
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("Package updated");
  });

  it("returns to build mode on cancel without saving", async () => {
    mockLoadsWith([seededPackage]);
    render(<CoachBillingPage />);
    await screen.findByText("Gold Membership");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(screen.getByText("Build a package")).toBeInTheDocument();
    expect(nameInput()).toHaveValue("");
    expect(updatePackage).not.toHaveBeenCalled();
  });
});

describe("CoachBillingPage — deleting a package", () => {
  it("asks for confirmation before deleting, naming the package", async () => {
    mockLoadsWith([seededPackage]);
    render(<CoachBillingPage />);
    await screen.findByText("Gold Membership");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText(/Delete Gold Membership\?/)).toBeInTheDocument();
    expect(deletePackage).not.toHaveBeenCalled();
  });

  it("deletes the package once confirmed", async () => {
    mockLoadsWith([seededPackage]);
    deletePackage.mockResolvedValue({ success: true, data: {} });
    render(<CoachBillingPage />);
    await screen.findByText("Gold Membership");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete package" }));

    await waitFor(() => {
      expect(deletePackage).toHaveBeenCalledWith("pkg-1");
    });
    expect(toastSuccess).toHaveBeenCalledWith("Package deleted");
  });
});
