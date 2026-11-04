import type { ChildAmbition, ChildExperienceLevel, ChildGender } from "@powermysport/shared-types";
import axiosInstance from "@/lib/api/axios";

/**
 * What the WhatsApp assistant kept about a parent's children, and the call that turns it into
 * profiles. The link in the chat is the credential, so nothing here ever sees a phone number.
 */

/** "professional" is kept on old profiles but never suggested: "career" replaced it. */
export type Ambition = Exclude<ChildAmbition, "professional">;
export type Experience = ChildExperienceLevel;
export type Gender = ChildGender;

export interface HandoffChild {
  key: string;
  firstName: string;
  /** Said in words ("about 15"), because an age told a year ago is not today's age. */
  ageText?: string;
  sports: string[];
  level?: string;
  goal?: string;
  state?: string;
  suggestedAmbition?: Ambition;
  suggestedExperience?: Experience;
}

export interface ClaimChild {
  key: string;
  /** YYYY-MM-DD. WhatsApp only heard an age. */
  dob: string;
  gender?: Gender;
  ambition?: Ambition;
  experienceLevel?: Experience;
}

export interface ClaimResult {
  created: string[];
  skipped: string[];
  missing: string[];
  failed: Array<{ name: string; reason: string }>;
  remaining: number;
}

export const handoffApi = {
  preview: async (token: string): Promise<HandoffChild[]> => {
    const response = await axiosInstance.get("/whatsapp-notes/preview", { params: { token } });
    return response.data.data.children;
  },

  claim: async (
    token: string,
    children: ClaimChild[],
    parentalConsent?: boolean
  ): Promise<ClaimResult> => {
    const response = await axiosInstance.post("/whatsapp-notes/claim", {
      token,
      children,
      ...(parentalConsent ? { parentalConsent: true } : {}),
    });
    return response.data.data;
  },
};

/** The status and the server's own message for a failed call, whatever shape the error is. */
export function problemFrom(error: unknown): { status?: number; message: string } {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })
    ?.response;
  return {
    ...(response?.status ? { status: response.status } : {}),
    message:
      response?.data?.message ||
      (error instanceof Error ? error.message : "Something went wrong. Please try again."),
  };
}
