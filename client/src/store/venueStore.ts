import { create } from "zustand";
import { Venue } from "@/types";

interface VenueStore {
  venues: Venue[];
  selectedVenue: Venue | null;
  isLoading: boolean;
  setVenues: (venues: Venue[]) => void;
  setSelectedVenue: (venue: Venue | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useVenueStore = create<VenueStore>((set) => ({
  venues: [],
  selectedVenue: null,
  isLoading: false,
  setVenues: (venues) => set({ venues }),
  setSelectedVenue: (venue) => set({ selectedVenue: venue }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
