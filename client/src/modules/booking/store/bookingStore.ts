import { Booking, BookingParticipant, PaymentType, SplitMethod } from "@/types";
import { create } from "zustand";

export interface WaitlistStatus {
  position: number;
  estimatedWaitTime?: number;
  notified: boolean;
}

export interface PaymentSplitState {
  userId: string;
  amount: number;
  status: "PENDING" | "PAID";
}

export interface GroupBookingDraft {
  participants: BookingParticipant[];
  paymentType: PaymentType;
  splitMethod?: SplitMethod;
}

interface BookingStore {
  bookings: Booking[];
  selectedBooking: Booking | null;
  isLoading: boolean;
  groupBookingDraft: GroupBookingDraft | null;
  paymentSplitState: PaymentSplitState[];
  waitlistStatus: WaitlistStatus | null;

  setBookings: (bookings: Booking[]) => void;
  setSelectedBooking: (booking: Booking | null) => void;
  setLoading: (loading: boolean) => void;

  setGroupBookingDraft: (draft: GroupBookingDraft | null) => void;
  setPaymentSplitState: (splits: PaymentSplitState[]) => void;
  setWaitlistStatus: (status: WaitlistStatus | null) => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  bookings: [],
  selectedBooking: null,
  isLoading: false,
  groupBookingDraft: null,
  paymentSplitState: [],
  waitlistStatus: null,

  setBookings: (bookings) => set({ bookings }),
  setSelectedBooking: (booking) => set({ selectedBooking: booking }),
  setLoading: (loading) => set({ isLoading: loading }),

  setGroupBookingDraft: (draft) => set({ groupBookingDraft: draft }),
  setPaymentSplitState: (splits) => set({ paymentSplitState: splits }),
  setWaitlistStatus: (status) => set({ waitlistStatus: status }),
}));
