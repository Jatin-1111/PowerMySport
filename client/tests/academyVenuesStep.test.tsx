// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Step 4 of academy sign-up, driven the way an owner does it: type, pick the
// address from the map results, set a price in rupees, choose a sport, add the
// photos, save. The network is faked at the service edge; the rules and the form
// are real.

const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));

const autocomplete = vi.hoisted(() => vi.fn());
vi.mock("@/modules/geo/services/geo", () => ({ geoApi: { autocomplete } }));

const uploadVenuePhoto = vi.hoisted(() => vi.fn());
vi.mock("@/modules/onboarding/services/academy", () => ({
  academyOnboardingApi: { uploadVenuePhoto },
}));

// The real picker loads sports from the API; here it is a button per sport.
vi.mock("@/modules/sports/components/SportsMultiSelect", () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (s: string[]) => void }) => (
    <div>
      {["Tennis", "Badminton"].map((sport) => (
        <button
          key={sport}
          type="button"
          aria-pressed={value.includes(sport)}
          onClick={() =>
            onChange(value.includes(sport) ? value.filter((s) => s !== sport) : [...value, sport])
          }
        >
          {`Sport ${sport}`}
        </button>
      ))}
    </div>
  ),
}));

import Step4Venues from "@/modules/onboarding/components/academy/Step4Venues";

const suggestion = {
  label: "5 Court Lane, Connaught Place, New Delhi",
  lat: 28.614,
  lon: 77.21,
  placeId: "place-1",
  city: "New Delhi",
  state: "Delhi",
  pincode: "110001",
};

const photo = (name = "p.jpg", type = "image/jpeg") =>
  new File([new Uint8Array(1024)], name, { type });

let uploadCount = 0;

beforeEach(() => {
  toastError.mockReset();
  autocomplete.mockReset().mockResolvedValue([suggestion]);
  uploadCount = 0;
  uploadVenuePhoto.mockReset().mockImplementation(async () => {
    uploadCount += 1;
    return {
      url: `https://img.example.test/${uploadCount}.jpg`,
      key: `venues/academy-1/images/${uploadCount}.jpg`,
    };
  });
});

const renderStep = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<Step4Venues academyId="academy-1" onSubmit={onSubmit} />);
  return onSubmit;
};

const chooseFiles = async (label: RegExp, count: number) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: Array.from({ length: count }, (_, i) => photo(`p${i}.jpg`)) },
  });
};

/** Fills every field and every photo slot of one Tennis venue. */
const fillValidVenue = async () => {
  fireEvent.change(screen.getByLabelText("Venue name"), { target: { value: "Main Courts" } });

  fireEvent.change(screen.getByLabelText("Address"), { target: { value: "5 Court" } });
  fireEvent.click(await screen.findByRole("button", { name: suggestion.label }));

  fireEvent.change(screen.getByLabelText("Price per hour (₹)"), { target: { value: "500" } });
  fireEvent.click(screen.getByRole("button", { name: "Sport Tennis" }));

  await chooseFiles(/Choose photos for General photos/, 3);
  await waitFor(() => expect(screen.getByText("3 of 3 added", { selector: "p" })).toBeTruthy());

  await chooseFiles(/Choose photos for Tennis photos/, 5);
  await waitFor(() => expect(screen.getAllByText("5 of 5 added").length).toBe(1));
};

