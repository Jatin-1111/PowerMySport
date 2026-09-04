// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCoachOnboardingFlow } from "@/modules/admin/hooks/useCoachOnboardingFlow";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

const createCoach = vi.fn();
const updateCoach = vi.fn();
const getCoachVerificationUploadUrl = vi.fn();
const submitCoachVerificationAdmin = vi.fn();
const approveCoachVerification = vi.fn();
vi.mock("@/modules/admin/services/admin", () => ({
  adminApi: {
    createCoach: (...args: unknown[]) => createCoach(...args),
    updateCoach: (...args: unknown[]) => updateCoach(...args),
    getCoachVerificationUploadUrl: (...args: unknown[]) => getCoachVerificationUploadUrl(...args),
    submitCoachVerificationAdmin: (...args: unknown[]) => submitCoachVerificationAdmin(...args),
    approveCoachVerification: (...args: unknown[]) => approveCoachVerification(...args),
  },
}));

vi.mock("@/modules/geo/services/geo", () => ({
  geoApi: { autocomplete: vi.fn().mockResolvedValue([]) },
}));

const uploadFileToPresignedUrl = vi.fn();
vi.mock("@/modules/onboarding/services/onboarding", () => ({
  uploadFileToPresignedUrl: (...args: unknown[]) => uploadFileToPresignedUrl(...args),
}));

type Hook = ReturnType<typeof useCoachOnboardingFlow>;

/** Fills step-1 fields directly via the hook's own setters, bypassing DOM
 * input simulation since these are hook-level tests, not component tests. */
function fillStep1(result: { current: Hook }) {
  act(() => {
    result.current.setFirstName("Jane");
    result.current.setLastName("Doe");
    result.current.setEmail("jane@example.com");
    result.current.setPhone("9876543210");
    result.current.setBio("Certified coach with over five years of experience.");
    result.current.setProfilePhotoUrl("https://cdn.example.com/photo.jpg");
  });
}

beforeEach(() => {
  toastError.mockReset();
  toastSuccess.mockReset();
  createCoach.mockReset();
  updateCoach.mockReset();
  getCoachVerificationUploadUrl.mockReset();
  submitCoachVerificationAdmin.mockReset();
  approveCoachVerification.mockReset();
  uploadFileToPresignedUrl.mockReset();
});

describe("useCoachOnboardingFlow — step 1 validation", () => {
  it("blocks advancing when required fields are missing", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());

    act(() => {
      result.current.handleContinueFromStep1();
    });

    expect(result.current.step).toBe(1);
    expect(result.current.errors.firstName).toBeTruthy();
    expect(result.current.errors.email).toBeTruthy();
    expect(result.current.errors.phone).toBeTruthy();
    expect(result.current.errors.bio).toBeTruthy();
    expect(result.current.errors.profilePhoto).toBeTruthy();
  });

  it("requires bio to be at least 20 characters even when non-empty", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());
    fillStep1(result);
    act(() => {
      result.current.setBio("too short");
    });

    act(() => {
      result.current.handleContinueFromStep1();
    });

    expect(result.current.errors.bio).toBe("Bio must be at least 20 characters");
  });

  it("rejects a phone number containing letters", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());
    fillStep1(result);
    act(() => {
      result.current.setPhone("98765abcde");
    });

    act(() => {
      result.current.handleContinueFromStep1();
    });

    expect(result.current.errors.phone).toBe("Please provide a valid phone number");
  });

  it("advances to step 2 once every field is valid", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());
    fillStep1(result);

    act(() => {
      result.current.handleContinueFromStep1();
    });

    expect(result.current.step).toBe(2);
  });
});

describe("useCoachOnboardingFlow — step 2 validation", () => {
  function toStep2(result: { current: Hook }) {
    fillStep1(result);
    act(() => {
      result.current.handleContinueFromStep1();
    });
  }

  it("requires at least one sport", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());
    toStep2(result);

    act(() => {
      result.current.handleContinueFromStep2();
    });

    expect(result.current.errors.sports).toBe("At least one sport is required");
    expect(result.current.step).toBe(2);
  });

  it("requires a base location and positive service radius for FREELANCE coaches", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());
    toStep2(result);

    act(() => {
      result.current.setSports(["Tennis"]);
      result.current.setHourlyRateInput("500");
      result.current.setServiceRadiusKmInput("0");
    });

    act(() => {
      result.current.handleContinueFromStep2();
    });

    expect(result.current.errors.baseLocation).toBe(
      "Base location is required for this service mode"
    );
    expect(result.current.errors.serviceRadiusKm).toBe("Service radius must be greater than 0");
  });

  it("does not require a base location for OWN_VENUE coaches, but does require venue details", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());
    toStep2(result);

    act(() => {
      result.current.setSports(["Tennis"]);
      result.current.setHourlyRateInput("500");
      result.current.setServiceMode("OWN_VENUE");
    });

    act(() => {
      result.current.handleContinueFromStep2();
    });

    expect(result.current.errors.baseLocation).toBeUndefined();
    expect(result.current.errors.venueName).toBe("Venue name is required");
    // Both venueAddressQuery and venueLocation are unset here, and the
    // second check in the OWN_VENUE branch unconditionally overwrites
    // venueAddress, so the surviving message is the location one.
    expect(result.current.errors.venueAddress).toBe("Select a venue location from suggestions");
  });

  it("advances to step 3 once every FREELANCE-mode field is valid", () => {
    const { result } = renderHook(() => useCoachOnboardingFlow());
    toStep2(result);

    act(() => {
      result.current.setSports(["Tennis"]);
      result.current.setPricingMode("SAME");
      result.current.setHourlyRateInput("500");
      result.current.setBaseLocation([77.5946, 12.9716]);
    });

    act(() => {
      result.current.handleContinueFromStep2();
    });

    expect(result.current.step).toBe(3);
  });
});

