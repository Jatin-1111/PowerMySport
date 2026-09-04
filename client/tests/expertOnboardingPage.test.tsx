// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fifth of the plan's 6 largest client/src/app pages (989 lines), and the
// most involved: a 5-step wizard whose step lives in the URL via the
// project's own useFlow()/next-navigation binding, not local state. Testing
// it for real means faking next/navigation's router+searchParams as a small
// reactive store — mocking push/replace as no-ops would leave the wizard
// stuck on step 1 forever, since useFlow reads the step back out of
// useSearchParams().

const routerStore = vi.hoisted(() => {
  let search = "";
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    getSearch: () => search,
    setFromUrl: (url: string) => {
      search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
      notify();
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    reset: () => {
      search = "";
    },
  };
});

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", async () => {
  const React = await import("react");
  return {
    usePathname: () => "/expert/onboarding",
    // Real Next.js memoizes the router object across renders. The page's
    // profile-load effect depends on `[router]`, so a mock returning a fresh
    // object literal every render would re-fire that effect on every
    // keystroke-triggered re-render and wipe out whatever the user just
    // typed — `useRef` keeps this mock's identity stable the same way.
    useRouter: () => {
      const ref = React.useRef({
        push: (url: string) => routerStore.setFromUrl(url),
        replace: (url: string) => {
          replaceMock(url);
          // A replace to a different page (e.g. the dashboard redirect)
          // isn't a same-page step change — only treat it as one when it's
          // a query update on this page.
          if (url.startsWith("/expert/onboarding") || url.startsWith("?")) {
            routerStore.setFromUrl(url);
          }
        },
      });
      return ref.current;
    },
    useSearchParams: () => {
      const [, forceRender] = React.useReducer((c: number) => c + 1, 0);
      React.useEffect(() => routerStore.subscribe(() => forceRender()), []);
      return new URLSearchParams(routerStore.getSearch());
    },
  };
});

let mockUser: { name: string; email: string } | null = {
  name: "Jane Expert",
  email: "jane@example.com",
};
const setUserMock = vi.fn();
vi.mock("@/modules/auth/store/authStore", () => ({
  useAuthStore: () => ({ user: mockUser, setUser: setUserMock }),
}));

const getMyProfile = vi.fn();
const updateMyProfile = vi.fn();
const submitForReview = vi.fn();
vi.mock("@/modules/expert/services/expert", () => ({
  expertApi: {
    getMyProfile: (...args: unknown[]) => getMyProfile(...args),
    updateMyProfile: (...args: unknown[]) => updateMyProfile(...args),
    submitForReview: (...args: unknown[]) => submitForReview(...args),
  },
}));

const authUpdateProfile = vi.fn();
vi.mock("@/modules/auth/services/auth", () => ({
  authApi: { updateProfile: (...args: unknown[]) => authUpdateProfile(...args) },
}));

const upsertExpertPayoutMethod = vi.fn();
vi.mock("@/modules/shared/services/payout", () => ({
  payoutApi: {
    upsertExpertPayoutMethod: (...args: unknown[]) => upsertExpertPayoutMethod(...args),
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

// These four are complex standalone widgets with their own behavior out of
// scope here — stubbed to simple, directly-clickable controls so this file
// can drive the wizard's OWN step-gating/save/submit logic without
// exercising theirs.
vi.mock("@/modules/expert/components/ExpertPhotoUpload", () => ({
  ExpertPhotoUpload: ({ onPhotoReady }: { onPhotoReady: (url: string, key: string) => void }) => (
    <button
      type="button"
      onClick={() => onPhotoReady("https://cdn.example.com/photo.jpg", "key-1")}
    >
      Upload photo
    </button>
  ),
}));
vi.mock("@/modules/shared/components/ExpertiseMultiSelect", () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
    <button type="button" onClick={() => onChange([...value, "Technical Coaching"])}>
      Add expertise
    </button>
  ),
}));
vi.mock("@/modules/shared/components/LanguagesMultiSelect", () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
    <button type="button" onClick={() => onChange([...value, "English"])}>
      Add language
    </button>
  ),
}));
vi.mock("@/modules/sports/components/SportsMultiSelect", () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
    <button type="button" onClick={() => onChange([...value, "Tennis"])}>
      Add sport
    </button>
  ),
}));

