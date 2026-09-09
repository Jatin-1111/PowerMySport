import type { LucideIcon } from "lucide-react";
import { Building2, Star, Trophy, UserRound } from "lucide-react";

/**
 * What an experience can be anchored to, client side. Kinds and signal keys
 * must match server/src/community/constants/experience.ts — they are stored
 * in the database, not derived, so this file is a mirror, not a source.
 *
 * COACH and EXPERT name a real person, which is why they carry a note in the
 * composer and go to review before they're public (see server-side
 * `requiresPreModeration`) — everything here is UI copy for that, the actual
 * gate lives on the server.
 */

export type ExperienceSubjectKind =
  "TOURNAMENT" | "TOURNAMENT_EDITION" | "VENUE" | "ACADEMY" | "COACH" | "EXPERT";

export const MODERATED_SUBJECT_KINDS: readonly ExperienceSubjectKind[] = ["COACH", "EXPERT"];

export interface SubjectKindMeta {
  kind: ExperienceSubjectKind;
  label: string;
  /** What the composer's search step asks for. */
  searchPlaceholder: string;
  Icon: LucideIcon;
}

export const SUBJECT_KINDS: SubjectKindMeta[] = [
  { kind: "TOURNAMENT", label: "Tournament", searchPlaceholder: "Search tournaments…", Icon: Trophy }, // prettier-ignore
  { kind: "TOURNAMENT_EDITION", label: "Tournament", searchPlaceholder: "Search tournaments…", Icon: Trophy }, // prettier-ignore
  { kind: "VENUE", label: "Venue", searchPlaceholder: "Search venues…", Icon: Building2 },
  { kind: "ACADEMY", label: "Academy", searchPlaceholder: "Search academies…", Icon: Building2 },
  { kind: "COACH", label: "Coach", searchPlaceholder: "Search coaches by name…", Icon: UserRound },
  { kind: "EXPERT", label: "Expert", searchPlaceholder: "Search experts by name…", Icon: Star },
];

export const getSubjectKindMeta = (kind: ExperienceSubjectKind): SubjectKindMeta =>
  SUBJECT_KINDS.find((entry) => entry.kind === kind) || SUBJECT_KINDS[0];

// ─── Signals ──────────────────────────────────────────────────────────────────

export type SignalKey =
  | "organisation"
  | "facilities"
  | "officiating"
  | "valueForMoney"
  | "travelAndStay"
  | "cleanliness"
  | "staff"
  | "coachingQuality"
  | "communication"
  | "punctuality";

export type SignalValue = "GOOD" | "OKAY" | "POOR";

export const SIGNAL_VALUES: { value: SignalValue; label: string }[] = [
  { value: "GOOD", label: "Good" },
  { value: "OKAY", label: "Okay" },
  { value: "POOR", label: "Poor" },
];

const SIGNAL_LABELS: Record<SignalKey, string> = {
  organisation: "Organisation",
  facilities: "Facilities",
  officiating: "Officiating",
  valueForMoney: "Value for money",
  travelAndStay: "Travel & stay",
  cleanliness: "Cleanliness",
  staff: "Staff",
  coachingQuality: "Coaching quality",
  communication: "Communication",
  punctuality: "Punctuality",
};

export const SIGNAL_KEYS_BY_SUBJECT_KIND: Record<ExperienceSubjectKind, SignalKey[]> = {
  TOURNAMENT: ["organisation", "facilities", "officiating", "valueForMoney", "travelAndStay"],
  TOURNAMENT_EDITION: [
    "organisation",
    "facilities",
    "officiating",
    "valueForMoney",
    "travelAndStay",
  ],
  VENUE: ["facilities", "cleanliness", "staff", "valueForMoney"],
  ACADEMY: ["coachingQuality", "facilities", "communication", "valueForMoney"],
  COACH: ["coachingQuality", "communication", "punctuality", "valueForMoney"],
  EXPERT: ["coachingQuality", "communication", "punctuality", "valueForMoney"],
};

export const getSignalLabel = (key: SignalKey): string => SIGNAL_LABELS[key] || key;
