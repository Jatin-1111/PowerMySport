// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/expert/settings",
}));

let mockUser: Record<string, unknown> | null = null;
const logout = vi.fn();
vi.mock("../src/modules/auth/store/authStore", () => ({
  useAuthStore: () => ({ user: mockUser, setUser: vi.fn(), logout }),
}));
vi.mock("../src/modules/auth/hooks/useProfile", () => ({ useProfile: () => ({}) }));
vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  GoogleLogin: () => <button type="button">Continue with Google</button>,
}));

const changePassword = vi.fn();
const deleteAccount = vi.fn();
vi.mock("../src/modules/auth/services/auth", () => ({
  authApi: {
    changePassword: (...a: unknown[]) => changePassword(...a),
    deleteAccount: (...a: unknown[]) => deleteAccount(...a),
    linkGoogleAccount: vi.fn(),
    getWhatsAppConsent: () => Promise.resolve({ granted: false }),
    setWhatsAppConsent: vi.fn(),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../src/lib/toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const getPreferences = vi.fn();
const updatePreferences = vi.fn();
vi.mock("../src/lib/api/notification", () => ({
  notificationApi: {
    getPreferences: (...a: unknown[]) => getPreferences(...a),
    updatePreferences: (...a: unknown[]) => updatePreferences(...a),
  },
}));
vi.mock("../src/lib/api/push", () => ({
  pushNotificationService: {
    isSupported: () => false,
    getPermissionStatus: () => Promise.resolve("default"),
    getSubscription: () => Promise.resolve(null),
  },
}));

import { NotificationsPageTemplate } from "../src/modules/shared/components/settings/NotificationsPageTemplate";
import { SettingsPageTemplate } from "../src/modules/shared/components/settings/SettingsPageTemplate";

const user = (over: Record<string, unknown> = {}) => ({
  name: "Arjun Rao",
  email: "arjun@example.com",
  role: "EXPERT",
  hasPassword: true,
  ...over,
});

beforeEach(() => {
  for (const fn of [
    replace,
    push,
    logout,
    changePassword,
    deleteAccount,
    toastSuccess,
    toastError,
    getPreferences,
    updatePreferences,
  ]) {
    fn.mockReset();
  }
  mockUser = user();
});
afterEach(cleanup);

describe("SettingsPageTemplate", () => {
  it("shows who the account belongs to, in sentence case", () => {
    render(<SettingsPageTemplate basePath="/expert/settings" />);
    expect(screen.getByText("arjun@example.com")).toBeTruthy();
    expect(screen.getByText("Expert")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Notification preferences/ }).getAttribute("href")
    ).toBe("/expert/settings/notifications");
  });

  it("points an expert at the expert pages that exist", () => {
    render(<SettingsPageTemplate basePath="/expert/settings" />);
    expect(screen.getByRole("link", { name: /Profile/ }).getAttribute("href")).toBe(
      "/expert/profile"
    );
    expect(screen.getByRole("link", { name: /Sessions/ }).getAttribute("href")).toBe(
      "/expert/sessions"
    );
  });

  it("will not change a password with an empty field", () => {
    render(<SettingsPageTemplate />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(toastError).toHaveBeenCalledWith("Fill in all password fields");
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("changes a password and closes the form", async () => {
    changePassword.mockResolvedValue({ success: true });
    render(<SettingsPageTemplate />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "old-pass-1" },
    });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-pass-22" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-pass-22" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "old-pass-1",
        newPassword: "new-pass-22",
      })
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Password changed"));
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("shows and hides a password on request", () => {
    render(<SettingsPageTemplate />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    const input = screen.getByLabelText("Current password") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(input.type).toBe("text");
  });

  it("explains that a Google account has no password to change", () => {
    mockUser = user({ hasPassword: false });
    render(<SettingsPageTemplate />);
    expect(screen.getByText(/no password to manage/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change password" })).toBeNull();
  });

  it("waits for the profile before offering password or delete actions", () => {
    mockUser = user({ hasPassword: undefined });
    render(<SettingsPageTemplate />);
    expect(screen.getByText("Checking your sign-in method.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change password" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Delete my account" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("asks the visitor to sign in when there is no user", () => {
    mockUser = null;
    const { container } = render(<SettingsPageTemplate />);
    expect(container.textContent).toBe("");
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("deletes the account only after DELETE is typed", async () => {
    deleteAccount.mockResolvedValue({ success: true, message: "Scheduled." });
    render(<SettingsPageTemplate />);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete my account" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/Type DELETE to confirm/), {
      target: { value: "delete" },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/");
  });
});

describe("NotificationsPageTemplate", () => {
  const prefs = () => ({
    data: {
      email: { bookingReminders: true },
      push: { bookingReminders: false },
      inApp: { bookingReminders: true },
    },
  });

  it("labels every checkbox with what and how", async () => {
    getPreferences.mockResolvedValue(prefs());
    render(<NotificationsPageTemplate backUrl="/expert/settings" />);
    const pushBox = (await screen.findByRole("checkbox", {
      name: "Booking reminders by push",
    })) as HTMLInputElement;
    expect(pushBox.checked).toBe(false);
    expect(
      (screen.getByRole("checkbox", { name: "Booking reminders by email" }) as HTMLInputElement)
        .checked
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Back to settings/ }).getAttribute("href")).toBe(
      "/expert/settings"
    );
  });

  it("offers save and discard only once something changed, and saves the change", async () => {
    getPreferences.mockResolvedValue(prefs());
    updatePreferences.mockResolvedValue({});
    render(<NotificationsPageTemplate backUrl="/expert/settings" />);
    const box = await screen.findByRole("checkbox", { name: "Booking reminders by push" });
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();

    fireEvent.click(box);
    fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ push: expect.objectContaining({ bookingReminders: true }) })
      )
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Preferences saved"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull());
  });

  it("discards an unsaved change", async () => {
    getPreferences.mockResolvedValue(prefs());
    render(<NotificationsPageTemplate backUrl="/expert/settings" />);
    const box = (await screen.findByRole("checkbox", {
      name: "Booking reminders by push",
    })) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(box.checked).toBe(false);
  });
});