vi.mock("@/modules/expert/components/TaxPayoutInfoStep", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/modules/expert/components/TaxPayoutInfoStep")>();
  return {
    ...actual,
    TaxPayoutInfoStep: ({
      onChange,
    }: {
      onChange: (patch: Partial<typeof actual.EMPTY_TAX_PAYOUT_INFO>) => void;
    }) => (
      <div>
        <button
          type="button"
          onClick={() =>
            onChange({
              panNumber: "ABCDE1234F",
              payoutType: "UPI",
              upiId: "expert@okaxis",
            })
          }
        >
          Fill valid tax and payout info
        </button>
        <button type="button" onClick={() => onChange({ panNumber: "" })}>
          Clear PAN
        </button>
      </div>
    ),
  };
});

import ExpertOnboardingPage from "../src/app/(expert)/expert/onboarding/page";

const draftlessProfile = { success: true, data: { verificationStatus: "UNVERIFIED" } };

const fillStep1 = () => {
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Jane Expert" } });
  fireEvent.change(screen.getByLabelText(/^Bio/), {
    target: { value: "A long and detailed professional biography for review." },
  });
  fireEvent.change(screen.getByLabelText(/^Achievements/), {
    target: { value: "National champion 2018" },
  });
};

const clickContinue = () => fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

beforeEach(() => {
  routerStore.reset();
  mockUser = { name: "Jane Expert", email: "jane@example.com" };
  replaceMock.mockReset();
  setUserMock.mockReset();
  getMyProfile.mockReset();
  updateMyProfile.mockReset();
  submitForReview.mockReset();
  authUpdateProfile.mockReset();
  upsertExpertPayoutMethod.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  getMyProfile.mockResolvedValue(draftlessProfile);
  updateMyProfile.mockResolvedValue({ success: true, data: {} });
});

describe("ExpertOnboardingPage — loading and status gating", () => {
  it("shows step 1 once the profile check resolves with no existing draft", async () => {
    render(<ExpertOnboardingPage />);

    expect(await screen.findByText(/Step 1 of 5/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Jane Expert");
  });

  it("redirects to the dashboard when the profile is already approved", async () => {
    getMyProfile.mockResolvedValue({ success: true, data: { verificationStatus: "APPROVED" } });
    render(<ExpertOnboardingPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/expert/dashboard");
    });
  });

  it("shows the pending-review screen when the profile is already submitted", async () => {
    getMyProfile.mockResolvedValue({ success: true, data: { verificationStatus: "PENDING" } });
    render(<ExpertOnboardingPage />);

    expect(await screen.findByText("Profile Under Review")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("jumps to step 1 and preloads a rejected draft's saved fields", async () => {
    getMyProfile.mockResolvedValue({
      success: true,
      data: {
        verificationStatus: "REJECTED",
        bio: "Previously saved bio text goes here for review.",
        achievements: "State champion",
        sports: ["Tennis"],
        expertise: ["Technical Coaching"],
      },
    });
    render(<ExpertOnboardingPage />);

    expect(await screen.findByLabelText(/^Bio/)).toHaveValue(
      "Previously saved bio text goes here for review."
    );
  });
});

describe("ExpertOnboardingPage — step 1: identity", () => {
  it("blocks continuing when there is no name to pre-fill", async () => {
    // A sync effect re-fills `name` from the account whenever it's empty
    // (`if (user?.name && !name) setName(user.name)`), so clearing the field
    // with a signed-in user doesn't reach an empty-name state — it only
    // happens when there is no account name at all to sync from.
    mockUser = null;
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);

    clickContinue();

    expect(toastError).toHaveBeenCalledWith("Name is required");
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
  });

  it("blocks continuing when bio and achievements are still empty", async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);

    // Name pre-fills from the account, so with nothing else typed the very
    // next unmet requirement is the bio, not the name.
    clickContinue();

    expect(toastError).toHaveBeenCalledWith("Bio must be at least 20 characters");
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
  });

  it("requires the bio to be at least 20 characters", async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Jane Expert" } });
    fireEvent.change(screen.getByLabelText(/^Bio/), { target: { value: "Too short" } });
    fireEvent.change(screen.getByLabelText(/^Achievements/), { target: { value: "Something" } });
    clickContinue();

    expect(toastError).toHaveBeenCalledWith("Bio must be at least 20 characters");
  });

  it("advances to step 2 once every field is valid, saving a draft along the way", async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);

    fillStep1();
    clickContinue();

    expect(await screen.findByText(/Step 2 of 5/)).toBeInTheDocument();
    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({ bio: expect.stringContaining("professional biography") })
      );
    });
  });

  it("updates the account name via authApi when it differs from the stored user name", async () => {
    authUpdateProfile.mockResolvedValue({ success: true, data: { name: "Jane E. Expert" } });
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Jane E. Expert" } });
    fireEvent.change(screen.getByLabelText(/^Bio/), {
      target: { value: "A long and detailed professional biography for review." },
    });
    fireEvent.change(screen.getByLabelText(/^Achievements/), {
      target: { value: "National champion 2018" },
    });
    clickContinue();

    await waitFor(() => {
      expect(authUpdateProfile).toHaveBeenCalledWith({ name: "Jane E. Expert" });
    });
    expect(setUserMock).toHaveBeenCalledWith({ name: "Jane E. Expert" });
  });
});

