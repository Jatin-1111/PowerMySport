// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();
const updateProfile = vi.fn();
const setUser = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../src/modules/auth/services/auth", () => ({
  authApi: {
    getProfile: (...a: unknown[]) => getProfile(...a),
    updateProfile: (...a: unknown[]) => updateProfile(...a),
  },
}));
vi.mock("../src/modules/auth/store/authStore", () => ({
  useAuthStore: (
    select: (s: { hydrated: boolean; token: string; setUser: typeof setUser }) => unknown
  ) => select({ hydrated: true, token: "t", setUser }),
}));
vi.mock("../src/lib/toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
vi.mock("../src/modules/shared/components/ProfilePictureUpload", () => ({
  default: () => <div data-testid="photo-upload" />,
}));

import { VenueProfile } from "../src/modules/venue/components/profile/VenueProfile";

const user = {
  id: "u1",
  name: "Meera Iyer",
  email: "meera@example.com",
  phone: "9876543210",
  role: "VenueLister",
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VenueProfile />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  for (const fn of [getProfile, updateProfile, setUser, toastSuccess, toastError]) fn.mockReset();
  getProfile.mockResolvedValue({ success: true, data: user });
});

afterEach(cleanup);

describe("VenueProfile", () => {
  it("shows the account's details once they load", async () => {
    renderPage();
    expect(await screen.findByText("meera@example.com")).toBeTruthy();
    expect(screen.getByText("Meera Iyer")).toBeTruthy();
    expect(screen.getByText("9876543210")).toBeTruthy();
    expect(screen.getByText("Not added")).toBeTruthy();
  });

  it("saves edited details and updates the signed-in user", async () => {
    updateProfile.mockResolvedValue({ success: true, data: { ...user, name: "Meera Rao" } });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Meera Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "Meera Rao" }))
    );
    await waitFor(() =>
      expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ name: "Meera Rao" }))
    );
    expect(toastSuccess).toHaveBeenCalledWith("Details saved.");
    expect(await screen.findByText("Meera Rao")).toBeTruthy();
  });

  it("will not save without a name", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    expect(toastError).toHaveBeenCalledWith("Name and email are required.");
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("offers a retry when the profile cannot be loaded", async () => {
    getProfile.mockImplementation(() => Promise.reject(new Error("boom")));
    renderPage();
    expect(await screen.findByText("We could not load your profile")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
