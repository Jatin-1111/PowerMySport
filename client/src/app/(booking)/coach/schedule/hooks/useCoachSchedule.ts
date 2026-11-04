"use client";

import { toast } from "@/lib/toast";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import { queryKeys } from "@/lib/query/keys";
import { Booking } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  type CalendarView,
  MONTH_NAMES,
  formatFullDate,
  getCalendarRange,
  getWeekStart,
  toISODate,
} from "../scheduleUtils";

export function useCoachSchedule() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Block-date form state
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  // Edit blocked date state
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlockStart, setEditBlockStart] = useState("");
  const [editBlockEnd, setEditBlockEnd] = useState("");
  const [editBlockReason, setEditBlockReason] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { start: rangeStart, end: rangeEnd } = getCalendarRange(view, currentDate);
  const rangeStartISO = toISODate(rangeStart);
  const rangeEndISO = toISODate(rangeEnd);

  const calendarQuery = useQuery({
    queryKey: queryKeys.coachSchedule.calendar(view, rangeStartISO, rangeEndISO),
    queryFn: async () => {
      const res = await coachApi.getCalendar(rangeStartISO, rangeEndISO);
      if (!res.success || !res.data) {
        throw new Error("Failed to load calendar.");
      }
      return res.data;
    },
  });

  useEffect(() => {
    if (calendarQuery.isError) toast.error("Failed to load calendar.");
  }, [calendarQuery.isError]);

  const refetchCalendar = () => {
    void queryClient.invalidateQueries({ queryKey: ["coach-schedule", "calendar"] });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const navigate = (delta: number) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else if (view === "week") d.setDate(d.getDate() + delta * 7);
      else d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCurrentDate(d);
  };

  const headerLabel = useMemo(() => {
    if (view === "month")
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "week") {
      const ws = getWeekStart(currentDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.getDate()} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
      }
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
    }
    return formatFullDate(currentDate);
  }, [view, currentDate]);

  const weekDays = useMemo(() => {
    const ws = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApprove = async (bookingId: string) => {
    setActionLoading(`approve-${bookingId}`);
    try {
      const res = await bookingApi.confirmBookingByProvider(bookingId);
      if (res.success) {
        toast.success("Booking approved.");
        setSelectedBooking(null);
        refetchCalendar();
      }
    } catch {
      toast.error("Failed to approve booking.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(`reject-${bookingId}`);
    try {
      const res = await bookingApi.rejectBookingByProvider(bookingId);
      if (res.success) {
        toast.success("Booking declined.");
        setSelectedBooking(null);
        refetchCalendar();
      }
    } catch {
      toast.error("Failed to decline booking.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (id: string, date: string, start: string, end: string) => {
    setActionLoading(`reschedule-${id}`);
    try {
      const res = await bookingApi.rescheduleBooking(id, {
        newDate: date,
        newStartTime: start,
        newEndTime: end,
      });
      if (res.success) {
        toast.success("Booking rescheduled.");
        setSelectedBooking(null);
        refetchCalendar();
      }
    } catch {
      toast.error("Failed to reschedule booking.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockDates = async () => {
    if (!blockStart || !blockEnd) {
      toast.error("Please select a start and end date.");
      return;
    }
    if (blockEnd < blockStart) {
      toast.error("End date must be on or after start date.");
      return;
    }
    setIsBlocking(true);
    try {
      const res = await coachApi.blockDates({
        startDate: blockStart,
        endDate: blockEnd,
        reason: blockReason || undefined,
        allDay: true,
      });
      if (res.success) {
        toast.success("Dates blocked.");
        setBlockStart("");
        setBlockEnd("");
        setBlockReason("");
        refetchCalendar();
      }
    } catch {
      toast.error("Failed to block dates.");
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = async (blockId: string) => {
    setRemovingBlockId(blockId);
    try {
      const res = await coachApi.unblockDate(blockId);
      if (res.success) {
        toast.success("Date unblocked.");
        refetchCalendar();
      }
    } catch {
      toast.error("Failed to unblock date.");
    } finally {
      setRemovingBlockId(null);
    }
  };

  const handleEditBlock = async (oldBlockId: string) => {
    if (!editBlockStart || !editBlockEnd) {
      toast.error("Please select start and end dates.");
      return;
    }
    if (editBlockEnd < editBlockStart) {
      toast.error("End date must be on or after start date.");
      return;
    }
    setIsSavingEdit(true);
    try {
      // Remove old block then add new one
      await coachApi.unblockDate(oldBlockId);
      const res = await coachApi.blockDates({
        startDate: editBlockStart,
        endDate: editBlockEnd,
        reason: editBlockReason || undefined,
        allDay: true,
      });
      if (res.success) {
        toast.success("Block updated.");
        setEditingBlockId(null);
        refetchCalendar();
      }
    } catch {
      toast.error("Failed to update block.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDayClick = (day: Date) => {
    setCurrentDate(day);
    setView("day");
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const bookings = calendarQuery.data?.bookings ?? [];
  const blockedDates = calendarQuery.data?.blockedDates ?? [];
  const bufferTime = calendarQuery.data?.travelBufferTime ?? 0;

  // Only paid bookings are actionable by the coach — an AWAITING_PAYMENT
  // booking is still the customer's to complete, not the coach's to approve.
  const pendingBookings = bookings.filter((b) => b.status === "AWAITING_PROVIDER");

  return {
    view,
    setView,
    currentDate,
    isLoading: calendarQuery.isFetching,
    hasCalendarData: calendarQuery.data !== undefined,
    selectedBooking,
    setSelectedBooking,
    actionLoading,

    blockStart,
    setBlockStart,
    blockEnd,
    setBlockEnd,
    blockReason,
    setBlockReason,
    isBlocking,
    removingBlockId,

    editingBlockId,
    setEditingBlockId,
    editBlockStart,
    setEditBlockStart,
    editBlockEnd,
    setEditBlockEnd,
    editBlockReason,
    setEditBlockReason,
    isSavingEdit,

    navigate,
    goToday,
    headerLabel,
    weekDays,

    handleApprove,
    handleReject,
    handleReschedule,
    handleBlockDates,
    handleUnblock,
    handleEditBlock,
    handleDayClick,

    bookings,
    blockedDates,
    bufferTime,
    pendingBookings,
  };
}