describe("ExpertOnboardingPage — step 2: expertise", () => {
  const toStep2 = async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);
    fillStep1();
    clickContinue();
    await screen.findByText(/Step 2 of 5/);
  };

  it("requires at least one sport and one expertise tag", async () => {
    await toStep2();

    clickContinue();
    expect(toastError).toHaveBeenCalledWith("Select at least one sport");

    fireEvent.click(screen.getByRole("button", { name: "Add sport" }));
    clickContinue();
    expect(toastError).toHaveBeenCalledWith("Add at least one expertise tag");
  });

  it("advances to step 3 once both are set", async () => {
    await toStep2();

    fireEvent.click(screen.getByRole("button", { name: "Add sport" }));
    fireEvent.click(screen.getByRole("button", { name: "Add expertise" }));
    clickContinue();

    expect(await screen.findByText(/Step 3 of 5/)).toBeInTheDocument();
  });
});

describe("ExpertOnboardingPage — step 3: session setup", () => {
  const toStep3 = async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);
    fillStep1();
    clickContinue();
    await screen.findByText(/Step 2 of 5/);
    fireEvent.click(screen.getByRole("button", { name: "Add sport" }));
    fireEvent.click(screen.getByRole("button", { name: "Add expertise" }));
    clickContinue();
    await screen.findByText(/Step 3 of 5/);
  };

  it("requires a positive session fee", async () => {
    await toStep3();

    clickContinue();
    expect(toastError).toHaveBeenCalledWith("Enter a valid session fee");
  });

  it("requires an address when the session mode is in-person or both", async () => {
    await toStep3();

    fireEvent.change(screen.getByLabelText(/Session Fee/), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("radio", { name: /In-person/ }));
    clickContinue();

    expect(toastError).toHaveBeenCalledWith("In-person address is required");
  });

  it("advances to step 4 for a valid online session", async () => {
    await toStep3();

    fireEvent.change(screen.getByLabelText(/Session Fee/), { target: { value: "1500" } });
    clickContinue();

    expect(await screen.findByText(/Step 4 of 5/)).toBeInTheDocument();
  });
});

