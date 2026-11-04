"use client";

import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import { Booking } from "@/types";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  IndianRupee,
  MapPin,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatFullDate,
  formatTime,
  STATUS_BADGE,
  STATUS_LABEL,
  toISODate,
} from "../scheduleUtils";

// ─── Session Detail Modal ──────────────────────────────────────────────────────

interface SessionModalProps {
  booking: Booking | null;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onReschedule: (id: string, date: string, start: string, end: string) => Promise<void>;
  actionLoading: string | null;
}

export function SessionModal({
  booking,
  onClose,
  onApprove,
  onReject,
  onReschedule,
  actionLoading,
}: SessionModalProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleEnd, setRescheduleEnd] = useState("");

  useEffect(() => {
    if (booking) {
      setShowReschedule(false);
      setRescheduleDate(toISODate(new Date(booking.date)));
      setRescheduleStart(booking.startTime);
      setRescheduleEnd(booking.endTime);
    }
  }, [booking]);

  if (!booking) return null;

  const playerName =
    typeof booking.userId === "object" && booking.userId !== null
      ? ((booking.userId as { name?: string }).name ?? "Player")
      : "Player";

  const isPending = booking.status === "AWAITING_PROVIDER";
  const isConfirmed = booking.status === "CONFIRMED";
  const isLoading = (id: string) => actionLoading === id;
  const today = toISODate(new Date());

  const handleRescheduleSubmit = async () => {
    if (!rescheduleDate || !rescheduleStart || !rescheduleEnd) {
      toast.error("Please fill in all reschedule fields.");
      return;
    }
    if (rescheduleStart >= rescheduleEnd) {
      toast.error("End time must be after start time.");
      return;
    }
    await onReschedule(booking.id, rescheduleDate, rescheduleStart, rescheduleEnd);
    setShowReschedule(false);
  };

  return (
    <Modal isOpen={!!booking} onClose={onClose} title="Session Details" size="md">
      <div className="space-y-5">
        {/* Player */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
            <User size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{playerName}</p>
            <p className="text-xs capitalize text-slate-500">{booking.sport}</p>
          </div>
          <span
            className={cn(
              "ml-auto rounded-full px-3 py-1 text-xs font-medium",
              STATUS_BADGE[booking.status]
            )}
          >
            {STATUS_LABEL[booking.status] ?? booking.status}
          </span>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Date / Time / Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <CalendarDays size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Date</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {formatFullDate(new Date(booking.date))}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <Clock size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Time</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <IndianRupee size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Amount</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              ₹{booking.totalAmount.toLocaleString("en-IN")}
            </p>
          </div>
          {(booking.venue || booking.coachId) && (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="mb-1 flex items-center gap-2 text-slate-500">
                <MapPin size={14} />
                <span className="text-xs font-medium uppercase tracking-wide">Location</span>
              </div>
              <p className="truncate text-sm font-semibold text-slate-800">
                {typeof booking.venue === "object" && booking.venue
                  ? booking.venue.name
                  : "Coach venue"}
              </p>
            </div>
          )}
        </div>

        {/* Reschedule form */}
        <AnimatePresence>
          {showReschedule && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Reschedule to</p>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Date</label>
                    <input
                      type="date"
                      min={today}
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Start time</label>
                      <input
                        type="time"
                        value={rescheduleStart}
                        onChange={(e) => setRescheduleStart(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">End time</label>
                      <input
                        type="time"
                        value={rescheduleEnd}
                        onChange={(e) => setRescheduleEnd(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={isLoading(`reschedule-${booking.id}`)}
                    onClick={handleRescheduleSubmit}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowReschedule(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {isPending && (
            <>
              <Button
                size="sm"
                variant="success"
                loading={isLoading(`approve-${booking.id}`)}
                icon={<CalendarCheck size={15} />}
                onClick={() => onApprove(booking.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={isLoading(`reject-${booking.id}`)}
                icon={<X size={15} />}
                onClick={() => onReject(booking.id)}
              >
                Decline
              </Button>
            </>
          )}
          {isConfirmed && !showReschedule && (
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw size={15} />}
              onClick={() => setShowReschedule(true)}
            >
              Reschedule
            </Button>
          )}
          {isConfirmed && (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50"
              loading={isLoading(`reject-${booking.id}`)}
              icon={<X size={15} />}
              onClick={() => onReject(booking.id)}
            >
              Decline
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
