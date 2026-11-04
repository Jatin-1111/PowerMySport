// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  search: { current: new URLSearchParams() },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  consent: vi.fn(),
  preview: vi.fn(),
  claim: vi.fn(),
}));

// One router object for every render, as in the real app. A new one each time would re-run the
// effect that takes the token out of the address.
vi.mock("next/navigation", () => {
  const router = {
    replace: (path: string) => {
      mocks.replace(path);
      // The address no longer carries the token once it has been replaced.
      mocks.search.current = new URLSearchParams();
    },
    push: (path: string) => mocks.push(path),
  };
  return { useRouter: () => router, useSearchParams: () => mocks.search.current };
});
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("@/modules/player/store/parentalConsentStore", () => ({
  requestParentalConsent: mocks.consent,
}));
vi.mock("../services/handoffApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/handoffApi")>()),
  handoffApi: { preview: mocks.preview, claim: mocks.claim },
}));

import { useAuthStore } from "@/modules/auth/store/authStore";
import type { User } from "@/types";
import type { HandoffChild } from "../services/handoffApi";
import { recalledToken, rememberToken } from "../utils/handoffToken";
import { HandoffPage } from "./HandoffPage";

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HandoffPage />
    </QueryClientProvider>
  );

const VIKRANT: HandoffChild = {
  key: "vikrant",
  firstName: "Vikrant",
  ageText: "14",
  sports: ["Tennis"],
  level: "intermediate",
  goal: "play state level",
  state: "Delhi",
  suggestedAmbition: "competitive",
  suggestedExperience: "intermediate",
};
const RIYA: HandoffChild = { key: "riya", firstName: "Riya", ageText: "9", sports: ["Swimming"] };

const signInAs = (role: User["role"], consentCurrent = false) =>
  useAuthStore.setState({
    hydrated: true,
    user: {
      id: "u1",
      name: "Meera",
      email: "m@example.com",
      role,
      parentalConsentCurrent: consentCurrent,
    } as User,
  });
const signedOut = () => useAuthStore.setState({ hydrated: true, user: null });

const apiError = (status: number, message: string) =>
  Object.assign(new Error(message), { response: { status, data: { message } } });

const goTo = (query = "") => {
  mocks.search.current = new URLSearchParams(query);
};

const fillDob = (name: string, value: string) =>
  fireEvent.change(
    screen.getByLabelText(new RegExp(`date of birth`, "i"), { selector: `#handoff-dob-${name}` }),
    {
      target: { value },
    }
  );

beforeEach(() => {
  for (const fn of Object.values(mocks))
    if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  window.sessionStorage.clear();
  goTo("t=TOKEN.SIG");
  mocks.preview.mockResolvedValue([VIKRANT, RIYA]);
  mocks.consent.mockResolvedValue(true);
  mocks.claim.mockResolvedValue({
    created: ["Vikrant"],
    skipped: [],
    missing: [],
    failed: [],
    remaining: 0,
  });
  signInAs("Parent", true);
});