describe("ExpertOnboardingPage — step 4: availability", () => {
  const toStep4 = async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);
    fillStep1();
    clickContinue();
    await screen.findByText(/Step 2 of 5/);
    fireEvent.click(screen.getByRole("button", { name: "Add sport" }));
    fireEvent.click(screen.getByRole("button", { name: "Add expertise" }));
    clickContinue();
    await screen.findByText(/Step 3 of 5/);
    fireEvent.change(screen.getByLabelText(/Session Fee/), { target: { value: "1500" } });
    clickContinue();
    await screen.findByText(/Step 4 of 5/);
  };

  it("blocks continuing when a window's end time is not after its start", async () => {
    await toStep4();

    fireEvent.click(screen.getByRole("button", { name: "Add availability slot for Mon" }));
    fireEvent.change(screen.getByLabelText("Mon slot 1 end time"), { target: { value: "08:00" } });
    clickContinue();

    expect(toastError).toHaveBeenCalledWith("Invalid time range on Mon");
    expect(screen.getByText(/Step 4 of 5/)).toBeInTheDocument();
  });

  it("adds and removes a blackout date", async () => {
    await toStep4();

    fireEvent.change(screen.getByLabelText("Blackout date"), { target: { value: "2027-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("2027-01-01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove blackout date 2027-01-01" }));
    expect(screen.queryByText("2027-01-01")).not.toBeInTheDocument();
  });

  it("advances to step 5 (skipping availability is allowed)", async () => {
    await toStep4();

    clickContinue();

    expect(await screen.findByText(/Step 5 of 5/)).toBeInTheDocument();
  });
});

describe("ExpertOnboardingPage — step 5: submission", () => {
  const toStep5 = async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);
    fillStep1();
    clickContinue();
    await screen.findByText(/Step 2 of 5/);
    fireEvent.click(screen.getByRole("button", { name: "Add sport" }));
    fireEvent.click(screen.getByRole("button", { name: "Add expertise" }));
    clickContinue();
    await screen.findByText(/Step 3 of 5/);
    fireEvent.change(screen.getByLabelText(/Session Fee/), { target: { value: "1500" } });
    clickContinue();
    await screen.findByText(/Step 4 of 5/);
    clickContinue();
    await screen.findByText(/Step 5 of 5/);
  };

  it("blocks submission until the partner terms are accepted", async () => {
    await toStep5();
    fireEvent.click(screen.getByRole("button", { name: "Fill valid tax and payout info" }));

    fireEvent.click(screen.getByRole("button", { name: /Submit for Review/i }));

    expect(toastError).toHaveBeenCalledWith("Please accept the Partner Terms to submit for review");
    expect(submitForReview).not.toHaveBeenCalled();
  });

  it("blocks submission when the tax/payout info is invalid", async () => {
    await toStep5();
    fireEvent.click(screen.getByRole("checkbox")); // agree to terms first
    fireEvent.click(screen.getByRole("button", { name: /Submit for Review/i }));

    expect(toastError).toHaveBeenCalledWith("PAN number is required");
    expect(submitForReview).not.toHaveBeenCalled();
  });

  it("submits successfully once terms are accepted and payout info is valid", async () => {
    upsertExpertPayoutMethod.mockResolvedValue({ success: true });
    submitForReview.mockResolvedValue({ success: true });
    await toStep5();

    fireEvent.click(screen.getByRole("button", { name: "Fill valid tax and payout info" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Submit for Review/i }));

    await waitFor(() => {
      expect(upsertExpertPayoutMethod).toHaveBeenCalledWith({
        type: "UPI",
        upiId: "expert@okaxis",
      });
    });
    expect(submitForReview).toHaveBeenCalled();
    expect(await screen.findByText("Profile Under Review")).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Profile submitted for review.");
  });

  it("stops before submitting for review when saving the payout method fails", async () => {
    upsertExpertPayoutMethod.mockResolvedValue({ success: false, message: "Bad IFSC" });
    await toStep5();

    fireEvent.click(screen.getByRole("button", { name: "Fill valid tax and payout info" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Submit for Review/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Bad IFSC");
    });
    expect(submitForReview).not.toHaveBeenCalled();
  });
});

describe("ExpertOnboardingPage — step navigation", () => {
  it("lets the user go back a step without losing entered data", async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);
    fillStep1();
    clickContinue();
    await screen.findByText(/Step 2 of 5/);

    // Exact match: a completed step indicator's aria-label ("...go back to
    // this step") also contains the word "back" and would match a regex.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText(/Step 1 of 5/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Jane Expert");
  });

  it("does not let a click jump forward past an incomplete step", async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);

    const step2Indicator = screen.getByRole("button", { name: /Step 2: Expertise/ });
    expect(step2Indicator).toBeDisabled();
  });

  it("lets a click jump back to an already-completed step", async () => {
    render(<ExpertOnboardingPage />);
    await screen.findByText(/Step 1 of 5/);
    fillStep1();
    clickContinue();
    await screen.findByText(/Step 2 of 5/);

    fireEvent.click(screen.getByRole("button", { name: /Step 1: Your Identity/ }));

    expect(await screen.findByText(/Step 1 of 5/)).toBeInTheDocument();
  });
});