describe("Step 4 venues", () => {
  it("does not save an empty form, and says what is missing", async () => {
    const onSubmit = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("Enter the venue name")).toBeTruthy();
    expect(screen.getByText("Search for the venue address")).toBeTruthy();
    expect(screen.getByText("Choose at least one sport")).toBeTruthy();
    expect(screen.getByText("Price per hour must be at least ₹1")).toBeTruthy();
    expect(screen.getByText("Add 3 more general photos")).toBeTruthy();
    expect(toastError).toHaveBeenCalled();
  });

  it("saves a complete venue in the shape the server wants, with the price in paise", async () => {
    const onSubmit = renderStep();
    await fillValidVenue();

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const { academyVenues } = onSubmit.mock.calls[0]![0];
    expect(academyVenues).toHaveLength(1);
    const venue = academyVenues[0];
    expect(venue.name).toBe("Main Courts");
    expect(venue.address).toBe(suggestion.label);
    expect(venue.city).toBe("New Delhi");
    expect(venue.state).toBe("Delhi");
    expect(venue.pincode).toBe("110001");
    expect(venue.location).toEqual({ type: "Point", coordinates: [77.21, 28.614] });
    expect(venue.placeId).toBe("place-1");
    expect(venue.pricePerHour).toBe(50000);
    expect(venue.sports).toEqual(["Tennis"]);
    expect(venue.generalImages).toHaveLength(3);
    expect(venue.generalImageKeys).toHaveLength(3);
    expect(venue.sportImages.Tennis).toHaveLength(5);
    expect(venue.sportImageKeys.Tennis).toHaveLength(5);
    // The first general photo is the cover until another is chosen.
    expect(venue.coverPhotoUrl).toBe(venue.generalImages[0]);
    expect(venue.coverPhotoKey).toBe(venue.generalImageKeys[0]);
  });

  it("makes the owner pick the address again if they edit it after picking", async () => {
    renderStep();
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "5 Court" } });
    fireEvent.click(await screen.findByRole("button", { name: suggestion.label }));
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: `${suggestion.label} extra` },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Pick the address from the search results")).toBeTruthy();
  });

  it("asks for a full set of photos for each extra sport", async () => {
    const onSubmit = renderStep();
    await fillValidVenue();
    fireEvent.click(screen.getByRole("button", { name: "Sport Badminton" }));

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Add 5 more Badminton photos")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows an upload failure and does not count that photo", async () => {
    uploadVenuePhoto.mockRejectedValueOnce(
      new Error("The upload failed. Check your connection and try again.")
    );
    renderStep();
    await chooseFiles(/Choose photos for General photos/, 1);

    expect(await screen.findByText(/The upload failed/)).toBeTruthy();
    expect(screen.getByText("0 of 3 added")).toBeTruthy();
  });

  it("keeps going when one of several photos fails, and reports which", async () => {
    uploadVenuePhoto
      .mockResolvedValueOnce({
        url: "https://img.example.test/a.jpg",
        key: "venues/academy-1/images/a.jpg",
      })
      .mockRejectedValueOnce(new Error("Use a JPG or PNG photo"))
      .mockResolvedValueOnce({
        url: "https://img.example.test/c.jpg",
        key: "venues/academy-1/images/c.jpg",
      });
    renderStep();
    await chooseFiles(/Choose photos for General photos/, 3);

    await waitFor(() => expect(screen.getByText("2 of 3 added")).toBeTruthy());
    expect(screen.getByText(/p1\.jpg: Use a JPG or PNG photo/)).toBeTruthy();
  });

  it("removes a photo and moves the cover to the next one", async () => {
    renderStep();
    await chooseFiles(/Choose photos for General photos/, 2);
    await waitFor(() => expect(screen.getByText("2 of 3 added")).toBeTruthy());

    const first = screen.getByAltText("General photos, photo 1");
    const second = screen.getByAltText("General photos, photo 2");
    expect(first.closest("li")!.textContent).toContain("Cover");

    fireEvent.click(screen.getByRole("button", { name: "Remove photo 1 from General photos" }));
    await waitFor(() => expect(screen.getByText("1 of 3 added")).toBeTruthy());
    const remaining = screen.getByAltText("General photos, photo 1");
    expect(remaining.getAttribute("src")).toBe(second.getAttribute("src"));
    expect(remaining.closest("li")!.textContent).toContain("Cover");
  });

  it("lets the owner choose a different cover", async () => {
    renderStep();
    await chooseFiles(/Choose photos for General photos/, 2);
    await waitFor(() => expect(screen.getByText("2 of 3 added")).toBeTruthy());

    const second = screen.getByAltText("General photos, photo 2").closest("li")!;
    fireEvent.click(within(second).getByRole("button", { name: "Make cover" }));
    await waitFor(() => expect(second.textContent).toContain("Cover"));
  });

  it("types the price in rupees and never in paise", async () => {
    renderStep();
    const price = screen.getByLabelText("Price per hour (₹)") as HTMLInputElement;
    fireEvent.change(price, { target: { value: "199.99" } });
    expect(price.value).toBe("199.99");
    fireEvent.change(price, { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Price per hour must be at least ₹1")).toBeTruthy();
  });

  it("lets the owner add and remove venues", () => {
    renderStep();
    expect(screen.queryByRole("button", { name: "Remove venue" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add another venue" }));
    expect(screen.getAllByText(/^Venue \d$/).length).toBe(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove venue" })[0]!);
    expect(screen.getAllByText(/^Venue \d$/).length).toBe(1);
  });

  it("restores venues already saved, so Back does not lose them", () => {
    render(
      <Step4Venues
        academyId="academy-1"
        onSubmit={vi.fn()}
        previousData={{
          academyVenues: [
            {
              name: "Saved Court",
              address: "9 Saved Road",
              city: "Pune",
              state: "Maharashtra",
              pincode: "411001",
              location: { type: "Point", coordinates: [73.85, 18.52] },
              sports: [],
              pricePerHour: 75000,
              amenities: [],
              openingHours: {
                monday: { isOpen: true, slots: [{ startTime: "06:00", endTime: "20:00" }] },
                tuesday: { isOpen: false },
                wednesday: { isOpen: false },
                thursday: { isOpen: false },
                friday: { isOpen: false },
                saturday: { isOpen: false },
                sunday: { isOpen: false },
              },
              allowExternalCoaches: true,
              generalImages: [],
              generalImageKeys: [],
              sportImages: {},
              sportImageKeys: {},
              coverPhotoUrl: "",
            },
          ],
        }}
      />
    );
    expect((screen.getByLabelText("Venue name") as HTMLInputElement).value).toBe("Saved Court");
    expect((screen.getByLabelText("Price per hour (₹)") as HTMLInputElement).value).toBe("750");
    expect((screen.getByLabelText("State") as HTMLSelectElement).value).toBe("Maharashtra");
  });

  it("does not submit twice while a save is in flight", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderStep(onSubmit);
    await fillValidVenue();

    const save = screen.getByRole("button", { name: "Save and continue" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolve();
  });
});