describe("opening the link", () => {
  it("takes the token out of the address and keeps it for the visit", async () => {
    renderPage();
    await screen.findByText("Vikrant");
    expect(recalledToken()).toBe("TOKEN.SIG");
    expect(mocks.replace).toHaveBeenCalledWith("/start");
    expect(mocks.preview).toHaveBeenCalledWith("TOKEN.SIG");
  });

  it("uses the kept token when the visitor comes back without one in the address", async () => {
    goTo("");
    rememberToken("KEPT.TOKEN");
    renderPage();
    await screen.findByText("Vikrant");
    expect(mocks.preview).toHaveBeenCalledWith("KEPT.TOKEN");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("says there is nothing here when there is no link at all", async () => {
    goTo("");
    renderPage();
    expect(await screen.findByText("This link has no details")).toBeInTheDocument();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("shows the server's own words when the link has expired or was replaced", async () => {
    mocks.preview.mockRejectedValue(
      apiError(410, "This link has expired. Ask the assistant on WhatsApp for a new one.")
    );
    renderPage();
    expect(await screen.findByText(/This link has expired/)).toBeInTheDocument();
    expect(screen.queryByText("Create profile")).not.toBeInTheDocument();
  });
});

describe("a signed-out parent", () => {
  beforeEach(signedOut);

  it("sees what was kept, with nothing to fill in", async () => {
    renderPage();
    expect(await screen.findByText("Vikrant")).toBeInTheDocument();
    expect(
      screen.getByText(/Age 14 · Tennis · Level: intermediate · Goal: play state level · Delhi/)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
  });

  it("is sent to sign up or log in, and straight back here", async () => {
    renderPage();
    const signUp = await screen.findByRole("link", { name: "Create account" });
    expect(signUp).toHaveAttribute("href", "/register?redirect=%2Fstart");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fstart"
    );
  });
});

describe("a parent confirming", () => {
  it("needs a date of birth for each ticked child, and sends nothing until it is valid", async () => {
    renderPage();
    await screen.findByText("Vikrant");
    fireEvent.click(screen.getByRole("button", { name: "Create 2 profiles" }));

    expect(await screen.findAllByText("Enter a date of birth.")).toHaveLength(2);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("refuses an adult's date of birth", async () => {
    renderPage();
    await screen.findByText("Vikrant");
    fillDob("vikrant", "1990-01-01");
    fillDob("riya", "2015-05-05");
    fireEvent.click(screen.getByRole("button", { name: "Create 2 profiles" }));
    expect(await screen.findByText("A child must be under 18.")).toBeInTheDocument();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("sends the date of birth with the suggestions the parent left in place, then goes to the dashboard", async () => {
    renderPage();
    await screen.findByText("Vikrant");
    fireEvent.click(screen.getByLabelText("Add Riya"));
    fillDob("vikrant", "2012-12-01");
    expect(screen.getByRole("button", { name: "Competitive", pressed: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledTimes(1));
    expect(mocks.claim).toHaveBeenCalledWith(
      "TOKEN.SIG",
      [
        {
          key: "vikrant",
          dob: "2012-12-01",
          ambition: "competitive",
          experienceLevel: "intermediate",
        },
      ],
      undefined
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    expect(recalledToken()).toBeNull();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Vikrant has been added to your profile.");
  });

  it("drops a suggestion the parent takes back", async () => {
    renderPage();
    await screen.findByText("Vikrant");
    fireEvent.click(screen.getByLabelText("Add Riya"));
    fillDob("vikrant", "2012-12-01");
    fireEvent.click(screen.getByRole("button", { name: "Competitive", pressed: true }));
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));

    await waitFor(() => expect(mocks.claim).toHaveBeenCalled());
    expect(mocks.claim.mock.calls[0]![1]).toEqual([
      { key: "vikrant", dob: "2012-12-01", experienceLevel: "intermediate" },
    ]);
  });

  it("asks for the Parental Consent policy first when it has not been given, and sends the agreement", async () => {
    signInAs("Parent", false);
    renderPage();
    await screen.findByText("Vikrant");
    fireEvent.click(screen.getByLabelText("Add Riya"));
    fillDob("vikrant", "2012-12-01");
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));

    await waitFor(() => expect(mocks.claim).toHaveBeenCalled());
    expect(mocks.consent).toHaveBeenCalledTimes(1);
    expect(mocks.claim.mock.calls[0]![2]).toBe(true);
  });

  it("creates nothing when the parent declines the consent policy", async () => {
    signInAs("Parent", false);
    mocks.consent.mockResolvedValue(false);
    renderPage();
    await screen.findByText("Vikrant");
    fireEvent.click(screen.getByLabelText("Add Riya"));
    fillDob("vikrant", "2012-12-01");
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("asks once and retries when the server says its record of consent is older", async () => {
    mocks.claim
      .mockRejectedValueOnce(
        apiError(428, "Please accept the Parental Consent policy to add a child.")
      )
      .mockResolvedValueOnce({
        created: ["Vikrant"],
        skipped: [],
        missing: [],
        failed: [],
        remaining: 0,
      });
    renderPage();
    await screen.findByText("Vikrant");
    fireEvent.click(screen.getByLabelText("Add Riya"));
    fillDob("vikrant", "2012-12-01");
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledTimes(2));
    expect(mocks.consent).toHaveBeenCalledTimes(1);
    expect(mocks.claim.mock.calls[1]![2]).toBe(true);
  });

  it("stays on the page and says what happened when something was skipped or failed", async () => {
    mocks.claim.mockResolvedValue({
      created: [],
      skipped: ["Riya"],
      missing: [],
      failed: [{ name: "Vikrant", reason: "You can add up to 10 child profiles." }],
      remaining: 1,
    });
    mocks.preview.mockResolvedValueOnce([VIKRANT, RIYA]).mockResolvedValueOnce([VIKRANT]);
    renderPage();
    await screen.findByText("Vikrant");
    fillDob("vikrant", "2012-12-01");
    fillDob("riya", "2015-05-05");
    fireEvent.click(screen.getByRole("button", { name: "Create 2 profiles" }));

    expect(
      await screen.findByText(/Already on your profile, so not added again: Riya/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Vikrant: You can add up to 10 child profiles./)).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(recalledToken()).toBe("TOKEN.SIG");
  });

  it("shows the link problem when the link stopped working during the confirmation", async () => {
    mocks.claim.mockRejectedValue(
      apiError(410, "A newer link was sent. Use the latest one in your WhatsApp chat.")
    );
    renderPage();
    await screen.findByText("Vikrant");
    fireEvent.click(screen.getByLabelText("Add Riya"));
    fillDob("vikrant", "2012-12-01");
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    expect(await screen.findByText(/A newer link was sent/)).toBeInTheDocument();
  });
});

describe("an account that cannot add children", () => {
  it("is told to use a parent account, with no way to submit", async () => {
    signInAs("Player");
    renderPage();
    expect(await screen.findByText("Switch to a parent profile")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
  });
});
