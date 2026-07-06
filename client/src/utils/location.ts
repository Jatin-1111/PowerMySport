import type { IOwnVenueDetails } from "@/types";

type OwnVenueLocationDetails = Pick<
  IOwnVenueDetails,
  "name" | "address" | "location"
>;

export interface OwnVenueLocationDisplay {
  title: string;
  description: string;
  mapsUrl?: string;
}

export const formatCoordinatesLabel = (
  coordinates?: [number, number] | null,
): string => {
  if (!coordinates || coordinates.length < 2) {
    return "";
  }

  const [longitude, latitude] = coordinates;

  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return "";
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};

export const getOwnVenueLocationDisplay = (
  details?: OwnVenueLocationDetails | null,
): OwnVenueLocationDisplay | null => {
  if (!details) {
    return null;
  }

  const title = details.name?.trim() || "Own Venue";
  const address = details.address?.trim();
  const coordinateLabel = formatCoordinatesLabel(details.location?.coordinates);
  const description = address || coordinateLabel;

  if (!description) {
    return {
      title,
      description: "Location on file",
    };
  }

  const display: OwnVenueLocationDisplay = {
    title,
    description,
  };

  const mapsQuery = address || coordinateLabel;
  if (mapsQuery) {
    display.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      mapsQuery,
    )}`;
  }

  return display;
};
