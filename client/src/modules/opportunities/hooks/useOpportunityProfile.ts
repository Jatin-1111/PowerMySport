"use client";

import { isIndianStateOrUT } from "@/lib/indianStates";
import { rememberChildAge, useChildAge } from "@/modules/pathway/utils/childAge";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { EMPTY_PROFILE, type ChildProfile } from "../utils/match";

// ─── The child a parent is looking on behalf of ──────────────────────────
//
// Four answers, kept in this browser only: age (the same remembered age the
// pathway pages use, so it is asked once across the site), sport, gender and
// state. Nothing here identifies anyone and nothing is sent to a server.
//
// useSyncExternalStore, as in childAge.ts: the server snapshot is honestly
// empty so hydration matches what the server rendered, and a change made in
// one component (the bar on the list) reaches another (the checklist on an
// entry) and other tabs at once.

const STORAGE_KEY = "pms_opportunity_profile";

type Stored = Pick<ChildProfile, "sport" | "gender" | "state">;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Blocked or private storage: an unremembered profile beats a crashed page.
    return "";
  }
}

/** Whatever was stored, reduced to values the rest of the page can trust. */
export function parseStored(raw: string): Stored {
  const empty: Stored = { sport: null, gender: null, state: null };
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      sport: typeof value.sport === "string" && value.sport ? value.sport : null,
      gender: value.gender === "boy" || value.gender === "girl" ? value.gender : null,
      state: typeof value.state === "string" && isIndianStateOrUT(value.state) ? value.state : null,
    };
  } catch {
    return empty;
  }
}

const noopSubscribe = () => () => {};

export function useOpportunityProfile() {
  const age = useChildAge();
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  // False on the server and during hydration, true after: lets a component hold
  // back anything that depends on the saved profile until it has been read.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const stored = useMemo(() => parseStored(raw), [raw]);
  const profile = useMemo<ChildProfile>(
    () => ({ ...EMPTY_PROFILE, ...stored, age }),
    [stored, age]
  );

  const setField = useCallback(<K extends keyof ChildProfile>(key: K, value: ChildProfile[K]) => {
    if (key === "age") {
      rememberChildAge(value as number | null);
      return;
    }
    const next = { ...parseStored(readRaw()), [key]: value };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Still emit, so the page follows the parent's choice this visit.
    }
    emit();
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // see above
    }
    rememberChildAge(null);
    emit();
  }, []);

  return { profile, hydrated, setField, clear };
}