describe("useCoachOnboardingFlow — handleSubmit", () => {
  async function toReadyToSubmit(result: { current: Hook }) {
    fillStep1(result);
    act(() => {
      result.current.handleContinueFromStep1();
    });
    act(() => {
      result.current.setSports(["Tennis"]);
      result.current.setPricingMode("SAME");
      result.current.setHourlyRateInput("500");
      result.current.setBaseLocation([77.5946, 12.9716]);
    });
    act(() => {
      result.current.handleContinueFromStep2();
    });
  }

  it("creates the coach, approves verification, and reports success with no documents to upload", async () => {
    createCoach.mockResolvedValue({ success: true, data: { coach: { id: "coach-1" } } });
    approveCoachVerification.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCoachOnboardingFlow());
    await toReadyToSubmit(result);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(createCoach).toHaveBeenCalledTimes(1);
    expect(getCoachVerificationUploadUrl).not.toHaveBeenCalled();
    expect(approveCoachVerification).toHaveBeenCalledWith("coach-1");
    expect(result.current.successCoachId).toBe("coach-1");
    expect(result.current.successCoachLink).toBe("/admin/coach-verification/coach-1");
    expect(toastSuccess).toHaveBeenCalledWith("Coach onboarded and activated successfully");
  });

  it("surfaces the API error message and does not mark success on failure", async () => {
    createCoach.mockResolvedValue({ success: false, message: "Email already registered" });

    const { result } = renderHook(() => useCoachOnboardingFlow());
    await toReadyToSubmit(result);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(toastError).toHaveBeenCalledWith("Email already registered");
    expect(result.current.successCoachId).toBe("");
  });

  it("retries with convertExistingUser after a 409 conflict the admin confirms", async () => {
    const conflictError = {
      response: { status: 409, data: { requiresConversion: true } },
    };
    createCoach
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({ success: true, data: { coach: { id: "coach-2" } } });
    approveCoachVerification.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { result } = renderHook(() => useCoachOnboardingFlow());
    await toReadyToSubmit(result);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(createCoach).toHaveBeenCalledTimes(2);
    expect(createCoach).toHaveBeenLastCalledWith(
      expect.objectContaining({ convertExistingUser: true })
    );
    expect(result.current.successCoachId).toBe("coach-2");
  });

  it("uploads verification documents and submits them after coach creation", async () => {
    createCoach.mockResolvedValue({ success: true, data: { coach: { id: "coach-3" } } });
    getCoachVerificationUploadUrl.mockResolvedValue({
      success: true,
      data: {
        uploadUrl: "https://s3.example.com/upload",
        downloadUrl: "https://cdn.example.com/doc.pdf",
        key: "docs/coach-3/doc.pdf",
        fileName: "certificate.pdf",
      },
    });
    uploadFileToPresignedUrl.mockResolvedValue(undefined);
    submitCoachVerificationAdmin.mockResolvedValue({ success: true });
    approveCoachVerification.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCoachOnboardingFlow());
    await toReadyToSubmit(result);

    act(() => {
      result.current.addDocumentRow();
    });
    act(() => {
      result.current.handleDocumentSelect(
        0,
        new File(["dummy"], "certificate.pdf", { type: "application/pdf" })
      );
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(getCoachVerificationUploadUrl).toHaveBeenCalledWith(
      "coach-3",
      expect.objectContaining({ fileName: "certificate.pdf" })
    );
    expect(uploadFileToPresignedUrl).toHaveBeenCalledWith(
      expect.any(File),
      "https://s3.example.com/upload",
      "application/pdf"
    );
    expect(submitCoachVerificationAdmin).toHaveBeenCalledWith(
      "coach-3",
      expect.objectContaining({
        documents: [expect.objectContaining({ url: "https://cdn.example.com/doc.pdf" })],
      })
    );
    expect(approveCoachVerification).toHaveBeenCalledWith("coach-3");
  });
});
