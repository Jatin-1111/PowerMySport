"use client";

import type { AdminExpertAvailabilityWindow } from "@/modules/expert/services/expert";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Controlled editor for an expert's weekly availability windows + blackout
 * dates. Used by the admin "Add expert" form and the admin edit panel so an
 * expert can be made bookable without logging in themselves.
 */
export function AvailabilityEditor({
  windows,
  blackout,
  onWindowsChange,
  onBlackoutChange,
}: {
  windows: AdminExpertAvailabilityWindow[];
  blackout: string[];
  onWindowsChange: (w: AdminExpertAvailabilityWindow[]) => void;
  onBlackoutChange: (b: string[]) => void;
}) {
  const [newBlackout, setNewBlackout] = useState("");

  const addWindow = (dayOfWeek: number) =>
    onWindowsChange([...windows, { dayOfWeek, start: "09:00", end: "10:00" }]);
  const updateWindow = (idx: number, patch: Partial<AdminExpertAvailabilityWindow>) =>
    onWindowsChange(windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  const removeWindow = (idx: number) =>
    onWindowsChange(windows.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="space-y-3">
        {DAYS.map((day, dayIdx) => {
          const dayWindows = windows
            .map((w, i) => ({ w, i }))
            .filter(({ w }) => w.dayOfWeek === dayIdx);
          return (
            <div
              key={day}
              className="flex flex-col gap-2 border-b border-slate-100 pb-3 last:border-0 sm:flex-row sm:items-start"
            >
              <div className="w-12 pt-2 text-sm font-semibold text-slate-700">{day}</div>
              <div className="flex-1 space-y-2">
                {dayWindows.length === 0 && (
                  <p className="pt-2 text-sm text-slate-400">Unavailable</p>
                )}
                {dayWindows.map(({ w, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={w.start}
                      onChange={(e) => updateWindow(i, { start: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      value={w.end}
                      onChange={(e) => updateWindow(i, { end: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeWindow(i)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove window"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addWindow(dayIdx)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-power-orange hover:underline"
                >
                  <Plus size={13} /> Add window
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-bold text-slate-900">Blackout dates</h4>
        <p className="mt-1 text-xs text-slate-500">
          Days the expert is unavailable even within their weekly hours.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {blackout.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {d}
              <button
                type="button"
                onClick={() => onBlackoutChange(blackout.filter((x) => x !== d))}
                aria-label="Remove date"
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={newBlackout}
            onChange={(e) => setNewBlackout(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (newBlackout && !blackout.includes(newBlackout)) {
                onBlackoutChange([...blackout, newBlackout].sort());
                setNewBlackout("");
              }
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
