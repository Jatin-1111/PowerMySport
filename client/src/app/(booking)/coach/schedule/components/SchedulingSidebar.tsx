"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Booking, IBlockedDate } from "@/types";
import { motion } from "framer-motion";
import { Ban, CalendarCheck, Clock, Loader2, Pencil, Trash2, User } from "lucide-react";
import { formatFullDate, formatTime, toISODate } from "../scheduleUtils";

interface SchedulingSidebarProps {
  pendingBookings: Booking[];
  onReviewBooking: (b: Booking) => void;
  bufferTime: number;
  blockedDates: IBlockedDate[];

  // Block-dates form
  blockStart: string;
  setBlockStart: (v: string) => void;
  blockEnd: string;
  setBlockEnd: (v: string) => void;
  blockReason: string;
  setBlockReason: (v: string) => void;
  isBlocking: boolean;
  onBlockDates: () => void;

  // Edit-block form
  editingBlockId: string | null;
  setEditingBlockId: (id: string | null) => void;
  editBlockStart: string;
  setEditBlockStart: (v: string) => void;
  editBlockEnd: string;
  setEditBlockEnd: (v: string) => void;
  editBlockReason: string;
  setEditBlockReason: (v: string) => void;
  isSavingEdit: boolean;
  onEditBlock: (blockId: string) => void;

  removingBlockId: string | null;
  onUnblock: (blockId: string) => void;
}

export function SchedulingSidebar({
  pendingBookings,
  onReviewBooking,
  bufferTime,
  blockedDates,
  blockStart,
  setBlockStart,
  blockEnd,
  setBlockEnd,
  blockReason,
  setBlockReason,
  isBlocking,
  onBlockDates,
  editingBlockId,
  setEditingBlockId,
  editBlockStart,
  setEditBlockStart,
  editBlockEnd,
  setEditBlockEnd,
  editBlockReason,
  setEditBlockReason,
  isSavingEdit,
  onEditBlock,
  removingBlockId,
  onUnblock,
}: SchedulingSidebarProps) {
  const today = toISODate(new Date());

  return (
    <div className="space-y-5">
      {/* Pending approvals */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">Pending Approvals</h3>
          {pendingBookings.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {pendingBookings.length}
            </span>
          )}
        </div>
        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {pendingBookings.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <CalendarCheck size={28} strokeWidth={1.5} />
              <p className="mt-2 text-xs">No pending approvals</p>
            </div>
          ) : (
            pendingBookings.map((b) => {
              const playerName =
                typeof b.userId === "object" && b.userId
                  ? ((b.userId as { name?: string }).name ?? "Player")
                  : "Player";
              return (
                <div key={b.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <User size={14} className="text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{playerName}</p>
                    <p className="text-xs capitalize text-slate-500">{b.sport}</p>
                    <p className="text-xs text-slate-400">
                      {formatFullDate(new Date(b.date))} · {formatTime(b.startTime)}
                    </p>
                  </div>
                  <button
                    onClick={() => onReviewBooking(b)}
                    className="shrink-0 rounded-lg border border-orange-200 px-2.5 py-1 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-50"
                  >
                    Review
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Availability info */}
      {bufferTime > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
            <Clock size={15} className="text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Buffer time between sessions</p>
            <p className="text-xs text-slate-500">{bufferTime} minutes</p>
          </div>
        </motion.div>
      )}

      {/* Block dates */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-4 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">Block Time Off</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Mark dates unavailable — holidays, personal time, etc.
          </p>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                min={today}
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                min={blockStart || today}
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Reason (optional)
            </label>
            <input
              type="text"
              placeholder="Holiday, personal, travel..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            fullWidth
            loading={isBlocking}
            icon={<Ban size={14} />}
            onClick={onBlockDates}
          >
            Block dates
          </Button>
        </div>

        {/* Existing blocked dates */}
        {blockedDates.length > 0 && (
          <div className="border-t border-slate-100">
            <div className="px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Blocked periods
              </p>
            </div>
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {blockedDates.map((b) => {
                const bid =
                  (b as { _id?: string; id?: string })._id ?? (b as { id?: string }).id ?? "";
                const start = new Date(b.startDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                });
                const end = new Date(b.endDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const isSameDay =
                  toISODate(new Date(b.startDate)) === toISODate(new Date(b.endDate));
                const isEditing = editingBlockId === bid;

                return (
                  <div key={bid}>
                    {isEditing ? (
                      /* ── Inline edit form ── */
                      <div className="space-y-2 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold text-slate-700">Edit block</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                              From
                            </label>
                            <input
                              type="date"
                              value={editBlockStart}
                              onChange={(e) => setEditBlockStart(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                              To
                            </label>
                            <input
                              type="date"
                              min={editBlockStart}
                              value={editBlockEnd}
                              onChange={(e) => setEditBlockEnd(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={editBlockReason}
                          onChange={(e) => setEditBlockReason(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="primary"
                            loading={isSavingEdit}
                            onClick={() => onEditBlock(bid)}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingBlockId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ── Read view ── */
                      <div className="flex items-center gap-2 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700">
                            {isSameDay ? start : `${start} – ${end}`}
                          </p>
                          {b.reason && (
                            <p className="truncate text-xs text-slate-400">{b.reason}</p>
                          )}
                        </div>
                        {/* Edit button */}
                        <button
                          onClick={() => {
                            setEditingBlockId(bid);
                            setEditBlockStart(toISODate(new Date(b.startDate)));
                            setEditBlockEnd(toISODate(new Date(b.endDate)));
                            setEditBlockReason(b.reason ?? "");
                          }}
                          className="hover:text-power-orange shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-orange-50"
                          aria-label="Edit block"
                        >
                          <Pencil size={13} />
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => onUnblock(bid)}
                          disabled={removingBlockId === bid}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                          aria-label="Remove block"
                        >
                          {removingBlockId === bid ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
