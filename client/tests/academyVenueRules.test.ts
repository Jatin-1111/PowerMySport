import { describe, expect, it } from "vitest";
import {
  MIN_GENERAL_PHOTOS,
  MIN_SPORT_PHOTOS,
  createEmptyVenue,
  hasRealLocation,
  openingHoursProblem,
  paiseToRupees,
  photoFileProblem,
  photoProgress,
  rupeesToPaise,
  validateVenue,
  venueIsValid,
  venuesForSave,
  withSports,
} from "@/modules/onboarding/utils/academyVenueRules";
import type { AcademyVenueInput } from "@/modules/onboarding/types/academy";

const photos = (n: number, prefix = "p") =>
  Array.from({ length: n }, (_, i) => `https://example.test/${prefix}${i}.jpg`);

/** A venue that passes every rule. */
const validVenue = (): AcademyVenueInput => {
  const general = photos(MIN_GENERAL_PHOTOS, "g");
  return {
    ...createEmptyVenue(),
    name: "Main Courts",
    address: "5 Court Lane, Connaught Place",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    location: { type: "Point", coordinates: [77.21, 28.614] },
    sports: ["Tennis"],
    pricePerHour: 50000,
    generalImages: general,
    generalImageKeys: general.map((_, i) => `venues/a/images/g${i}.jpg`),
    sportImages: { Tennis: photos(MIN_SPORT_PHOTOS, "t") },
    sportImageKeys: { Tennis: photos(MIN_SPORT_PHOTOS, "tk") },
    coverPhotoUrl: general[0]!,
    coverPhotoKey: "venues/a/images/g0.jpg",
  };
};

describe("money", () => {
  it("turns rupees into paise exactly", () => {
    expect(rupeesToPaise(500)).toBe(50000);
    expect(rupeesToPaise("500")).toBe(50000);
    expect(rupeesToPaise("199.99")).toBe(19999);
    expect(rupeesToPaise(1)).toBe(100);
  });

  it("does not drift on awkward decimals", () => {
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise("1.005")).toBe(101);
  });

  it("gives 0 for empty, negative and non-numeric input", () => {
    expect(rupeesToPaise("")).toBe(0);
    expect(rupeesToPaise("abc")).toBe(0);
    expect(rupeesToPaise(-5)).toBe(0);
    expect(rupeesToPaise(Number.NaN)).toBe(0);
  });

  it("shows paise back as rupees, and blank when there is no price", () => {
    expect(paiseToRupees(50000)).toBe(500);
    expect(paiseToRupees(19999)).toBe(199.99);
    expect(paiseToRupees(0)).toBe("");
    expect(paiseToRupees(undefined)).toBe("");
  });
});

describe("location", () => {
  it("is not real for the empty placeholder", () => {
    expect(hasRealLocation(createEmptyVenue())).toBe(false);
  });
  it("is real once a map result is in", () => {
    expect(hasRealLocation(validVenue())).toBe(true);
  });
});

