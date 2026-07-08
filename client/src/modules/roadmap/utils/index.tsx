"use client";


import { DEFAULT_PROGRESS, ProgressState } from '../types';

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function loadProgress(): ProgressState {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem("pms_pathway_progress");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PROGRESS;
}

export function saveProgress(p: ProgressState) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pms_pathway_progress", JSON.stringify(p));
}

export function loadState(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("pms_selected_state") || "";
}

export function saveState(s: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pms_selected_state", s);
}

// ─── P5-P9 Types & Helpers ────────────────────────────────────────────────────

export type SavedItem = {
  id: string;
  type: "tournament" | "scholarship" | "university" | "career";
  name: string;
  sport: string;
  data: any;
  savedAt: string;
};

export type ApplicationRecord = {
  id: string;
  itemName: string;
  itemType: "tournament" | "scholarship" | "university";
  sport: string;
  status: "Submitted" | "In Review" | "Approved";
  documents: { name: string }[];
  submittedAt: string;
};

export function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function lsSet(key: string, val: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

export function loadSaved(): SavedItem[] {
  return lsGet("pms_saved_items", []);
}
export function saveSaved(items: SavedItem[]) {
  lsSet("pms_saved_items", items);
}

export function loadApplications(): ApplicationRecord[] {
  return lsGet("pms_applications", []);
}
export function saveApplications(items: ApplicationRecord[]) {
  lsSet("pms_applications", items);
}

// Stories are now fetched from the backend

// ─── Search autocomplete helper ────────────────────────────────────────────────

export function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-power-orange">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── P9: Deep-link helper ──────────────────────────────────────────────────────

export function buildDiscoveryUrl(
  objective: string,
  sportName: string,
): string | null {
  const lower = objective.toLowerCase();
  let tab: "coaches" | "academies" | "venues";
  if (lower.includes("academy") || lower.includes("academies"))
    tab = "academies";
  else if (lower.includes("coach") || lower.includes("training"))
    tab = "coaches";
  else if (
    lower.includes("tournament") ||
    lower.includes("compet") ||
    lower.includes("trial")
  )
    return null; // no matching tab on the booking page
  else tab = "venues";
  return `/booking?${new URLSearchParams({ tab, sport: sportName }).toString()}`;
}

