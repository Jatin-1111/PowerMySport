"use client";

import { bookingApi } from "@/modules/booking/services/booking";
import type { Booking } from "@/types";
import { useState } from "react";

export const CHECK_IN_CODE_LENGTH = 8;

/** Codes are upper-case letters and digits; anything else typed or pasted is dropped. */
export const normalizeCheckInCode = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CHECK_IN_CODE_LENGTH);

export interface CheckInMessage {
  tone: "error" | "success";
  text: string;
}

/**
 * Starts a session from the client's check-in code. It used to live on the
 * profile page; it belongs with bookings, where the coach is when a client
 * arrives. `onStarted` lets the page show the booking as in progress.
 */
export function useSessionCheckIn(onStarted?: (booking: Booking) => void) {
  const [code, setCodeState] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<CheckInMessage | null>(null);
  const [startedBooking, setStartedBooking] = useState<Booking | null>(null);

  const setCode = (value: string) => setCodeState(normalizeCheckInCode(value));

  const submit = async () => {
    const normalized = normalizeCheckInCode(code.trim());

    if (!normalized) {
      setMessage({ tone: "error", text: "Enter the client's check-in code." });
      return;
    }
    if (normalized.length !== CHECK_IN_CODE_LENGTH) {
      setMessage({ tone: "error", text: `The code has ${CHECK_IN_CODE_LENGTH} characters.` });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      setStartedBooking(null);

      const response = await bookingApi.checkInBookingByCode(normalized);

      if (response.success && response.data) {
        setStartedBooking(response.data);
        setMessage({ tone: "success", text: "Session started." });
        setCodeState("");
        onStarted?.(response.data);
        return;
      }

      setMessage({ tone: "error", text: response.message || "We could not verify that code." });
    } catch (error: unknown) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setMessage({ tone: "error", text: apiMessage || "We could not verify that code." });
    } finally {
      setLoading(false);
    }
  };

  return { code, setCode, loading, message, startedBooking, submit };
}