describe("photos", () => {
  it("counts general and per-sport photos", () => {
    const progress = photoProgress(validVenue());
    expect(progress.general).toEqual({ have: 3, need: 3 });
    expect(progress.sports.Tennis).toEqual({ have: 5, need: 5 });
    expect(progress.coverChosen).toBe(true);
    expect(progress.complete).toBe(true);
  });

  it("needs a full set for every sport the venue lists", () => {
    const venue = withSports(validVenue(), ["Tennis", "Badminton"]);
    const progress = photoProgress(venue);
    expect(progress.sports.Badminton).toEqual({ have: 0, need: 5 });
    expect(progress.complete).toBe(false);
  });

  it("keeps photos of sports that stay and drops the sets of sports that go", () => {
    const venue = withSports(withSports(validVenue(), ["Tennis", "Badminton"]), ["Badminton"]);
    expect(Object.keys(venue.sportImages)).toEqual(["Badminton"]);
    expect(venue.sportImageKeys.Tennis).toBeUndefined();
    const back = withSports(validVenue(), ["Tennis"]);
    expect(back.sportImages.Tennis).toHaveLength(MIN_SPORT_PHOTOS);
  });

  it("is not complete when the cover is not one of the general photos", () => {
    const venue = { ...validVenue(), coverPhotoUrl: "https://example.test/elsewhere.jpg" };
    expect(photoProgress(venue).coverChosen).toBe(false);
    expect(photoProgress(venue).complete).toBe(false);
  });

  it("refuses the wrong type and oversized files", () => {
    expect(photoFileProblem({ type: "image/jpeg", size: 1024 })).toBe("");
    expect(photoFileProblem({ type: "image/png", size: 1024 })).toBe("");
    expect(photoFileProblem({ type: "image/gif", size: 1024 })).toMatch(/JPG or PNG/);
    expect(photoFileProblem({ type: "application/pdf", size: 1024 })).toMatch(/JPG or PNG/);
    expect(photoFileProblem({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toMatch(
      /smaller than 5 MB/
    );
  });
});

describe("opening hours", () => {
  it("accepts the default hours", () => {
    expect(openingHoursProblem(validVenue().openingHours)).toBe("");
  });

  it("needs at least one open day", () => {
    const hours = validVenue().openingHours;
    for (const day of Object.keys(hours) as (keyof typeof hours)[]) hours[day] = { isOpen: false };
    expect(openingHoursProblem(hours)).toMatch(/at least one day/);
  });

  it("refuses a closing time at or before the opening time", () => {
    const hours = validVenue().openingHours;
    hours.monday = { isOpen: true, slots: [{ startTime: "18:00", endTime: "09:00" }] };
    expect(openingHoursProblem(hours)).toMatch(/closing time must be after/);
    hours.monday = { isOpen: true, slots: [{ startTime: "09:00", endTime: "09:00" }] };
    expect(openingHoursProblem(hours)).toMatch(/closing time must be after/);
  });

  it("refuses overlapping slots on a day", () => {
    const hours = validVenue().openingHours;
    hours.monday = {
      isOpen: true,
      slots: [
        { startTime: "06:00", endTime: "12:00" },
        { startTime: "11:00", endTime: "20:00" },
      ],
    };
    expect(openingHoursProblem(hours)).toMatch(/overlap/);
  });

  it("accepts a split day with a gap", () => {
    const hours = validVenue().openingHours;
    hours.monday = {
      isOpen: true,
      slots: [
        { startTime: "06:00", endTime: "11:00" },
        { startTime: "16:00", endTime: "21:00" },
      ],
    };
    expect(openingHoursProblem(hours)).toBe("");
  });

  it("falls back to open and close times when there are no slots", () => {
    const hours = validVenue().openingHours;
    hours.monday = { isOpen: true, openTime: "10:00", closeTime: "09:00" };
    expect(openingHoursProblem(hours)).toMatch(/closing time must be after/);
    hours.monday = { isOpen: true };
    expect(openingHoursProblem(hours)).toMatch(/Add opening times/);
  });
});

describe("validateVenue", () => {
  it("passes a complete venue", () => {
    expect(validateVenue(validVenue())).toEqual({});
    expect(venueIsValid(validVenue())).toBe(true);
  });

  it("fails an empty venue on every required field", () => {
    const errors = validateVenue(createEmptyVenue());
    expect(errors.name).toBeTruthy();
    expect(errors.address).toBeTruthy();
    expect(errors.city).toBeTruthy();
    expect(errors.state).toBeTruthy();
    expect(errors.pincode).toBeTruthy();
    expect(errors.sports).toBeTruthy();
    expect(errors.price).toBeTruthy();
    expect(errors.generalPhotos).toMatch(/Add 3 more general photos/);
  });

  it("asks for the address to be picked from the map when only text was typed", () => {
    const venue = { ...validVenue(), location: createEmptyVenue().location };
    expect(validateVenue(venue).location).toMatch(/Pick the address/);
  });

  it("accepts the state in any spelling the server would normalise, and refuses unknown ones", () => {
    expect(validateVenue({ ...validVenue(), state: "jammu & kashmir" }).state).toBeUndefined();
    expect(validateVenue({ ...validVenue(), state: "Atlantis" }).state).toBeTruthy();
  });

  it("refuses a pincode that is not six digits", () => {
    for (const pincode of ["1100", "1100011", "11000a", ""]) {
      expect(validateVenue({ ...validVenue(), pincode }).pincode).toBeTruthy();
    }
  });

  it("refuses a price under one rupee", () => {
    expect(validateVenue({ ...validVenue(), pricePerHour: 99 }).price).toBeTruthy();
    expect(validateVenue({ ...validVenue(), pricePerHour: 100 }).price).toBeUndefined();
  });

  it("names the sport that still needs photos", () => {
    const venue = withSports(validVenue(), ["Tennis", "Badminton"]);
    expect(validateVenue(venue).sportPhotos).toEqual({ Badminton: "Add 5 more Badminton photos" });
  });

  it("says singular when one photo is missing", () => {
    const venue = { ...validVenue(), generalImages: photos(2, "g"), generalImageKeys: ["a", "b"] };
    expect(validateVenue(venue).generalPhotos).toBe("Add 1 more general photo");
  });

  it("asks for a cover once the general photos are in", () => {
    expect(validateVenue({ ...validVenue(), coverPhotoUrl: "" }).cover).toBeTruthy();
  });

  it("limits the description", () => {
    expect(
      validateVenue({ ...validVenue(), description: "x".repeat(501) }).description
    ).toBeTruthy();
    expect(
      validateVenue({ ...validVenue(), description: "x".repeat(500) }).description
    ).toBeUndefined();
  });
});

describe("venuesForSave", () => {
  it("trims text and writes the canonical state name", () => {
    const [saved] = venuesForSave([
      { ...validVenue(), name: "  Main Courts ", state: "jammu & kashmir", city: " Srinagar " },
    ]);
    expect(saved!.name).toBe("Main Courts");
    expect(saved!.city).toBe("Srinagar");
    expect(saved!.state).toBe("Jammu and Kashmir");
  });
});
