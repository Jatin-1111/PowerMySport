"use client";

import type { CostOrigin } from "@/modules/planner/services/planner";
import { Button } from "@/modules/shared/ui/Button";
import { MapPin } from "lucide-react";
import { useState } from "react";

/**
 * Where the travel estimates start from, and a way to change it.
 *
 * ── What is asked, and what happens to it ───────────────────────────────────
 * Just a city, once. It is saved on the parent's profile, not kept privately by
 * the planner, and it is sent to the AI model along with the venue's city to price
 * the trip. Nothing finer than a city is asked for or needed, and the line says so
 * where it is asked, so nobody has to find it in a policy.
 *
 * Until a city is given, estimates start from the state the child is registered in
 * on the ranking list, which is coarser, and the line says that too.
 */

export function HomeCityPrompt({
  origin,
  saving,
  onSave,
  bare = false,
}: {
  origin: CostOrigin;
  saving: boolean;
  onSave: (city: string) => void;
  /** No box of its own, for use inside a tile that already has one. */
  bare?: boolean;
}) {
  const [editing, setEditing] = useState(origin.kind !== "city");
  const [city, setCity] = useState(origin.kind === "city" ? (origin.city ?? "") : "");

  const lead =
    origin.kind === "city"
      ? `Travel estimates start from ${origin.label}.`
      : origin.kind === "state"
        ? `Travel estimates start from ${origin.label}, the state on the ranking list. A city gives better ones.`
        : "Add your city to estimate travel and stay.";

  return (
    <div className={bare ? "" : "rounded-lg border border-slate-200 bg-white px-5 py-3"}>
      <p className="flex items-start gap-2 text-sm text-slate-700">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span>
          {lead}
          {origin.kind === "city" && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-2 font-semibold text-orange-700 hover:underline"
            >
              Change
            </button>
          )}
        </span>
      </p>

      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (city.trim().length >= 2) {
              onSave(city.trim());
              setEditing(false);
            }
          }}
          className="mt-3"
        >
          <label htmlFor="home-city" className="text-xs font-semibold text-slate-700">
            Your city
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="home-city"
              type="text"
              value={city}
              maxLength={60}
              autoComplete="address-level2"
              placeholder="Pune"
              onChange={(event) => setCity(event.target.value)}
              className="focus-visible:ring-power-orange-solid min-h-10 w-full max-w-56 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2"
            />
            <Button type="submit" size="sm" disabled={saving || city.trim().length < 2}>
              {saving ? "Saving..." : "Save city"}
            </Button>
            {origin.kind === "city" && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">
            Saved to your profile. Only the city is used, and it is shared with our AI model
            together with the venue to estimate the trip. We do not ask for an address.
          </p>
        </form>
      )}
    </div>
  );
}
