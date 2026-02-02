import { create } from "zustand";
import { Booking } from "@/types";

interface BookingStore {
  bookings: Booking[];
  selectedBooking: Booking | null;
  isLoading: boolean;
  setBookings: (bookings: Booking[]) => void;
  setSelectedBooking: (booking: Booking | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  bookings: [],
  selectedBooking: null,
  isLoading: false,
  setBookings: (bookings) => set({ bookings }),
  setSelectedBooking: (booking) => set({ selectedBooking: booking }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
