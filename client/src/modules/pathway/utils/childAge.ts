"use client";

// ─── The remembered child age ────────────────────────────────────────────────
//
// One number, shared by every pathway surface: the `/roadmap` picker uses it to
// recommend a starting stage per sport, and the reader uses it to mark "you are
// here" on the rail. A family has one child, and asking their age again on every
// sport is the kind of small tax that makes a tool feel like paperwork.
//
// `useSyncExternalStore` rather than `useState` + an effect that reads
// localStorage on mount. Both give the same result, but the effect version
// renders once with no age and then immediately again with it — a cascading
// render React now lints against — and it cannot see a write made by another
// component or another tab. This subscribes to the store instead, so typing an
// age on the index updates a reader already open in the next tab, and the
// server snapshot is honestly `null` so hydration matches what the server sent.

import { useSyncExternalStore } from "react";

import { AGE_STORAGE_KEY } from "./ageRange";

/** Same-document subscribers. The `storage` event only fires in *other* tabs. */
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Safe to recompute on every render: the snapshot is a primitive, so React
 * compares it by value and a fresh read of the same age is not a change.
 */
function getSnapshot(): number | null {
  try {
    const raw = localStorage.getItem(AGE_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    // Private-mode Safari and blocked third-party storage both throw here. An
    // unremembered age is a smaller loss than a crashed page.
    return null;
  }
}

/** Nothing is remembered on the server — the pathway renders un-personalised. */
const getServerSnapshot = (): number | null => null;

/** Write the age (or forget it) and tell every subscriber on this page. */
export function rememberChildAge(age: number | null) {
  try {
    if (age === null) localStorage.removeItem(AGE_STORAGE_KEY);
    else localStorage.setItem(AGE_STORAGE_KEY, String(age));
  } catch {
    // Still emit: the in-page state should follow the parent's input even when
    // it cannot be persisted for next time.
  }
  emit();
}

/** Clamp a typed value to a plausible age, or null for "no answer". */
export function parseTypedAge(raw: string): number | null {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  if (!trimmed || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(99, Math.round(value));
}

export function useChildAge(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
