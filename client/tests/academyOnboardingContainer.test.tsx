// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const api = vi.hoisted(() => ({
  getProgress: vi.fn(),
  startOnboarding: vi.fn(),
  saveStep: vi.fn(),
  submitForApproval: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}));
vi.mock("@/modules/onboarding/services/academy", () => ({
  academyOnboardingApi: api,
  needsEmailVerification: (e: { needs?: boolean }) => Boolean(e?.needs),
}));

// Each step is a stub with one button that saves a fixed payload, so these tests
// are about the container: numbering, resume, the email gate. The steps have their own tests.
const { stub } = vi.hoisted(() => ({
  stub: (name: string, payload: unknown) =>
    function Stub(props: {
      onSubmit: (d: unknown) => Promise<unknown> | void;
      previousData?: unknown;
    }) {
      return (
        <div>
          <h2>{name}</h2>
          <span data-testid={`${name}-prev`}>{props.previousData ? "has-previous" : "none"}</span>
          <button onClick={() => void props.onSubmit(payload)}>save {name}</button>
        </div>
      );
    },
}));
vi.mock("@/modules/onboarding/components/academy/Step1BasicInfo", () => ({
  default: stub("one", { name: "Ace", ownerEmail: "o@example.com" }),
}));
vi.mock("@/modules/onboarding/components/academy/Step2Location", () => ({
  default: stub("two", { s: 2 }),
}));
vi.mock("@/modules/onboarding/components/academy/Step3Legal", () => ({
  default: stub("three", { s: 3 }),
}));
vi.mock("@/modules/onboarding/components/academy/Step4Venues", () => ({
  default: stub("four", { academyVenues: [] }),
}));
vi.mock("@/modules/onboarding/components/academy/Step5Coaches", () => ({
  default: stub("five", { academyCoaches: [] }),
}));
vi.mock("@/modules/onboarding/components/academy/Step6Pricing", () => ({
  default: stub("six", { sessionRatePerHour: 100 }),
}));
vi.mock("@/modules/onboarding/components/academy/Step7Payouts", () => ({
  default: stub("seven", { agreeToTerms: true }),
}));
vi.mock("@/modules/onboarding/components/onboarding/EmailVerificationModal", () => ({
  default: (p: { onVerified: () => void }) => <button onClick={p.onVerified}>enter code</button>,
}));

import AcademyOnboardingContainer from "@/modules/onboarding/components/academy/AcademyOnboardingContainer";

const academy = { name: "Ace", legalName: "Ace Ltd", sports: ["Tennis"], ageGroups: ["all"] };

beforeEach(() => {
  search = "";
  Object.values(api).forEach((f) => f.mockReset());
  replace.mockReset();
  push.mockReset();
  localStorage.clear();
  api.saveStep.mockResolvedValue({});
  api.submitForApproval.mockResolvedValue({});
});
afterEach(cleanup);

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("academy sign-up container", () => {
  it("creates the academy at step 1, then saves steps 2 to 7 under their own numbers", async () => {
    api.startOnboarding.mockResolvedValue({ data: { academyId: "a1" } });
    render(<AcademyOnboardingContainer />);

    click("save one");
    await screen.findByText("two");
    for (const [name, step] of [
      ["two", 2],
      ["three", 3],
      ["four", 4],
      ["five", 5],
      ["six", 6],
    ] as const) {
      click(`save ${name}`);
      await waitFor(() =>
        expect(api.saveStep).toHaveBeenLastCalledWith("a1", step, expect.anything())
      );
    }
    await screen.findByText("seven");
    expect(replace).toHaveBeenLastCalledWith("/academy/onboarding?resumeId=a1");
  });

  it("resumes on the step after the last one saved, with earlier forms filled", async () => {
    search = "resumeId=a1";
    api.getProgress.mockResolvedValue({
      data: {
        currentStep: 3,
        data: { ...academy, academyVenues: [], sessionRatePerHour: 0 },
      },
    });
    render(<AcademyOnboardingContainer />);
    await screen.findByText("four");
    expect(screen.getByText(/Steps 1 to 3 are saved/)).toBeTruthy();
    expect(screen.getByText("43% saved")).toBeTruthy();
  });

  it("does not let the owner jump past the next unsaved step", async () => {
    search = "resumeId=a1";
    api.getProgress.mockResolvedValue({ data: { currentStep: 2, data: academy } });
    render(<AcademyOnboardingContainer />);
    await screen.findByText("three");
    expect((screen.getByRole("button", { name: /^5/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^3/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says so when the sign-up cannot be opened on this device", async () => {
    search = "resumeId=a1";
    api.getProgress.mockRejectedValue(new Error("403"));
    render(<AcademyOnboardingContainer />);
    expect(await screen.findByText("We could not open this sign-up")).toBeTruthy();
  });

  it("submits after step 7 and goes to the success page", async () => {
    search = "resumeId=a1";
    api.getProgress.mockResolvedValue({ data: { currentStep: 6, data: academy } });
    render(<AcademyOnboardingContainer />);
    await screen.findByText("seven");
    click("save seven");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/academy/onboarding/success/a1"));
    expect(api.saveStep).toHaveBeenCalledWith("a1", 7, { agreeToTerms: true });
  });

  it("asks for the email code when the server wants it, then finishes", async () => {
    search = "resumeId=a1";
    api.getProgress.mockResolvedValue({ data: { currentStep: 6, data: academy } });
    api.submitForApproval.mockRejectedValueOnce({ needs: true }).mockResolvedValueOnce({});
    render(<AcademyOnboardingContainer />);
    await screen.findByText("seven");
    click("save seven");
    const code = await screen.findByRole("button", { name: "enter code" });
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(code);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/academy/onboarding/success/a1"));
    expect(api.submitForApproval).toHaveBeenCalledTimes(2);
  });

  it("forgets the saved id once submitted", async () => {
    search = "resumeId=a1";
    api.getProgress.mockResolvedValue({ data: { currentStep: 6, data: academy } });
    render(<AcademyOnboardingContainer />);
    await screen.findByText("seven");
    expect(localStorage.getItem("academy_onboarding_current")).toBe("a1");
    click("save seven");
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(localStorage.getItem("academy_onboarding_current")).toBeNull();
  });
});
