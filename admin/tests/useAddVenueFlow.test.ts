// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAddVenueFlow } from "@/modules/admin/hooks/useAddVenueFlow";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

const createVenue = vi.fn();
const updateVenue = vi.fn();
vi.mock("@/modules/admin/services/admin", () => ({
  adminApi: {
    createVenue: (...args: unknown[]) => createVenue(...args),
    updateVenue: (...args: unknown[]) => updateVenue(...args),
  },
}));

vi.mock("@/modules/geo/services/geo", () => ({
  geoApi: { autocomplete: vi.fn().mockResolvedValue([]) },
}));

const validLocation = {
  type: "Point" as const,
  coordinates: [77.5946, 12.9716] as [number, number],
};

/** Fills step-1 fields directly via the hook's own setter, bypassing DOM
 * input simulation since these are hook-level tests, not component tests. */
function fillStep1(result: { current: ReturnType<typeof useAddVenueFlow> }) {
  act(() => {
    result.current.setFormData((prev) => ({
      ...prev,
      ownerName: "Jane Owner",
      ownerEmail: "jane@example.com",
      ownerPhone: "9876543210",
      name: "Downtown Courts",
      address: "123 Main St",
      location: validLocation,
    }));
  });
}

beforeEach(() => {
  pushMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  createVenue.mockReset();
  updateVenue.mockReset();
});

describe("useAddVenueFlow — step 1 validation", () => {
  it("blocks advancing past step 1 when required fields are missing", () => {
    const { result } = renderHook(() => useAddVenueFlow());

    act(() => {
      result.current.handleNextFromStep1();
    });

    expect(result.current.currentStep).toBe(1);
    expect(result.current.errors.ownerName).toBeTruthy();
    expect(result.current.errors.ownerEmail).toBeTruthy();
    expect(result.current.errors.ownerPhone).toBeTruthy();
    expect(result.current.errors.name).toBeTruthy();
    expect(result.current.errors.address).toBeTruthy();
  });

  it("rejects a malformed owner email", () => {
    const { result } = renderHook(() => useAddVenueFlow());
    fillStep1(result);
    act(() => {
      result.current.setFormData((prev) => ({ ...prev, ownerEmail: "not-an-email" }));
    });

    act(() => {
      result.current.handleNextFromStep1();
    });

    expect(result.current.currentStep).toBe(1);
    expect(result.current.errors.ownerEmail).toBe("Enter a valid email address");
  });

  it("rejects a phone number with fewer than 10 digits", () => {
    const { result } = renderHook(() => useAddVenueFlow());
    fillStep1(result);
    act(() => {
      result.current.setFormData((prev) => ({ ...prev, ownerPhone: "12345" }));
    });

    act(() => {
      result.current.handleNextFromStep1();
    });

    expect(result.current.errors.ownerPhone).toBe(
      "Owner mobile number must have at least 10 digits"
    );
  });

  it("requires a resolved location, not just address text", () => {
    const { result } = renderHook(() => useAddVenueFlow());
    fillStep1(result);
    act(() => {
      result.current.setFormData((prev) => ({ ...prev, location: null }));
    });

    act(() => {
      result.current.handleNextFromStep1();
    });

    expect(result.current.errors.address).toBe("Please select a valid address from suggestions");
  });

  it("advances to step 2 once every required field is valid", () => {
    const { result } = renderHook(() => useAddVenueFlow());
    fillStep1(result);

    act(() => {
      result.current.handleNextFromStep1();
    });

    expect(result.current.currentStep).toBe(2);
  });
});

