"use client";

import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { SessionModal } from "./components/SessionModal";
import { MonthView } from "./components/MonthView";
import { TimeGrid } from "./components/TimeGrid";
import { SchedulingSidebar } from "./components/SchedulingSidebar";
import { useCoachSchedule } from "./hooks/useCoachSchedule";
import { type CalendarView, toISODate } from "./scheduleUtils";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachSchedulePage() {
  const {
    view,
    setView,
    currentDate,
    isLoading,
    hasCalendarData,
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
  } = useCoachSchedule();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schedule</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage your bookings, availability, and blocked dates
            </p>
          </div>

          {/* View switcher */}
          <div className="flex self-start rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:self-auto">
            {(["month", "week", "day"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all",
                  view === v
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Calendar card ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            style={{ minHeight: view === "month" ? 600 : 680 }}
          >
            {/* Calendar toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                  aria-label="Previous"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                  aria-label="Next"
                >
                  <ChevronRight size={18} />
                </button>
                <h2 className="ml-1 text-base font-semibold text-slate-800">{headerLabel}</h2>
              </div>
              <div className="flex items-center gap-2">
                {isLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                <button
                  onClick={goToday}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Calendar body */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-${toISODate(currentDate)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 flex-col overflow-hidden"
              >
                {isLoading && !hasCalendarData ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-slate-300" />
                  </div>
                ) : view === "month" ? (
                  <MonthView
                    current={currentDate}
                    bookings={bookings}
                    blockedDates={blockedDates}
                    onDayClick={handleDayClick}
                    onBookingClick={setSelectedBooking}
                  />
                ) : (
                  <TimeGrid
                    days={view === "week" ? weekDays : [currentDate]}
                    bookings={bookings}
                    blockedDates={blockedDates}
                    onBookingClick={setSelectedBooking}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2.5">
              {[
                { label: "Pending", cls: "bg-amber-400" },
                { label: "Confirmed", cls: "bg-turf-green" },
                { label: "In Progress", cls: "bg-blue-400" },
                { label: "Completed", cls: "bg-slate-300" },
              ].map(({ label, cls }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-2 w-2 rounded-full", cls)} />
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-4 rounded-sm"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(244,63,94,0.3) 2px, rgba(244,63,94,0.3) 4px)",
                  }}
                />
                <span className="text-xs text-slate-500">Blocked</span>
              </div>
            </div>
          </motion.div>

          {/* ── Right panel ── */}
          <SchedulingSidebar
            pendingBookings={pendingBookings}
            onReviewBooking={setSelectedBooking}
            bufferTime={bufferTime}
            blockedDates={blockedDates}
            blockStart={blockStart}
            setBlockStart={setBlockStart}
            blockEnd={blockEnd}
            setBlockEnd={setBlockEnd}
            blockReason={blockReason}
            setBlockReason={setBlockReason}
            isBlocking={isBlocking}
            onBlockDates={handleBlockDates}
            editingBlockId={editingBlockId}
            setEditingBlockId={setEditingBlockId}
            editBlockStart={editBlockStart}
            setEditBlockStart={setEditBlockStart}
            editBlockEnd={editBlockEnd}
            setEditBlockEnd={setEditBlockEnd}
            editBlockReason={editBlockReason}
            setEditBlockReason={setEditBlockReason}
            isSavingEdit={isSavingEdit}
            onEditBlock={handleEditBlock}
            removingBlockId={removingBlockId}
            onUnblock={handleUnblock}
          />
        </div>
      </div>

      {/* Session detail modal */}
      <SessionModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onReschedule={handleReschedule}
        actionLoading={actionLoading}
      />
    </div>
  );
}
