import { Venue, VenueDocument } from "../models/Venue";

export interface CreateVenuePayload {
  name: string;
  ownerId: string;
  location: string;
  sports: string[];
  pricePerHour: number;
  amenities?: string[];
  description?: string;
  images?: string[];
}

export const createVenue = async (
  payload: CreateVenuePayload,
): Promise<VenueDocument> => {
  const venue = new Venue(payload);
  await venue.save();
  return venue;
};

export const getVenueById = async (
  id: string,
): Promise<VenueDocument | null> => {
  return Venue.findById(id).populate("ownerId");
};

export const getVenuesByOwner = async (
  ownerId: string,
): Promise<VenueDocument[]> => {
  return Venue.find({ ownerId });
};

export const getAllVenues = async (filters?: {
  sports?: string[];
  location?: string;
}): Promise<VenueDocument[]> => {
  const query: any = {};

  if (filters?.sports && filters.sports.length > 0) {
    query.sports = { $in: filters.sports };
  }

  if (filters?.location) {
    query.location = { $regex: filters.location, $options: "i" };
  }

  return Venue.find(query).populate("ownerId");
};

export const updateVenue = async (
  id: string,
  payload: Partial<CreateVenuePayload>,
): Promise<VenueDocument | null> => {
  return Venue.findByIdAndUpdate(id, payload, { new: true });
};

export const deleteVenue = async (
  id: string,
): Promise<VenueDocument | null> => {
  return Venue.findByIdAndDelete(id);
};