describe("useAddVenueFlow — step 2 validation and pricing", () => {
  function toStep2(result: { current: ReturnType<typeof useAddVenueFlow> }) {
    fillStep1(result);
    act(() => {
      result.current.handleNextFromStep1();
    });
  }

  it("requires at least one sport", async () => {
    const { result } = renderHook(() => useAddVenueFlow());
    toStep2(result);

    act(() => {
      result.current.handleBasePriceChange(500);
    });

    await act(async () => {
      await result.current.handleNextFromStep2();
    });

    expect(result.current.errors.sports).toBe("At least one sport is required");
    expect(result.current.currentStep).toBe(2);
  });

  it("propagates the shared base price to every selected sport", () => {
    const { result } = renderHook(() => useAddVenueFlow());
    toStep2(result);

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, sports: ["Tennis", "Badminton"] }));
    });
    act(() => {
      result.current.handleBasePriceChange(500);
    });

    expect(result.current.formData.sportPricing).toEqual({ Tennis: 500, Badminton: 500 });
  });

  it("requires a per-sport price for every sport when pricing differs by sport", async () => {
    const { result } = renderHook(() => useAddVenueFlow());
    toStep2(result);

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, sports: ["Tennis", "Badminton"] }));
      result.current.toggleSamePriceMode(false);
    });
    act(() => {
      result.current.handleSportPriceChange("Tennis", 400);
    });

    await act(async () => {
      await result.current.handleNextFromStep2();
    });

    expect(result.current.errors.sportPricing).toBe("Please enter valid price for Badminton");
  });

  it("creates a draft venue and advances to step 3 once valid", async () => {
    createVenue.mockResolvedValue({ success: true, data: { id: "venue-1" } });
    const { result } = renderHook(() => useAddVenueFlow());
    toStep2(result);

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, sports: ["Tennis"] }));
      result.current.handleBasePriceChange(500);
    });

    await act(async () => {
      await result.current.handleNextFromStep2();
    });

    expect(createVenue).toHaveBeenCalledTimes(1);
    expect(result.current.venueId).toBe("venue-1");
    expect(result.current.currentStep).toBe(3);
  });

  it("surfaces a toast and does not advance when draft creation fails", async () => {
    createVenue.mockResolvedValue({ success: false, message: "Owner email already in use" });
    const { result } = renderHook(() => useAddVenueFlow());
    toStep2(result);

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, sports: ["Tennis"] }));
      result.current.handleBasePriceChange(500);
    });

    await act(async () => {
      await result.current.handleNextFromStep2();
    });

    expect(toastError).toHaveBeenCalledWith("Owner email already in use");
    expect(result.current.currentStep).toBe(2);
  });
});

describe("useAddVenueFlow — handlePublish", () => {
  async function toReadyToPublish(result: { current: ReturnType<typeof useAddVenueFlow> }) {
    fillStep1(result);
    act(() => {
      result.current.handleNextFromStep1();
    });
    act(() => {
      result.current.setFormData((prev) => ({ ...prev, sports: ["Tennis"] }));
      result.current.handleBasePriceChange(500);
    });
    createVenue.mockResolvedValue({ success: true, data: { id: "venue-1" } });
    await act(async () => {
      await result.current.handleNextFromStep2();
    });
    createVenue.mockClear();
  }

  it("publishes successfully and redirects to the venues list", async () => {
    updateVenue.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAddVenueFlow());
    await toReadyToPublish(result);

    await act(async () => {
      await result.current.handlePublish();
    });

    expect(updateVenue).toHaveBeenCalledWith(
      "venue-1",
      expect.objectContaining({ name: "Downtown Courts" })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Venue created successfully!");
    expect(pushMock).toHaveBeenCalledWith("/admin/venues");
  });

  it("retries with convertExistingUser after a 409 conflict the admin confirms", async () => {
    const conflictError = {
      response: {
        status: 409,
        data: { requiresConversion: true, message: "Owner already has an account." },
      },
    };
    updateVenue.mockRejectedValueOnce(conflictError).mockResolvedValueOnce({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { result } = renderHook(() => useAddVenueFlow());
    await toReadyToPublish(result);

    await act(async () => {
      await result.current.handlePublish();
    });

    expect(updateVenue).toHaveBeenCalledTimes(2);
    expect(updateVenue).toHaveBeenLastCalledWith(
      "venue-1",
      expect.objectContaining({ convertExistingUser: true })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Venue created successfully!");
  });

  it("does not retry when the admin declines the conversion confirm dialog", async () => {
    const conflictError = {
      response: { status: 409, data: { requiresConversion: true } },
    };
    updateVenue.mockRejectedValueOnce(conflictError);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    const { result } = renderHook(() => useAddVenueFlow());
    await toReadyToPublish(result);

    await act(async () => {
      await result.current.handlePublish();
    });

    expect(updateVenue).toHaveBeenCalledTimes(1);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
