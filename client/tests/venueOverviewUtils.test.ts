import { describe, expect, it } from "vitest";
import {
  averageRating,
  bookingVenueName,
  describeVenueStatus,
  priceFromLabel,
  startingPrice,
  venueEarning,
  venueNeedingAttention,
} from "../src/modules/venue/utils/overview";
import type { Booking, Venue } from "../src/types";

const venue = (over: Record<string, unknown> = {}): Venue =>
  ({
    id: "v1",
    name: "Court One",
    sports: ["tennis"],
    pricePerHour: 800,
    amenities: [],
    description: "",
    images: [],
    allowExternalCoaches: false,
    ...over,
  }) as unknown as Venue;

describe("describeVenueStatus", () => {
  it("says nothing about a live venue", () => {
    const view = describeVenueStatus(venue({ lifecycle: "APPROVED" }));
    expect(view).toMatchObject({ tone: "live", tag: "Live", headline: null, action: null });
  });

  it("sends a draft back to onboarding", () => {
    const view = describeVenueStatus(venue({ lifecycle: "DRAFT" }));
    expect(view.action).toEqual({ label: "Continue setup", href: "/onboarding" });
  });

  it("offers no button while a venue is in review", () => {
    const view = describeVenueStatus(venue({ lifecycle: "SUBMITTED" }));
    expect(view.tag).toBe("In review");
    expect(view.action).toBeNull();
  });

  it("shows the reviewer's reason when a venue is not approved", () => {
    const view = describeVenueStatus(
      venue({ lifecycle: "REJECTED", rejectionReason: "Photos are too dark." })
    );
    expect(view.tone).toBe("alert");
    expect(view.body).toBe("Photos are too dark.");
    expect(view.action?.href).toBe("/venue-lister/inventory");
  });

  it("shows the reviewer's notes when more information is needed", () => {
    const view = describeVenueStatus(
      venue({ lifecycle: "NEEDS_INFO", reviewNotes: "Add your opening hours." })
    );
    expect(view.tag).toBe("Needs more information");
    expect(view.body).toBe("Add your opening hours.");
  });

  it("falls back to the older approval status when there is no lifecycle", () => {
    expect(describeVenueStatus(venue({ approvalStatus: "APPROVED" })).tag).toBe("Live");
    expect(describeVenueStatus(venue({ approvalStatus: "PENDING" })).tag).toBe("In review");
    expect(describeVenueStatus(venue({ approvalStatus: "REJECTED" })).tag).toBe("Not approved");
    expect(describeVenueStatus(venue({ approvalStatus: "REVIEW" })).tag).toBe(
      "Needs more information"
    );
  });
});

describe("venueNeedingAttention", () => {
  it("is null when every venue is live", () => {
    expect(venueNeedingAttention([venue({ lifecycle: "APPROVED" })])).toBeNull();
  });

  it("puts a problem the owner can fix ahead of one that is only waiting", () => {
    const waiting = venue({ id: "a", lifecycle: "SUBMITTED" });
    const rejected = venue({ id: "b", lifecycle: "REJECTED" });
    expect(venueNeedingAttention([waiting, rejected])?.id).toBe("b");
  });
});

describe("averageRating", () => {
  it("is null when nobody has reviewed", () => {
    expect(averageRating([venue(), venue({ rating: 0, reviewCount: 0 })])).toBeNull();
  });

  it("weights each venue by how many reviews it has", () => {
    const result = averageRating([
      venue({ rating: 5, reviewCount: 1 }),
      venue({ rating: 4, reviewCount: 3 }),
    ]);
    expect(result?.count).toBe(4);
    expect(result?.value).toBeCloseTo(4.25);
  });
});

describe("bookingVenueName", () => {
  const book = (over: Record<string, unknown>) => over as unknown as Booking;

  it("uses a populated venue first", () => {
    expect(bookingVenueName(book({ venue: { name: "Arena" }, venueId: "v1" }), [venue()])).toBe(
      "Arena"
    );
  });

  it("looks the venue up by id otherwise", () => {
    expect(bookingVenueName(book({ venueId: "v1" }), [venue()])).toBe("Court One");
  });

  it("never returns an empty title", () => {
    expect(bookingVenueName(book({ venueId: "missing" }), [venue()])).toBe("Your venue");
  });
});

describe("venueEarning", () => {
  it("is the venue's own payment line when there is one", () => {
    const booking = {
      totalAmount: 1000,
      payments: [
        { userType: "Player", amount: 1000 },
        { userType: "VenueLister", amount: 900 },
      ],
    } as unknown as Booking;
    expect(venueEarning(booking)).toBe(900);
  });

  it("falls back to the booking total", () => {
    expect(venueEarning({ totalAmount: 1000 } as unknown as Booking)).toBe(1000);
  });
});

describe("prices", () => {
  it("starts from the cheapest sport", () => {
    expect(startingPrice(venue({ pricePerHour: 800, sportPricing: { squash: 600 } }))).toBe(600);
  });

  it("says so when no price is set", () => {
    expect(priceFromLabel(venue({ pricePerHour: 0 }))).toBe("No price set");
    expect(priceFromLabel(venue({ pricePerHour: 1500 }))).toBe("From ₹1,500 an hour");
  });
});
