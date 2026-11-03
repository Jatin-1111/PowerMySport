import { buildStepGateFlow } from "@/flow/defineFlow";
import type { ExpertAvailabilityWindow } from "@/modules/expert/services/expert";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const SESSION_MODES = ["ONLINE", "IN_PERSON", "BOTH"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const STEPS = [
  { id: 1, title: "Your identity" },
  { id: 2, title: "Expertise" },
  { id: 3, title: "Session setup" },
  { id: 4, title: "Availability" },
  { id: 5, title: "Tax and payout" },
];

// Expert onboarding wired to the URL: Back walks the five steps instead of
// leaving the flow, and each step is a distinct URL for drop-off analytics.
// A step is reachable only when every step before it is complete — the same
// per-step checks the Continue button enforces — so a deep link cannot jump
// past unfilled steps. `loading` short-circuits the gate so a refresh does not
// clamp before the saved draft has been fetched back from the server.
export type ExpertOnboardingGate = {
  loading: boolean;
  name: string;
  bio: string;
  achievements: string;
  sports: string[];
  expertise: string[];
  sessionFee: string;
  sessionMode: SessionMode;
  inPersonAddress: string;
  windows: ExpertAvailabilityWindow[];
};

const isExpertStepComplete = (stepIndex: number, c: ExpertOnboardingGate): boolean => {
  switch (stepIndex) {
    case 0: // Identity
      return (
        c.name.trim().length > 0 && c.bio.trim().length >= 20 && c.achievements.trim().length > 0
      );
    case 1: // Expertise
      return c.sports.length > 0 && c.expertise.length > 0;
    case 2: // Session setup
      return (
        Number(c.sessionFee) > 0 &&
        (c.sessionMode === "ONLINE" || c.inPersonAddress.trim().length > 0)
      );
    case 3: // Availability — invalid time ranges block advancement
      return c.windows.every((w) => w.start < w.end);
    default:
      return true;
  }
};

export const EXPERT_ONBOARDING_FLOW = buildStepGateFlow<ExpertOnboardingGate>(
  "expert-onboarding",
  5,
  (i, c) => c.loading || isExpertStepComplete(i, c)
);
